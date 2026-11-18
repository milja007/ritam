import { describe, expect, it } from '@jest/globals';

import { parseWriteReportRequest } from '../../../supabase/functions/_shared/report-logic';
import {
  buildDayDiagnosis,
  dayStats,
  isFreshForWriting,
  LLM_DAY_DIAGNOSIS_VERSION,
  parseDayDiagnosis,
  readWriteReportResponse,
  writeReportRequest,
  type DayStatsInput,
  type DiagnosisLine,
  type LlmDayText,
  type LlmPreviousReport,
} from './index';

const stats = (date: string, overrides: Partial<DayStatsInput> = {}) =>
  dayStats({
    date,
    blocks: [
      { id: 'a', title: 'Trening', kind: 'task', status: 'skipped', start: '18:00' },
      { id: 'b', title: 'Učenje', kind: 'task', status: 'done', start: '09:00' },
    ],
    items: [{ refId: 'a', outcome: 'not', comment: 'umoran' }],
    rules: [],
    ruleLogs: [],
    evening: { dayRating: 2, note: 'Dug dan' },
    morning: null,
    sleepSettings: null,
    xpEvents: [{ date, amount: 30 }],
    streak: 4,
    ...overrides,
  });

const render = (line: DiagnosisLine) => `T:${line.key}`;
const text: LlmDayText = {
  version: LLM_DAY_DIAGNOSIS_VERSION,
  summary: 'Dan.',
  praise: [],
  noticed: [],
  problems: [],
  ideas: ['Ideja.'],
};

describe('writeReportRequest (korak 31)', () => {
  const today = stats('2026-11-17');
  const yesterday = stats('2026-11-16');
  const diagnosis = buildDayDiagnosis(today, yesterday);
  const previousLocal: LlmPreviousReport = {
    date: '2026-11-16',
    diagnosis: buildDayDiagnosis(yesterday, null),
    helpful: false,
    comment: 'ne pomaže',
    suggestionAccepted: null,
  };
  const previousLlm: LlmPreviousReport = {
    date: '2026-11-15',
    diagnosis: { ...buildDayDiagnosis(stats('2026-11-15'), null), llm: { ...text, summary: 'Model.' } },
    helpful: true,
    comment: null,
    suggestionAccepted: true,
  };

  const request = writeReportRequest({
    date: '2026-11-17',
    locale: 'en',
    diagnosis,
    today,
    yesterday,
    history: [stats('2026-11-03'), yesterday, stats('2026-11-10'), stats('2026-11-18')],
    previous: [previousLlm, previousLocal],
    areas: ['plan'],
    renderLine: render,
  });

  it('danas i jučer u cijelosti, rezultat iz praćenih područja', () => {
    expect(request.trend).toBe(diagnosis.trend);
    expect(request.today).toMatchObject({
      date: '2026-11-17',
      score: 50,
      plan: { total: 2, done: 1, missed: 1 },
      comments: [{ title: 'Trening', outcome: 'not', comment: 'umoran' }],
      xp: 30,
      rating: 2,
      note: 'Dug dan',
      streak: 4,
      gaveUp: false,
    });
    expect(request.yesterday?.date).toBe('2026-11-16');
  });

  it('povijest: samo raniji dani, bez jučer, najnoviji prvo', () => {
    expect(request.history.map((day) => day.date)).toEqual(['2026-11-10', '2026-11-03']);
  });

  it('ranije dijagnoze: tekst koji je korisnik vidio i njegov odgovor', () => {
    expect(request.previous).toEqual([
      {
        date: '2026-11-16',
        summary: render(previousLocal.diagnosis.summary),
        ideas: previousLocal.diagnosis.ideas.map(render),
        helpful: false,
        comment: 'ne pomaže',
        suggestionAccepted: null,
      },
      {
        date: '2026-11-15',
        summary: 'Model.',
        ideas: ['Ideja.'],
        helpful: true,
        comment: null,
        suggestionAccepted: true,
      },
    ]);
  });

  it('server prihvaća zahtjev koji app složi (isti oblik)', () => {
    const parsed = parseWriteReportRequest(JSON.parse(JSON.stringify(request)));
    expect(parsed).not.toBeNull();
    expect(parsed?.today).toEqual(request.today);
    expect(parsed?.locale).toBe('en');
  });
});

describe('readWriteReportResponse', () => {
  it('prihvaća samo `{ report }` u ispravnom obliku', () => {
    expect(readWriteReportResponse({ report: text })).toEqual(text);
    expect(readWriteReportResponse({ report: null })).toBeNull();
    expect(readWriteReportResponse(text)).toBeNull();
    expect(readWriteReportResponse({ report: { ...text, ideas: [] } })).toBeNull();
    expect(readWriteReportResponse({ report: { ...text, version: 'llm-day-v0' } })).toBeNull();
    expect(readWriteReportResponse({ report: { ...text, summary: 'x'.repeat(241) } })).toBeNull();
  });

  it('dijagnoza s tekstom modela se čita; stara bez njega i dalje', () => {
    const diagnosis = buildDayDiagnosis(stats('2026-11-17'), null);
    expect(parseDayDiagnosis({ ...diagnosis, llm: text })?.llm).toEqual(text);
    expect(parseDayDiagnosis(diagnosis)?.llm).toBeUndefined();
    // Pokvaren tekst modela ne ruši lokalnu dijagnozu — samo otpada.
    const broken = parseDayDiagnosis({ ...diagnosis, llm: { summary: 1 } });
    expect(broken?.summary).toEqual(diagnosis.summary);
    expect(broken?.llm).toBeUndefined();
  });
});

describe('isFreshForWriting', () => {
  it('danas i jučer da; stariji dani iz arhive i budući ne', () => {
    expect(isFreshForWriting('2026-11-18', '2026-11-18')).toBe(true);
    expect(isFreshForWriting('2026-11-17', '2026-11-18')).toBe(true);
    expect(isFreshForWriting('2026-11-16', '2026-11-18')).toBe(false);
    expect(isFreshForWriting('2026-11-19', '2026-11-18')).toBe(false);
    expect(isFreshForWriting('2026-11-01', '2026-12-01')).toBe(false);
  });
});
