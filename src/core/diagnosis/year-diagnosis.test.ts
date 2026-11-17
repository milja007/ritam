import { describe, expect, it } from '@jest/globals';

import { addDays } from '../time/local-date';
import {
  buildYearDiagnosis,
  earlierYearAverages,
  isYearDiagnosisReady,
  isYearLastDay,
  longestClosedRun,
  monthPattern,
  parseYearDiagnosis,
  periodStats,
  YEAR_LINE_KEYS,
  yearBounds,
  yearChanges,
  yearHalvesPattern,
  yearMonthAverages,
  type DayStats,
  type PeriodDay,
} from './index';

const YEAR = '2026';
const PREV = '2025';

function day(date: string, score: number | null = 70, broken: string[] = []): PeriodDay {
  const stats: DayStats = {
    date,
    plan: { total: 4, done: 4, partial: 0, missed: 0, moved: 0, open: 0, rate: 1 },
    rules: {
      active: broken.length,
      kept: 0,
      broken: broken.length,
      brokenRules: broken.map((title) => ({ title, weight: 1, trigger: null })),
      activeWeight: broken.length,
      keptWeight: 0,
    },
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
}

/** Svi dani godine od `from` (uključivo) `count` dana; `score` može ovisiti o datumu. */
function run(from: string, count: number, score: (date: string) => number | null = () => 70): PeriodDay[] {
  return Array.from({ length: count }, (_, index) => {
    const date = addDays(from, index) ?? from;
    return day(date, score(date));
  });
}

const stats = (year: string, input: readonly PeriodDay[]) => {
  const bounds = yearBounds(year);
  if (bounds === null) throw new Error('bad year');
  return periodStats(bounds.start, bounds.end, bounds.length, input);
};

const scored = (input: readonly PeriodDay[]) =>
  input.flatMap((entry) => (entry.score === null ? [] : [{ date: entry.stats.date, score: entry.score }]));

describe('granice i dostupnost godine', () => {
  it('yearBounds pazi na prijestupnu godinu', () => {
    expect(yearBounds('2026')).toEqual({ start: '2026-01-01', end: '2026-12-31', length: 365 });
    expect(yearBounds('2028')?.length).toBe(366);
    expect(yearBounds('26')).toBeNull();
  });

  it('isYearLastDay samo za 31. 12.', () => {
    expect(isYearLastDay('2026-12-31')).toBe(true);
    expect(isYearLastDay('2026-12-30')).toBe(false);
    expect(isYearLastDay('2026-11-30')).toBe(false);
  });

  it('dostupna kad godina prođe ili 31. 12. nakon večernjeg upita; treba zaključen dan', () => {
    expect(isYearDiagnosisReady(YEAR, '2026-12-31', ['2026-03-01'])).toBe(false);
    expect(isYearDiagnosisReady(YEAR, '2026-12-31', ['2026-03-01', '2026-12-31'])).toBe(true);
    expect(isYearDiagnosisReady(YEAR, '2027-01-02', ['2026-03-01'])).toBe(true);
    expect(isYearDiagnosisReady(YEAR, '2027-01-02', ['2025-12-31', '2027-01-01'])).toBe(false);
    expect(isYearDiagnosisReady('x', '2027-01-02', ['2026-03-01'])).toBe(false);
  });
});

describe('uzorci godine', () => {
  it('najjači i najslabiji mjesec kad jasno odstupaju', () => {
    // Siječanj–ožujak po 10 dana: 50, 70, 90.
    const input = [
      ...run('2026-01-01', 10, () => 50),
      ...run('2026-02-01', 10, () => 70),
      ...run('2026-03-01', 10, () => 90),
    ];
    const lines = monthPattern(YEAR, scored(input));
    expect(lines).toEqual([
      { key: 'noticed.month.strong', params: { strongMonth: '2026-03', average: 90, overall: 70 } },
      { key: 'noticed.month.weak', params: { weakMonth: '2026-01', average: 50, overall: 70 } },
    ]);
  });

  it('bez usporedbe mjeseci s premalo ubrojenih mjeseci ili dana', () => {
    expect(monthPattern(YEAR, scored([...run('2026-01-01', 10, () => 50), ...run('2026-02-01', 10, () => 90)]))).toEqual([]);
    expect(
      monthPattern(YEAR, scored([...run('2026-01-01', 4, () => 10), ...run('2026-02-01', 10), ...run('2026-03-01', 10), ...run('2026-04-01', 10)])),
    ).toEqual([]);
  });

  it('najduži niz zaključenih dana preko granice mjeseca; kratki niz se ne spominje', () => {
    const dates = [...run('2026-01-28', 9).map((entry) => entry.stats.date), '2026-03-01', '2026-03-02'];
    expect(longestClosedRun(dates)).toEqual({ startDate: '2026-01-28', days: 9 });
    expect(longestClosedRun(['2026-01-01', '2026-01-02'])).toBeNull();
    expect(longestClosedRun([])).toBeNull();
  });

  it('prva naspram druge polovice godine', () => {
    const up = [...run('2026-02-01', 25, () => 50), ...run('2026-09-01', 25, () => 80)];
    expect(yearHalvesPattern(scored(up))).toEqual({ key: 'noticed.halves.up', params: { first: 50, second: 80 } });
    const down = [...run('2026-02-01', 25, () => 80), ...run('2026-09-01', 25, () => 50)];
    expect(yearHalvesPattern(scored(down))?.key).toBe('noticed.halves.down');
    expect(yearHalvesPattern(scored([...run('2026-02-01', 25), ...run('2026-09-01', 10, () => 20)]))).toBeNull();
  });

  it('prosjeci po mjesecu (12 vrijednosti, null bez rezultata)', () => {
    const averages = yearMonthAverages(YEAR, scored([...run('2026-01-01', 2, () => 60), ...run('2026-12-30', 2, () => 81)]));
    expect(averages).toHaveLength(12);
    expect(averages[0]).toBe(60);
    expect(averages[1]).toBeNull();
    expect(averages[11]).toBe(81);
  });

  it('tjedne promjene cijele godine, konkretne ideje', () => {
    expect(
      yearChanges(YEAR, [
        { start: '2025-12-29', suggestion: 'ideas.bedEarlier', accepted: true, idea: 'a' },
        { start: '2026-03-02', suggestion: 'ideas.ruleTrigger', accepted: false, idea: 'x' },
        { start: '2026-09-07', suggestion: 'ideas.ruleTrigger', accepted: true, idea: 'y' },
        { start: '2027-01-04', suggestion: 'ideas.rule', accepted: true, idea: 'z' },
      ]),
    ).toEqual({ accepted: 1, rejected: 1 });
  });

  it('ranije ubrojene godine', () => {
    const final = (date: string, score: number) => ({ date, score, final: true });
    const many = run('2025-01-01', 130).map((entry) => final(entry.stats.date, 64));
    expect(earlierYearAverages([...many, final('2024-05-05', 99), final('2026-01-01', 99)], YEAR)).toEqual([64]);
  });
});

describe('buildYearDiagnosis', () => {
  it('prva godina: bez usporedbe, sekcije nikad prazne, valjane po shemi', () => {
    const input = run('2026-01-01', 365);
    const diagnosis = buildYearDiagnosis(stats(YEAR, input), null, input);
    expect(diagnosis).toMatchObject({ year: YEAR, start: '2026-01-01', end: '2026-12-31', trend: 'first' });
    expect(diagnosis.summary.key).toBe('summary.first');
    for (const section of [diagnosis.praise, diagnosis.noticed, diagnosis.problems, diagnosis.ideas]) {
      expect(section.length).toBeGreaterThan(0);
    }
    expect(diagnosis.praise.map((line) => line.key)).toContain('praise.allDays');
    expect(diagnosis.noticed.map((line) => line.key)).toContain('noticed.run');
    expect(diagnosis.months).toHaveLength(12);
    expect(parseYearDiagnosis(JSON.parse(JSON.stringify(diagnosis)))).toEqual(diagnosis);
  });

  it('uspoređuje s prošlom godinom, rekord, mjeseci i polovice', () => {
    const before = run('2025-01-01', 200, () => 55);
    const now = [...run('2026-01-01', 150, () => 60), ...run('2026-07-01', 150, () => 85)];
    const diagnosis = buildYearDiagnosis(stats(YEAR, now), stats(PREV, before), now, { previousBest: 60, changes: { accepted: 2, rejected: 1 } });
    expect(diagnosis.trend).toBe('better');
    expect(diagnosis.praise[0]?.key).toBe('praise.record');
    const noticed = diagnosis.noticed.map((line) => line.key);
    expect(noticed).toEqual(expect.arrayContaining(['noticed.halves.up', 'noticed.changes', 'noticed.month.strong']));
    expect(diagnosis.noticed.length).toBeLessThanOrEqual(8);
    expect(diagnosis.progress.find((row) => row.metric === 'average')).toMatchObject({ previous: 55, change: 'up' });
  });

  it('malo dana → slika godine nepotpuna, ideja: večernji upit; najviše dvije ideje', () => {
    const input = [...run('2026-01-01', 30, () => 40), ...Array.from({ length: 20 }, (_, i) => day(`2026-06-${String(i + 1).padStart(2, '0')}`, 40, ['Mobitel']))];
    const diagnosis = buildYearDiagnosis(stats(YEAR, input), null, input);
    expect(diagnosis.problems.map((line) => line.key)).toContain('problems.fewDays');
    expect(diagnosis.ideas.length).toBeGreaterThanOrEqual(1);
    expect(diagnosis.ideas.length).toBeLessThanOrEqual(2);
    expect(diagnosis.ideas[0]?.key).toBe('ideas.fillCheckin');
  });

  it('nevaljan JSON se ne prihvaća', () => {
    expect(parseYearDiagnosis({ version: 'local-month-v1' })).toBeNull();
    expect(parseYearDiagnosis(null)).toBeNull();
  });

  it('svaki ključ retka je jedinstven i bez tjednih redaka praćenja', () => {
    expect(new Set(YEAR_LINE_KEYS).size).toBe(YEAR_LINE_KEYS.length);
    expect(YEAR_LINE_KEYS.some((key) => key.startsWith('followUp.') || key.startsWith('ideas.stay.'))).toBe(false);
  });
});
