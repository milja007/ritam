import { describe, expect, it } from '@jest/globals';

import {
  buildMonthDiagnosis,
  earlierMonthAverages,
  halvesPattern,
  isMonthDiagnosisReady,
  MONTH_LINE_KEYS,
  monthBounds,
  monthChanges,
  parseMonthDiagnosis,
  periodStats,
  weekdayPattern,
  type DayStats,
  type PeriodDay,
} from './index';

const MONTH = '2026-11'; // 1. 11. 2026. je nedjelja; ponedjeljci su 2., 9., 16., 23., 30.
const PREV = '2026-10';

type DayIn = {
  score?: number | null;
  done?: number;
  total?: number;
  moved?: number;
  broken?: { title: string; weight?: number; trigger?: string | null }[];
  sleep?: number | null;
};

function day(date: string, input: DayIn = {}): PeriodDay {
  const total = input.total ?? 4;
  const done = input.done ?? total;
  const broken = (input.broken ?? []).map((rule) => ({ title: rule.title, weight: rule.weight ?? 1, trigger: rule.trigger ?? null }));
  const stats: DayStats = {
    date,
    plan: { total, done, partial: 0, missed: total - done, moved: input.moved ?? 0, open: 0, rate: total > 0 ? done / total : null },
    rules: { active: broken.length, kept: 0, broken: broken.length, brokenRules: broken, activeWeight: broken.length, keptWeight: 0 },
    sleep: input.sleep == null ? null : { minutes: input.sleep, onTarget: null, deviationMinutes: null },
    xp: 10,
    rating: null,
    note: null,
    streak: 1,
    comments: [],
    gaveUp: false,
    gaveUpNote: null,
    misses: [],
  };
  return { stats, score: input.score === undefined ? 70 : input.score };
}

const date = (month: string, dayOfMonth: number) => `${month}-${String(dayOfMonth).padStart(2, '0')}`;
/** Dani `from`–`to` mjeseca; `input` može ovisiti o danu. */
const days = (month: string, from: number, to: number, input: (dayOfMonth: number) => DayIn = () => ({})) =>
  Array.from({ length: to - from + 1 }, (_, i) => day(date(month, from + i), input(from + i)));

const stats = (month: string, input: readonly PeriodDay[]) => {
  const bounds = monthBounds(month);
  if (bounds === null) throw new Error('bad month');
  return periodStats(bounds.start, bounds.end, bounds.length, input);
};

describe('monthBounds i isMonthDiagnosisReady', () => {
  it('granice mjeseca, i prijestupna veljača', () => {
    expect(monthBounds('2026-11')).toEqual({ start: '2026-11-01', end: '2026-11-30', length: 30 });
    expect(monthBounds('2028-02')).toEqual({ start: '2028-02-01', end: '2028-02-29', length: 29 });
    expect(monthBounds('2026-13')).toBeNull();
    expect(monthBounds('2026-1')).toBeNull();
  });

  it('dostupna je kad mjesec prođe ili zadnji dan nakon večernjeg upita', () => {
    const some = ['2026-11-10', '2026-11-11'];
    expect(isMonthDiagnosisReady(MONTH, '2026-11-20', some)).toBe(false);
    expect(isMonthDiagnosisReady(MONTH, '2026-11-30', some)).toBe(false);
    expect(isMonthDiagnosisReady(MONTH, '2026-11-30', [...some, '2026-11-30'])).toBe(true);
    expect(isMonthDiagnosisReady(MONTH, '2026-12-01', some)).toBe(true);
    expect(isMonthDiagnosisReady(MONTH, '2026-12-01', ['2026-10-31', '2026-12-01'])).toBe(false);
    expect(isMonthDiagnosisReady('nije', '2026-12-01', some)).toBe(false);
  });
});

describe('monthChanges', () => {
  it('broji različite prijedloge tjedana koji počinju u mjesecu; prenesena promjena jednom', () => {
    const changes = monthChanges(MONTH, [
      { start: '2026-10-26', suggestion: 'ideas.rule', accepted: true }, // tjedan počinje u listopadu
      { start: '2026-11-02', suggestion: 'ideas.bedEarlier', accepted: true },
      { start: '2026-11-09', suggestion: 'ideas.bedEarlier', accepted: true }, // prenesena
      { start: '2026-11-16', suggestion: 'ideas.smallerPlan', accepted: false },
      { start: '2026-11-23', suggestion: 'ideas.fewerMoves', accepted: null }, // bez odgovora
      { start: '2026-11-30', suggestion: null, accepted: null },
    ]);
    expect(changes).toEqual({ accepted: 1, rejected: 1 });
  });

  it('prihvaćanje ima prednost pred ranijim odbijanjem istog prijedloga', () => {
    expect(
      monthChanges(MONTH, [
        { start: '2026-11-02', suggestion: 'ideas.rule', accepted: false },
        { start: '2026-11-23', suggestion: 'ideas.rule', accepted: true },
      ]),
    ).toEqual({ accepted: 1, rejected: 0 });
  });
});

