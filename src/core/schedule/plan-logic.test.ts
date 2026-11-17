import { describe, expect, it } from '@jest/globals';

import {
  acceptModelPlan,
  buildFallbackPlan,
  isClock,
  LLM_MODELS,
  llmModelFor,
  parseParseInputBody,
  parsePlanDayRequest,
  type DayPriority,
  type PlanDayRequest,
} from '../../../supabase/functions/_shared/plan-logic';

const flexible = (title: string, durationMinutes: number | null): DayPriority => ({
  title,
  durationMinutes,
  fixedStart: null,
  important: false,
});
const fixedAt = (title: string, fixedStart: string, durationMinutes: number): DayPriority => ({
  title,
  durationMinutes,
  fixedStart,
  important: false,
});
const request = (priorities: DayPriority[], freeWindows: { start: string; end: string }[]): PlanDayRequest => ({
  date: '2026-11-18',
  priorities,
  freeWindows,
  preferences: null,
});

describe('isClock', () => {
  it('prihvaća samo stvarna vremena', () => {
    expect(isClock('09:05')).toBe(true);
    expect(isClock('23:59')).toBe(true);
    expect(isClock('99:99')).toBe(false);
    expect(isClock('24:00')).toBe(false);
    expect(isClock('9:05')).toBe(false);
    expect(isClock(null)).toBe(false);
  });
});

describe('parsePlanDayRequest (P2: nevaljano tijelo → 400, ne iznimka)', () => {
  const valid = { date: '2026-11-18', priorities: [{ title: 'Pisanje', durationMinutes: 60, fixedStart: null, important: true }], freeWindows: [{ start: '09:00', end: '12:00' }], preferences: null };

  it('valjan zahtjev prolazi, prozori se slažu po vremenu', () => {
    const parsed = parsePlanDayRequest({ ...valid, freeWindows: [{ start: '14:00', end: '16:00' }, { start: '09:00', end: '12:00' }] });
    expect(parsed?.freeWindows.map((window) => window.start)).toEqual(['09:00', '14:00']);
  });

  it.each([
    ['null', null],
    ['niz', []],
    ['bez datuma', { ...valid, date: undefined }],
    ['priorities: [null]', { ...valid, priorities: [null] }],
    ['prioritet bez naslova', { ...valid, priorities: [{ title: ' ', durationMinutes: 30, fixedStart: null, important: false }] }],
    ['trajanje 0', { ...valid, priorities: [{ title: 'A', durationMinutes: 0, fixedStart: null, important: false }] }],
    ['fiksno 99:99', { ...valid, priorities: [{ title: 'A', durationMinutes: 30, fixedStart: '99:99', important: false }] }],
    ['prozor naopako', { ...valid, freeWindows: [{ start: '12:00', end: '09:00' }] }],
    ['prozor null', { ...valid, freeWindows: [null] }],
    ['loše postavke', { ...valid, preferences: { morningEnergy: 'x' } }],
  ])('%s → null', (_name, body) => {
    expect(parsePlanDayRequest(body)).toBeNull();
  });
});

describe('parseParseInputBody (P2: JSON null → 400)', () => {
  it('null, prazan i predug tekst su greške; locale zadano hr', () => {
    expect(parseParseInputBody(null)).toHaveProperty('error');
    expect(parseParseInputBody({ text: '   ' })).toHaveProperty('error');
    expect(parseParseInputBody({ text: 'x'.repeat(2001) })).toHaveProperty('error');
    expect(parseParseInputBody({ text: ' sastanak u 15 ' })).toEqual({ text: 'sastanak u 15', locale: 'hr' });
    expect(parseParseInputBody({ text: 'gym', locale: 'en' })).toEqual({ text: 'gym', locale: 'en' });
  });
});

