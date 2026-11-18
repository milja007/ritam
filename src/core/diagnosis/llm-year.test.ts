import { describe, expect, it } from '@jest/globals';

import { parseWriteYearReportRequest } from '../../../supabase/functions/_shared/report-logic';
import { addDays } from '../time/local-date';
import {
  buildYearDiagnosis,
  isYearFreshForWriting,
  parseYearDiagnosis,
  periodStats,
  readWriteYearReportResponse,
  writeYearReportRequest,
  type DayStats,
  type LlmYearText,
  type PeriodDay,
} from './index';

const day = (date: string, score: number): PeriodDay => {
  const stats: DayStats = {
    date,
    plan: { total: 2, done: 1, partial: 0, missed: 1, moved: 0, open: 0, rate: 0.5 },
    rules: { active: 0, kept: 0, broken: 0, brokenRules: [], activeWeight: 0, keptWeight: 0 },
    sleep: null,
    xp: 10,
    rating: null,
    note: null,
    streak: 1,
    comments: [],
    gaveUp: false,
    gaveUpNote: null,
    misses: [],
  };
  return { stats, score };
};

/** 150 dana od 1. 1. (do svibnja), rezultat raste po mjesecu. */
const days: PeriodDay[] = Array.from({ length: 150 }, (_, index) => {
  const date = addDays('2026-01-01', index) ?? '2026-01-01';
  return day(date, 50 + Number(date.slice(5, 7)) * 3);
});
const diagnosis = buildYearDiagnosis(periodStats('2026-01-01', '2026-12-31', 365, days), null, days);

const text: LlmYearText = {
  version: 'llm-year-v1',
  summary: 'Bolja godina.',
  praise: [],
  noticed: [],
  problems: [],
  ideasWhy: 'Zato.',
};

describe('llm-year (korak 31e)', () => {
  it('svježa je godina samo 31. 12. i 1. 1.', () => {
    expect(isYearFreshForWriting('2026-12-31', '2026-12-30')).toBe(false);
    expect(isYearFreshForWriting('2026-12-31', '2026-12-31')).toBe(true);
    expect(isYearFreshForWriting('2026-12-31', '2027-01-01')).toBe(true);
    expect(isYearFreshForWriting('2026-12-31', '2027-01-02')).toBe(false);
  });

  it('odgovor funkcije: valjan tekst ili null (mjesečni oblik se ne prihvaća)', () => {
    expect(readWriteYearReportResponse({ report: text })).toEqual(text);
    expect(readWriteYearReportResponse({ report: { ...text, version: 'llm-month-v1' } })).toBeNull();
    expect(readWriteYearReportResponse({})).toBeNull();
  });

  it('pokvaren tekst ne ruši spremljenu godišnju dijagnozu; valjan ostaje', () => {
    const broken = parseYearDiagnosis(JSON.parse(JSON.stringify({ ...diagnosis, llm: { summary: 1 } })));
    expect(broken).not.toBeNull();
    expect(broken?.llm).toBeUndefined();
    expect(parseYearDiagnosis(JSON.parse(JSON.stringify({ ...diagnosis, llm: text })))?.llm).toEqual(text);
  });

  it('zahtjev: 12 mjeseci s prosjekom i sažetkom, smjer, ranije godine; server ga prihvaća', () => {
    const previousDiagnosis = { ...diagnosis, year: '2025', start: '2025-01-01', end: '2025-12-31', llm: text };
    const req = writeYearReportRequest({
      locale: 'hr',
      diagnosis,
      current: periodStats('2026-01-01', '2026-12-31', 365, days),
      previous: null,
      monthSummaries: [{ month: '2026-03', summary: 'Ožujak je držao.' }],
      previousReports: [
        { start: '2026-01-01', diagnosis, helpful: null, comment: null },
        { start: '2025-01-01', diagnosis: previousDiagnosis, helpful: false, comment: 'Preopćenito.' },
      ],
      renderLine: (line) => line.key,
    });
    expect(req.months).toHaveLength(12);
    expect(req.months[2]).toEqual({ month: '2026-03', average: 59, summary: 'Ožujak je držao.' });
    expect(req.months[11]).toEqual({ month: '2026-12', average: null, summary: null });
    expect(req.ideas).toEqual(diagnosis.ideas.map((line) => line.key));
    expect(req.previous).toEqual([
      {
        date: '2025-01-01',
        summary: 'Bolja godina.',
        ideas: diagnosis.ideas.map((line) => line.key),
        helpful: false,
        comment: 'Preopćenito.',
        suggestionAccepted: null,
      },
    ]);
    const parsed = parseWriteYearReportRequest(JSON.parse(JSON.stringify(req)));
    expect(parsed?.year.recorded).toBe(150);
    expect(parsed?.months).toHaveLength(12);
  });
});