describe('uzorci mjeseca', () => {
  const scored = (input: readonly PeriodDay[]) =>
    input.flatMap((entry) => (entry.score === null ? [] : [{ date: entry.stats.date, score: entry.score }]));

  it('najslabiji i najjači dan u tjednu kad jasno odstupaju od prosjeka', () => {
    // Ponedjeljci (2., 9., 16., 23.) 30, subote (7., 14., 21., 28.) 100, ostalo 70.
    const input = days(MONTH, 2, 28, (d) => ({ score: d % 7 === 2 ? 30 : d % 7 === 0 ? 100 : 70 }));
    const lines = weekdayPattern(scored(input));
    expect(lines.map((line) => line.key)).toEqual(['noticed.weekday.weak', 'noticed.weekday.strong']);
    expect(lines[0]?.params).toMatchObject({ weakWeekday: '2026-11-02', average: 30 });
    expect(lines[1]?.params).toMatchObject({ strongWeekday: '2026-11-07', average: 100 });
  });

  it('bez uzorka kad su dani ujednačeni ili ih je premalo', () => {
    expect(weekdayPattern(scored(days(MONTH, 2, 28)))).toEqual([]);
    expect(weekdayPattern(scored(days(MONTH, 2, 6, (d) => ({ score: d * 10 }))))).toEqual([]);
  });

  it('prva naspram druge polovice mjeseca', () => {
    const up = days(MONTH, 1, 30, (d) => ({ score: d < 16 ? 50 : 80 }));
    expect(halvesPattern(scored(up))).toEqual({ key: 'noticed.halves.up', params: { first: 50, second: 80 } });
    const down = days(MONTH, 1, 30, (d) => ({ score: d < 16 ? 80 : 50 }));
    expect(halvesPattern(scored(down))?.key).toBe('noticed.halves.down');
    expect(halvesPattern(scored(days(MONTH, 1, 30)))).toBeNull();
    expect(halvesPattern(scored(days(MONTH, 1, 17, (d) => ({ score: d < 16 ? 50 : 90 }))))).toBeNull(); // 2 dana u drugoj polovici
  });
});