describe('buildFallbackPlan', () => {
  it('P2: fiksni blok rezervira vrijeme — fleksibilni od 120 min ne stane u 09–12 uz fiksni 10–11', () => {
    const plan = buildFallbackPlan(request([fixedAt('Sastanak', '10:00', 60), flexible('Pisanje', 120)], [{ start: '09:00', end: '12:00' }]));
    expect(plan.schedule).toEqual([{ title: 'Sastanak', start: '10:00', end: '11:00', kind: 'fixed' }]);
    expect(plan.questions[0]).toContain('Pisanje');
  });

  it('P2: fiksni 09:00 i fleksibilni 60 min se ne preklapaju', () => {
    const plan = buildFallbackPlan(request([fixedAt('Liječnik', '09:00', 60), flexible('Pošta', 60)], [{ start: '09:00', end: '12:00' }]));
    expect(plan.schedule).toEqual([
      { title: 'Liječnik', start: '09:00', end: '10:00', kind: 'fixed' },
      { title: 'Pošta', start: '10:15', end: '11:15', kind: 'suggestion' },
    ]);
    expect(plan.questions).toEqual([]);
  });

  it('P2: predug prvi zadatak ne troši prozore sljedećem', () => {
    const plan = buildFallbackPlan(request([flexible('Dugo', 120), flexible('Kratko', 30)], [{ start: '09:00', end: '10:00' }]));
    expect(plan.schedule).toEqual([{ title: 'Kratko', start: '09:00', end: '09:30', kind: 'suggestion' }]);
    expect(plan.questions[0]).toContain('Dugo');
  });

  it('popunjava više prozora redom uz pauzu iz postavki', () => {
    const req = { ...request([flexible('A', 60), flexible('B', 60), flexible('C', null)], [{ start: '09:00', end: '10:30' }, { start: '14:00', end: '16:00' }]), preferences: { morningEnergy: 'high', afternoonEnergy: 'low', eveningEnergy: 'low', focusBlockMinutes: 90, breakMinutes: 10 } as const };
    const plan = buildFallbackPlan(req);
    // C (60 min): nakon A 10:10–11:10 ne stane do 10:30, nakon B 15:10–16:10 ne stane do 16:00.
    expect(plan.schedule.map((block) => `${block.title} ${block.start}-${block.end}`)).toEqual(['A 09:00-10:00', 'B 14:00-15:00']);
    expect(plan.questions[0]).toContain('C');
  });

  it('fiksni koji prelazi ponoć ili se preklapa s drugim fiksnim ide u pitanje', () => {
    const plan = buildFallbackPlan(request([fixedAt('Noć', '23:30', 60), fixedAt('X', '10:00', 60), fixedAt('Y', '10:30', 30)], [{ start: '09:00', end: '12:00' }]));
    expect(plan.schedule.map((block) => block.title)).toEqual(['X']);
    expect(plan.questions[0]).toContain('Noć');
    expect(plan.questions[0]).toContain('Y');
  });

  it('bez prozora ili prioriteta pita', () => {
    expect(buildFallbackPlan(request([flexible('A', 30)], [])).questions[0]).toContain('slobodan');
    expect(buildFallbackPlan(request([], [{ start: '09:00', end: '10:00' }])).questions[0]).toContain('prioritete');
  });
});

describe('acceptModelPlan (P2: model ne smije izaći iz prozora ni dati 99:99)', () => {
  const req = request([fixedAt('Sastanak', '10:00', 60), flexible('Pisanje', 60)], [{ start: '09:00', end: '12:00' }]);
  const reply = (schedule: unknown[]) => JSON.stringify({ schedule, questions: ['Q1', 2, 'Q2', 'Q3', 'Q4'], summary: ' OK ' });

  it('prihvaća valjan plan (i u ```json omotu), fiksni dobiva kind fixed, najviše 3 pitanja', () => {
    const raw = '```json\n' + reply([
      { title: 'Pisanje', start: '11:00', end: '12:00', kind: 'suggestion' },
      { title: 'Sastanak', start: '10:00', end: '11:00', kind: 'suggestion' },
    ]) + '\n```';
    expect(acceptModelPlan(raw, req)).toEqual({
      schedule: [
        { title: 'Sastanak', start: '10:00', end: '11:00', kind: 'fixed' },
        { title: 'Pisanje', start: '11:00', end: '12:00', kind: 'suggestion' },
      ],
      questions: ['Q1', 'Q2', 'Q3'],
      summary: 'OK',
    });
  });

  it.each([
    ['blok izvan prozora 14–15', [{ title: 'Sastanak', start: '10:00', end: '11:00' }, { title: 'Pisanje', start: '14:00', end: '15:00' }]],
    ['vrijeme 99:99', [{ title: 'Sastanak', start: '10:00', end: '11:00' }, { title: 'Pisanje', start: '99:99', end: '99:99' }]],
    ['preklapanje', [{ title: 'Sastanak', start: '10:00', end: '11:00' }, { title: 'Pisanje', start: '10:30', end: '11:30' }]],
    ['pomaknut fiksni', [{ title: 'Sastanak', start: '11:00', end: '12:00' }]],
    ['naopako', [{ title: 'Sastanak', start: '10:00', end: '11:00' }, { title: 'Pisanje', start: '11:30', end: '11:00' }]],
  ])('%s → null', (_name, schedule) => {
    expect(acceptModelPlan(reply(schedule), req)).toBeNull();
  });

  it('nevaljan JSON → null', () => {
    expect(acceptModelPlan('nije json', req)).toBeNull();
    expect(acceptModelPlan('[]', req)).toBeNull();
  });
});

describe('llmModelFor (korak 20, odluka Borne 2026-11-09)', () => {
  const none = () => undefined;

  it('daje model po funkciji: parse-input Haiku 5.5, plan-day Sonnet 5.5', () => {
    expect(llmModelFor('parse-input', none)).toBe('claude-haiku-5-5');
    expect(llmModelFor('plan-day', none)).toBe('claude-sonnet-5-5');
  });

  it('ne koristi model koji se povlači 30. 11. 2026.', () => {
    expect(Object.values(LLM_MODELS)).not.toContain('claude-sonnet-4-5');
  });

  it('varijabla funkcije zamjenjuje model samo te funkcije', () => {
    const env: Record<string, string> = { LLM_MODEL_PLAN_DAY: ' claude-opus-5-5 ' };
    const read = (name: string) => env[name];
    expect(llmModelFor('plan-day', read)).toBe('claude-opus-5-5');
    expect(llmModelFor('parse-input', read)).toBe('claude-haiku-5-5');
  });

  it('prazna varijabla ne briše model', () => {
    expect(llmModelFor('parse-input', () => '  ')).toBe('claude-haiku-5-5');
  });
});
