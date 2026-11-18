import { describe, expect, it } from '@jest/globals';

import {
  buildMonthDiagnosis,
  isMonthFreshForWriting,
  parseMonthDiagnosis,
  periodStats,
  readWriteMonthReportResponse,
  type DayStats,
} from './index';

const stats = (date: string): DayStats => ({
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
});

const text = {
  version: 'llm-month-v1',
  summary: 'Bolji mjesec.',
  praise: [],
  noticed: [],
  problems: [],
  ideasWhy: 'Zato.',
};

describe('llm-month (korak 31d)', () => {
  it('svjež je mjesec samo zadnji dan i dan poslije', () => {
    expect(isMonthFreshForWriting('2026-11-30', '2026-11-29')).toBe(false);
    expect(isMonthFreshForWriting('2026-11-30', '2026-11-30')).toBe(true);
    expect(isMonthFreshForWriting('2026-11-30', '2026-12-01')).toBe(true);
    expect(isMonthFreshForWriting('2026-11-30', '2026-12-02')).toBe(false);
  });

  it('odgovor funkcije: valjan tekst ili null (tjedni oblik se ne prihvaća)', () => {
    expect(readWriteMonthReportResponse({ report: text })).toEqual(text);
    expect(readWriteMonthReportResponse({ report: { ...text, version: 'llm-week-v1' } })).toBeNull();
    expect(readWriteMonthReportResponse(null)).toBeNull();
  });

  it('pokvaren tekst ne ruši spremljenu mjesečnu dijagnozu; valjan ostaje', () => {
    const days = ['2026-11-02', '2026-11-03'].map((date) => ({ stats: stats(date), score: 50 }));
    const diagnosis = buildMonthDiagnosis(periodStats('2026-11-01', '2026-11-30', 30, days), null, days, {
      previousBest: null,
      changes: { accepted: 0, rejected: 0 },
    });
    const broken = parseMonthDiagnosis(JSON.parse(JSON.stringify({ ...diagnosis, llm: { summary: 1 } })));
    expect(broken).not.toBeNull();
    expect(broken?.llm).toBeUndefined();
    expect(parseMonthDiagnosis(JSON.parse(JSON.stringify({ ...diagnosis, llm: text })))?.llm).toEqual(text);
  });
});