describe('buildMonthDiagnosis', () => {
  it('prvi mjesec: bez usporedbe, sekcije nikad prazne, valjane po shemi', () => {
    const input = days(MONTH, 1, 30);
    const diagnosis = buildMonthDiagnosis(stats(MONTH, input), null, input);
    expect(diagnosis).toMatchObject({ month: MONTH, start: '2026-11-01', end: '2026-11-30', trend: 'first' });
    expect(diagnosis.summary.key).toBe('summary.first');
    for (const section of [diagnosis.praise, diagnosis.noticed, diagnosis.problems, diagnosis.ideas]) {
      expect(section.length).toBeGreaterThan(0);
    }
    expect(diagnosis.praise.map((line) => line.key)).toContain('praise.allDays');
    expect(diagnosis.noticed).toEqual([{ key: 'noticed.none' }]);
    expect(diagnosis.ideas).toEqual([{ key: 'ideas.keepRhythm' }]);
    expect(diagnosis.progress.map((row) => row.metric)).not.toContain('betterWeeks');
    expect(parseMonthDiagnosis(JSON.parse(JSON.stringify(diagnosis)))).toEqual(diagnosis);
  });

  it('uspoređuje s prošlim mjesecom i prepoznaje rekord', () => {
    const before = days(PREV, 1, 31, () => ({ score: 55 }));
    const now = days(MONTH, 1, 30, () => ({ score: 75 }));
    const diagnosis = buildMonthDiagnosis(stats(MONTH, now), stats(PREV, before), now, { previousBest: 60 });
    expect(diagnosis.trend).toBe('better');
    expect(diagnosis.summary).toEqual({ key: 'summary.better', params: { average: 75, days: 30, previous: 55, diff: 20 } });
    expect(diagnosis.praise[0]).toEqual({ key: 'praise.record', params: { average: 75 } });
    expect(diagnosis.progress.find((row) => row.metric === 'average')).toMatchObject({ value: 75, previous: 55, change: 'up' });
  });

  it('najviše dvije ideje, najvažnija prva; „zadrži ritam“ samo kad nema druge', () => {
    const input = days(MONTH, 1, 30, (d) => ({
      done: 1,
      total: 4,
      sleep: 300,
      moved: 1,
      broken: d <= 6 ? [{ title: 'Šećer', trigger: 'stres' }] : [],
    }));
    const diagnosis = buildMonthDiagnosis(stats(MONTH, input), null, input);
    expect(diagnosis.ideas.map((line) => line.key)).toEqual(['ideas.ruleTrigger', 'ideas.smallerPlan']);
    expect(diagnosis.problems.map((line) => line.key)).toEqual(
      expect.arrayContaining(['problems.lowPlan', 'problems.shortSleep']),
    );
  });

  it('pragovi su mjesečni: tri prekršaja u mjesecu nisu ni uzorak ni problem', () => {
    const input = days(MONTH, 1, 30, (d) => ({ broken: d <= 3 ? [{ title: 'Šećer' }] : [] }));
    const diagnosis = buildMonthDiagnosis(stats(MONTH, input), null, input);
    expect(diagnosis.noticed.map((line) => line.key)).not.toContain('noticed.rule');
    expect(diagnosis.problems).toEqual([{ key: 'problems.none' }]);
  });

  it('premalo zaključenih dana: slika je nepotpuna i prva ideja je večernji upit', () => {
    const input = days(MONTH, 1, 6);
    const diagnosis = buildMonthDiagnosis(stats(MONTH, input), null, input);
    expect(diagnosis.problems[0]).toEqual({ key: 'problems.fewDays', params: { days: 6, length: 30 } });
    expect(diagnosis.ideas[0]?.key).toBe('ideas.fillCheckin');
  });

  it('pregled promjena iz tjednih dijagnoza ide prvi u „Što smo primijetili“', () => {
    const input = days(MONTH, 1, 30);
    const diagnosis = buildMonthDiagnosis(stats(MONTH, input), null, input, { changes: { accepted: 2, rejected: 1 } });
    expect(diagnosis.noticed[0]).toEqual({ key: 'noticed.changes', params: { accepted: 2, rejected: 1 } });
    expect(diagnosis.changes).toEqual({ accepted: 2, rejected: 1 });
  });

  it('nikad ne vraća retke koji postoje samo u tjednoj dijagnozi', () => {
    const input = days(MONTH, 1, 30, (d) => ({ score: 40 + d, done: d % 4, sleep: 300 + d * 5 }));
    const diagnosis = buildMonthDiagnosis(stats(MONTH, input), stats(PREV, days(PREV, 1, 31)), input);
    const keys = [diagnosis.summary, ...diagnosis.praise, ...diagnosis.noticed, ...diagnosis.problems, ...diagnosis.ideas].map(
      (line) => line.key,
    );
    for (const key of keys) expect(MONTH_LINE_KEYS).toContain(key);
    expect(MONTH_LINE_KEYS.some((key) => key.startsWith('followUp.') || key.startsWith('ideas.stay.'))).toBe(false);
  });

  it('parseMonthDiagnosis odbija tuđi JSON i nepoznat redak', () => {
    const input = days(MONTH, 1, 30);
    const diagnosis = buildMonthDiagnosis(stats(MONTH, input), null, input);
    expect(parseMonthDiagnosis({ version: 'local-week-v1' })).toBeNull();
    expect(parseMonthDiagnosis({ ...diagnosis, ideas: [{ key: 'ideas.stay.plan' }] })).toBeNull();
    expect(parseMonthDiagnosis(null)).toBeNull();
  });
});

describe('earlierMonthAverages', () => {
  it('uzima samo ranije mjesece s dovoljno konačnih rezultata', () => {
    const scoresOf = (month: string, count: number, score: number, final = true) =>
      Array.from({ length: count }, (_, i) => ({ date: date(month, i + 1), score, final }));
    const all = [
      ...scoresOf('2026-08', 9, 90), // premalo dana
      ...scoresOf('2026-09', 12, 60),
      ...scoresOf('2026-10', 15, 71),
      ...scoresOf('2026-10', 5, 0, false), // „u tijeku“ se ne broji
      ...scoresOf('2026-11', 20, 99), // sam mjesec
    ];
    expect(earlierMonthAverages(all, '2026-11').sort()).toEqual([60, 71]);
    expect(earlierMonthAverages([], '2026-11')).toEqual([]);
  });
});
