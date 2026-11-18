import { describe, expect, it } from '@jest/globals';

import { EXAMPLE_MONTH_THURSDAYS, EXAMPLE_YEAR_SUMMER_DIP } from '../../../supabase/functions/_shared/report-examples';
import {
  acceptModelYearReport,
  buildYearReportSystemPrompt,
  buildYearReportUserMessage,
  parseWriteMonthReportRequest,
  parseWriteYearReportRequest,
  YEAR_REPORT_PROMPT_VERSION,
} from '../../../supabase/functions/_shared/report-logic';

const clone = <T>(value: T): T => JSON.parse(JSON.stringify(value)) as T;
type Mutable = Record<string, unknown> & { year: Record<string, unknown> & { plan: Record<string, unknown> } };

describe('write-report godina — zahtjev (korak 31e)', () => {
  it('primjer prolazi: godina s više od 5000 blokova, mjeseci, smjer, tjedne promjene', () => {
    const req = parseWriteYearReportRequest(clone(EXAMPLE_YEAR_SUMMER_DIP));
    expect(req?.year.recorded).toBe(281);
    expect(req?.year.plan.total).toBe(5820);
    expect(req?.year.repeatedMisses).toEqual([{ title: 'Trening', count: 74 }]);
    expect(req?.months.map((m) => m.month)).toEqual(['2026-01', '2026-07', '2026-10']);
    expect(req?.ideas).toHaveLength(2);
    expect(req?.changes).toEqual({ accepted: 31, rejected: 12 });
    expect(req?.previous).toHaveLength(1);
  });

  it('start mora biti 1. 1., statistika do 31. 12.; mjesečni parser je ne prihvaća ni obrnuto', () => {
    expect(parseWriteYearReportRequest({ ...clone(EXAMPLE_YEAR_SUMMER_DIP), start: '2026-02-01' })).toBeNull();
    const wrongEnd = clone(EXAMPLE_YEAR_SUMMER_DIP) as unknown as Mutable;
    wrongEnd.year.end = '2026-12-30';
    expect(parseWriteYearReportRequest(wrongEnd)).toBeNull();
    const tooMany = clone(EXAMPLE_YEAR_SUMMER_DIP) as unknown as Mutable;
    tooMany.year.recorded = 367;
    expect(parseWriteYearReportRequest(tooMany)).toBeNull();
    const absurd = clone(EXAMPLE_YEAR_SUMMER_DIP) as unknown as Mutable;
    absurd.year.plan.total = 1_000_000;
    expect(parseWriteYearReportRequest(absurd)).toBeNull();
    expect(parseWriteMonthReportRequest(clone(EXAMPLE_YEAR_SUMMER_DIP))).toBeNull();
    expect(parseWriteYearReportRequest(clone(EXAMPLE_MONTH_THURSDAYS))).toBeNull();
  });

  it('mjeseci druge godine i ponovljeni otpadaju, ostali po redu; kasnije dijagnoze i višak ideja otpadaju', () => {
    const raw = clone(EXAMPLE_YEAR_SUMMER_DIP) as unknown as Mutable;
    raw.months = [
      { month: '2026-10', average: 82, summary: 'listopad' },
      { month: '2025-12', average: 50, summary: 'prošla' },
      { month: '2026-10', average: 10, summary: 'duplikat' },
      { month: '2026-13', average: 50, summary: 'nema' },
      { month: '2026-03', average: null, summary: null },
      { month: '2026-04', average: 101, summary: 'krivi prosjek' },
    ];
    raw.ideas = ['a', 'b', 'c'];
    raw.previous = [{ date: '2026-01-01', summary: 'ista', ideas: [] }, { date: '2025-01-01', summary: 'prošla', ideas: [] }];
    raw.changes = { accepted: 61, rejected: 'x' };
    const req = parseWriteYearReportRequest(raw);
    expect(req?.months).toEqual([
      { month: '2026-03', average: null, summary: null },
      { month: '2026-10', average: 82, summary: 'listopad' },
    ]);
    expect(req?.ideas).toEqual(['a', 'b']);
    expect(req?.previous.map((p) => p.date)).toEqual(['2025-01-01']);
    expect(req?.changes).toEqual({ accepted: 0, rejected: 0 });
  });
});

describe('write-report godina — prompt llm-year-v1', () => {
  it('uputa: godišnja, smjer se ne mijenja, ideasWhy', () => {
    const prompt = buildYearReportSystemPrompt('en');
    expect(prompt).toContain('GODIŠNJU');
    expect(prompt).toContain('NE mijenjaj');
    expect(prompt).toContain('"ideasWhy"');
    expect(prompt).toContain('engleskom');
  });

  it('poruka ima godinu s 365 dana, mjesece sa sažecima, smjer, promjene i prošlu dijagnozu', () => {
    const message = buildYearReportUserMessage(parseWriteYearReportRequest(clone(EXAMPLE_YEAR_SUMMER_DIP))!);
    expect(message).toContain('Zaključeni dani: 281/365');
    expect(message).toContain('- 2026-07: prosjek 51/100 · "Ljeto bez ritma — puno premještenih dana."');
    expect(message).toContain('"Ljeti planiraj manje, ali svaki dan."');
    expect(message).toContain('prihvaćeno 31, odbijeno 12');
    expect(message).toContain('godina 2025: "Godina s puno početaka."');
    expect(message).toContain('korisnik: Nije pomoglo — "Preopćenito."');
    expect(message).toContain('4100.00 €');
  });
});

describe('write-report godina — odgovor modela', () => {
  const ok = {
    summary: 'Godina je bila bolja od prošle, a ljeto ostaje najslabiji dio.',
    praise: ['Jesen je bila najjača.'],
    noticed: ['U srpnju se najviše premještalo.'],
    problems: [],
    ideasWhy: 'Manje, ali svaki dan čuva ritam i ljeti.',
  };

  it('prihvaća valjan odgovor s verzijom godine; krivi oblik → null', () => {
    expect(acceptModelYearReport(JSON.stringify(ok))).toEqual({ version: YEAR_REPORT_PROMPT_VERSION, ...ok });
    expect(acceptModelYearReport('```json\n' + JSON.stringify({ ...ok, ideasWhy: null }) + '\n```')?.ideasWhy).toBeNull();
    expect(acceptModelYearReport(JSON.stringify({ ...ok, praise: 'x' }))).toBeNull();
    expect(acceptModelYearReport('nije json')).toBeNull();
  });
});
