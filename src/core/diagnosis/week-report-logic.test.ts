import { describe, expect, it } from '@jest/globals';

import { EXAMPLE_WEEK_EVENINGS } from '../../../supabase/functions/_shared/report-examples';
import {
  acceptModelWeekReport,
  buildWeekReportSystemPrompt,
  buildWeekReportUserMessage,
  parseWriteReportRequest,
  parseWriteWeekReportRequest,
  REPORT_LIMITS,
  WEEK_REPORT_PROMPT_VERSION,
} from '../../../supabase/functions/_shared/report-logic';

const clone = <T>(value: T): T => JSON.parse(JSON.stringify(value)) as T;
type Mutable = Record<string, unknown> & { week: Record<string, unknown> };

describe('write-report tjedan — zahtjev (korak 31c)', () => {
  it('primjer prolazi i zadržava trackere, promjenu tjedna i ranije dijagnoze', () => {
    const req = parseWriteWeekReportRequest(clone(EXAMPLE_WEEK_EVENINGS));
    expect(req).not.toBeNull();
    expect(req?.week.calories).toEqual({ days: 5, within: 2, over: 3, under: 0 });
    expect(req?.week.money?.spentCents).toBe(6200);
    expect(req?.idea).toEqual({ text: 'Prebaci jednu večernju aktivnost na jutro ili popodne.', carried: false });
    expect(req?.previous).toHaveLength(1);
    expect(req?.days).toHaveLength(3);
  });

  it('bez ponedjeljka, trenda ili valjanog tjedna → null; dnevni parser ga ne prihvaća', () => {
    const notMonday = { ...clone(EXAMPLE_WEEK_EVENINGS), start: '2026-11-10' };
    expect(parseWriteWeekReportRequest(notMonday)).toBeNull();
    expect(parseWriteWeekReportRequest({ ...clone(EXAMPLE_WEEK_EVENINGS), trend: 'nešto' })).toBeNull();
    const badWeek = clone(EXAMPLE_WEEK_EVENINGS) as unknown as Mutable;
    badWeek.week.recorded = 9;
    expect(parseWriteWeekReportRequest(badWeek)).toBeNull();
    const otherStart = clone(EXAMPLE_WEEK_EVENINGS) as unknown as Mutable;
    otherStart.week.start = '2026-11-02';
    expect(parseWriteWeekReportRequest(otherStart)).toBeNull();
    expect(parseWriteWeekReportRequest({ ...clone(EXAMPLE_WEEK_EVENINGS), period: 'day' })).toBeNull();
    expect(parseWriteReportRequest(clone(EXAMPLE_WEEK_EVENINGS))).toBeNull();
  });

  it('dani izvan tjedna, prošli tjedan koji nije prije i kasnije dijagnoze otpadaju; nevaljani trackeri → null', () => {
    const raw = clone(EXAMPLE_WEEK_EVENINGS) as unknown as Mutable;
    (raw.days as unknown[]).push({ date: '2026-11-16', score: 50, rating: null, comments: [], broken: [] });
    (raw.previous as unknown[]).push({ date: '2026-11-09', summary: 'Ovaj tjedan', ideas: [], helpful: null });
    (raw.previousWeek as Record<string, unknown>).end = '2026-11-12';
    raw.week.calories = { days: 9, within: 0, over: 0, under: 0 };
    const req = parseWriteWeekReportRequest(raw);
    expect(req?.days.map((d) => d.date)).toEqual(['2026-11-10', '2026-11-11', '2026-11-14']);
    expect(req?.previous.map((p) => p.date)).toEqual(['2026-11-02']);
    expect(req?.previousWeek).toBeNull();
    expect(req?.week.calories).toBeNull();
  });

  it('bez promjene tjedna → idea null („zadrži ritam“)', () => {
    const req = parseWriteWeekReportRequest({ ...clone(EXAMPLE_WEEK_EVENINGS), idea: null });
    expect(req?.idea).toBeNull();
    expect(buildWeekReportUserMessage(req!)).toContain('zadrži ritam');
  });
});

describe('write-report tjedan — prompt llm-week-v1', () => {
  it('uputa kaže da model ne mijenja promjenu tjedna i traži ideaWhy, na jeziku korisnika', () => {
    const hr = buildWeekReportSystemPrompt('hr');
    expect(hr).toContain('TJEDNU');
    expect(hr).toContain('NE mijenjaj');
    expect(hr).toContain('"ideaWhy"');
    expect(hr).toContain('hrvatskom');
    expect(buildWeekReportSystemPrompt('en')).toContain('engleskom');
  });

  it('poruka ima tjedan, uzorke po dobu dana, trackere, dane, prošli tjedan, promjenu i povratnu informaciju', () => {
    const message = buildWeekReportUserMessage(parseWriteWeekReportRequest(clone(EXAMPLE_WEEK_EVENINGS))!);
    expect(message).toContain('2026-11-09 – 2026-11-15');
    expect(message).toContain('večer 6');
    expect(message).toContain('"Trening" 3×');
    expect(message).toContain('Kalorije (dani s unosom 5): unutar cilja 2, iznad 3');
    expect(message).toContain('62.00 €');
    expect(message).toContain('2026-11-10 (utorak)');
    expect(message).toContain('PROŠLI TJEDAN (2026-11-02)');
    expect(message).toContain('"Prebaci jednu večernju aktivnost na jutro ili popodne."');
    expect(message).toContain('korisnik: Nije pomoglo');
    expect(message).toContain('promjena: Probat ću');
  });
});

describe('write-report tjedan — odgovor modela', () => {
  const ok = {
    summary: 'Tjedan je bio isti kao prošli, a večeri su i dalje mjesto gdje plan pada.',
    praise: ['Subota je bila najbolji dan tjedna.'],
    noticed: ['Šest od osam propusta je navečer.'],
    problems: [],
    ideaWhy: 'Lakša večer nije pomogla, pa je bolje večernju stvar odmah premjestiti ranije.',
  };

  it('prihvaća valjan odgovor (i u ```json bloku), dodaje verziju', () => {
    const text = acceptModelWeekReport('```json\n' + JSON.stringify(ok) + '\n```');
    expect(text).toEqual({ version: WEEK_REPORT_PROMPT_VERSION, ...ok });
  });

  it('ideaWhy je neobavezan; predug redak, krivi tip ili bez summaryja → null', () => {
    expect(acceptModelWeekReport(JSON.stringify({ ...ok, ideaWhy: undefined }))?.ideaWhy).toBeNull();
    expect(acceptModelWeekReport(JSON.stringify({ ...ok, ideaWhy: 'x'.repeat(REPORT_LIMITS.line + 1) }))).toBeNull();
    expect(acceptModelWeekReport(JSON.stringify({ ...ok, praise: 'jedna' }))).toBeNull();
    expect(acceptModelWeekReport(JSON.stringify({ ...ok, summary: '' }))).toBeNull();
    expect(acceptModelWeekReport('nije json')).toBeNull();
  });

  it('višak redaka se reže na granice', () => {
    const many = ['a', 'b', 'c', 'd', 'e'];
    const text = acceptModelWeekReport(JSON.stringify({ ...ok, praise: many, noticed: many, problems: many }));
    expect(text?.praise).toHaveLength(REPORT_LIMITS.praise);
    expect(text?.noticed).toHaveLength(REPORT_LIMITS.noticed);
    expect(text?.problems).toHaveLength(REPORT_LIMITS.problems);
  });
});
