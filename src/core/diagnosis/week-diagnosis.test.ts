import { describe, expect, it } from '@jest/globals';

import {
  buildWeekDiagnosis,
  dayPartOf,
  isWeekDiagnosisReady,
  parseWeekDiagnosis,
  periodStats,
  WEEK_IDEA_AREA,
  WEEK_IDEA_KEYS,
  weekIdeaCandidates,
  weekTrend,
  type DayStats,
  type PeriodDay,
  type PeriodStats,
  type WeekHistoryEntry,
} from './index';

const START = '2026-11-09'; // ponedjeljak
const END = '2026-11-15';
const PREV_START = '2026-11-02';
const PREV_END = '2026-11-08';

type DayIn = {
  score?: number | null;
  done?: number;
  total?: number;
  moved?: number;
  broken?: { title: string; weight?: number; trigger?: string | null }[];
  kept?: number;
  sleep?: number | null;
  onTarget?: boolean | null;
  rating?: number | null;
  xp?: number;
  gaveUp?: boolean;
  misses?: { title: string; start: string }[];
  comments?: DayStats['comments'];
};

function day(date: string, input: DayIn = {}): PeriodDay {
  const total = input.total ?? 4;
  const done = input.done ?? total;
  const broken = (input.broken ?? []).map((rule) => ({
    title: rule.title,
    weight: rule.weight ?? 1,
    trigger: rule.trigger ?? null,
  }));
  const kept = input.kept ?? 0;
  const stats: DayStats = {
    date,
    plan: { total, done, partial: 0, missed: total - done, moved: input.moved ?? 0, open: 0, rate: total > 0 ? done / total : null },
    rules: {
      active: kept + broken.length,
      kept,
      broken: broken.length,
      brokenRules: broken,
      activeWeight: kept + broken.length,
      keptWeight: kept,
    },
    sleep:
      input.sleep === undefined || input.sleep === null
        ? null
        : { minutes: input.sleep, onTarget: input.onTarget ?? null, deviationMinutes: null },
    xp: input.xp ?? 10,
    rating: input.rating ?? null,
    note: null,
    streak: 1,
    comments: input.comments ?? [],
    gaveUp: input.gaveUp ?? false,
    gaveUpNote: null,
    misses: input.misses ?? [],
  };
  return { stats, score: input.score === undefined ? 70 : input.score };
}

const dates = (start: string, count: number) =>
  Array.from({ length: count }, (_, i) => `${start.slice(0, 8)}${String(Number(start.slice(8)) + i).padStart(2, '0')}`);

const week = (days: PeriodDay[], start = START, end = END): PeriodStats => periodStats(start, end, 7, days);
const fullWeek = (start: string, input: DayIn = {}) => dates(start, 7).map((date) => day(date, input));

describe('periodStats', () => {
  it('zbraja plan, zabrane, XP i računa prosjek, najbolji i najslabiji dan', () => {
    const stats = week([
      day('2026-11-09', { score: 60, done: 2, total: 4, xp: 20 }),
      day('2026-11-10', { score: 80, done: 4, total: 4, kept: 2, xp: 30 }),
      day('2026-11-11', { score: 71, done: 3, total: 4, broken: [{ title: 'Šećer' }], kept: 1 }),
    ]);
    expect(stats.recorded).toBe(3);
    expect(stats.dates).toEqual(['2026-11-09', '2026-11-10', '2026-11-11']);
    expect(stats.average).toBe(70);
    expect(stats.best).toEqual({ date: '2026-11-10', score: 80 });
    expect(stats.worst).toEqual({ date: '2026-11-09', score: 60 });
    expect(stats.plan).toMatchObject({ total: 12, done: 9, missed: 3, rate: 0.75 });
    expect(stats.rules).toMatchObject({ active: 4, kept: 3, broken: 1 });
    expect(stats.xp).toBe(60);
  });

  it('zanemaruje dane izvan razdoblja i ponovljeni dan (vrijedi zadnji)', () => {
    const stats = week([
      day('2026-11-08', { score: 10 }),
      day('2026-11-16', { score: 10 }),
      day('2026-11-09', { score: 40 }),
      day('2026-11-09', { score: 90 }),
    ]);
    expect(stats.recorded).toBe(1);
    expect(stats.average).toBe(90);
    expect(stats.worst).toBeNull();
  });

  it('prazan tjedan nema prosjeka, sna ni ocjene', () => {
    const stats = week([]);
    expect(stats).toMatchObject({ recorded: 0, average: null, best: null, worst: null, sleep: null, rating: null });
    expect(stats.plan.rate).toBeNull();
    expect(stats.shortSleepEffect).toBeNull();
  });

  it('dan bez rezultata se broji kao zaključen, ali ne ulazi u prosjek', () => {
    const stats = week([day('2026-11-09', { score: null }), day('2026-11-10', { score: 50 })]);
    expect(stats.recorded).toBe(2);
    expect(stats.average).toBe(50);
  });

  it('zabrane po zabrani: najčešće prekršena prva, okidači po učestalosti', () => {
    const stats = week([
      day('2026-11-09', { broken: [{ title: 'Šećer', trigger: 'umor' }, { title: 'Ekran', weight: 3 }] }),
      day('2026-11-10', { broken: [{ title: 'Šećer', trigger: 'Dosada' }] }),
      day('2026-11-11', { broken: [{ title: 'Šećer', trigger: 'dosada ' }] }),
    ]);
    expect(stats.rules.byRule).toEqual([
      { title: 'Šećer', weight: 1, broken: 3, triggers: ['Dosada', 'umor'] },
      { title: 'Ekran', weight: 3, broken: 1, triggers: [] },
    ]);
  });

  it('san: prosjek, kratke noći i noći na cilju', () => {
    const stats = week([
      day('2026-11-09', { sleep: 300, onTarget: false, score: 40 }),
      day('2026-11-10', { sleep: 480, onTarget: true, score: 80 }),
      day('2026-11-11', { sleep: 450, score: 70 }),
    ]);
    expect(stats.sleep).toEqual({ nights: 3, averageMinutes: 410, shortNights: 1, onTarget: 1, withTarget: 2 });
    expect(stats.shortSleepEffect).toEqual({ shortAverage: 40, restAverage: 75 });
  });

  it('propusti po dobu dana i ponovljeni propusti', () => {
    const stats = week([
      day('2026-11-09', { misses: [{ title: 'Trening', start: '18:00' }, { title: 'Čitanje', start: '21:00' }] }),
      day('2026-11-10', { misses: [{ title: 'trening', start: '18:00' }, { title: 'Pošta', start: '09:00' }] }),
      day('2026-11-11', { misses: [{ title: 'Ručak', start: '13:00' }], gaveUp: true, rating: 4 }),
      day('2026-11-12', { rating: 3 }),
    ]);
    expect(stats.misses).toEqual({ morning: 1, afternoon: 1, evening: 3 });
    expect(stats.repeatedMisses).toEqual([{ title: 'Trening', count: 2 }]);
    expect(stats.gaveUpDays).toBe(1);
    expect(stats.rating).toEqual({ average: 3.5, count: 2 });
  });

  it('dayPartOf dijeli dan na jutro, popodne i večer', () => {
    expect([dayPartOf('06:00'), dayPartOf('12:00'), dayPartOf('16:59'), dayPartOf('17:00'), dayPartOf('x')]).toEqual([
      'morning',
      'afternoon',
      'afternoon',
      'evening',
      null,
    ]);
  });
});

describe('buildWeekDiagnosis', () => {
  it('prvi tjedan: trend first, bez usporedbe, uvijek jedna pohvala i jedna ideja', () => {
    const diagnosis = buildWeekDiagnosis(week(fullWeek(START)), null);
    expect(diagnosis.trend).toBe('first');
    expect(diagnosis.summary).toEqual({ key: 'summary.first', params: { average: 70, days: 7 } });
    expect(diagnosis.praise.length).toBeGreaterThan(0);
    expect(diagnosis.ideas).toEqual([{ key: 'ideas.keepRhythm' }]);
    expect(diagnosis.suggestion).toBeNull();
    expect(diagnosis.problems).toEqual([{ key: 'problems.none' }]);
    expect(parseWeekDiagnosis(JSON.parse(JSON.stringify(diagnosis)))).toEqual(diagnosis);
  });

  it('trend naspram prošlog tjedna koristi prag od 5 bodova', () => {
    const previous = week(fullWeek(PREV_START, { score: 60 }), PREV_START, PREV_END);
    expect(weekTrend(week(fullWeek(START, { score: 66 })), previous)).toBe('better');
    expect(weekTrend(week(fullWeek(START, { score: 63 })), previous)).toBe('same');
    expect(weekTrend(week(fullWeek(START, { score: 50 })), previous)).toBe('worse');
    const diagnosis = buildWeekDiagnosis(week(fullWeek(START, { score: 72 })), previous);
    expect(diagnosis.summary).toEqual({
      key: 'summary.better',
      params: { average: 72, days: 7, previous: 60, diff: 12 },
    });
    expect(diagnosis.praise[0]).toEqual({ key: 'praise.better', params: { diff: 12 } });
  });

  it('prošli tjedan bez zaključenih dana ne služi za usporedbu', () => {
    const diagnosis = buildWeekDiagnosis(week(fullWeek(START)), week([], PREV_START, PREV_END));
    expect(diagnosis.trend).toBe('first');
    expect(diagnosis.progress.find((row) => row.metric === 'days')?.previous).toBeNull();
  });

  it('rekord tjedna i niz boljih tjedana ulaze u pohvale i napredak', () => {
    const diagnosis = buildWeekDiagnosis(week(fullWeek(START, { score: 85 })), null, { betterWeeks: 3, previousBest: 80 });
    expect(diagnosis.praise.map((line) => line.key)).toEqual(
      expect.arrayContaining(['praise.record', 'praise.betterWeeks', 'praise.allDays']),
    );
    expect(diagnosis.progress.find((row) => row.metric === 'betterWeeks')?.value).toBe(3);
    expect(diagnosis.betterWeeks).toBe(3);
  });

  it('napredak: redci s vrijednostima i smjerom', () => {
    const previous = week(fullWeek(PREV_START, { score: 60, done: 2, total: 4, sleep: 400, rating: 3 }), PREV_START, PREV_END);
    const diagnosis = buildWeekDiagnosis(
      week(dates(START, 5).map((date) => day(date, { score: 70, done: 3, total: 4, sleep: 420, rating: 4 }))),
      previous,
    );
    const row = (metric: string) => diagnosis.progress.find((entry) => entry.metric === metric);
    expect(row('average')).toMatchObject({ value: 70, previous: 60, change: 'up', good: true });
    expect(row('days')).toMatchObject({ value: 5, total: 7, previous: 7, change: 'down', good: false });
    expect(row('plan')).toMatchObject({ value: 15, total: 20, previous: 14, previousTotal: 28, change: 'up' });
    expect(row('sleep')).toMatchObject({ value: 420, previous: 400, good: null });
    expect(row('rating')).toMatchObject({ value: 4, previous: 3, change: 'up' });
    expect(row('best')).toMatchObject({ value: 70, date: '2026-11-09' });
  });

  it('premalo dana je problem i prva ideja je ispunjavanje upita', () => {
    const diagnosis = buildWeekDiagnosis(week(dates(START, 2).map((date) => day(date))), null);
    expect(diagnosis.problems[0]).toEqual({ key: 'problems.fewDays', params: { days: 2, length: 7 } });
    expect(diagnosis.ideas).toEqual([{ key: 'ideas.fillCheckin', params: { days: 2 } }]);
    expect(diagnosis.suggestion).toBe('ideas.fillCheckin');
  });

  it('ponavljana zabrana s okidačem: primijećeno, problem i ideja s okidačem', () => {
    const days = fullWeek(START).map((entry, index) =>
      index < 3 ? day(entry.stats.date, { broken: [{ title: 'Šećer', trigger: 'umor' }], kept: 1 }) : entry,
    );
    const diagnosis = buildWeekDiagnosis(week(days), null);
    expect(diagnosis.noticed).toContainEqual({ key: 'noticed.ruleTrigger', params: { rule: 'Šećer', count: 3, trigger: 'umor' } });
    expect(diagnosis.problems).toContainEqual({ key: 'problems.rule', params: { rule: 'Šećer', count: 3 } });
    expect(diagnosis.ideas).toEqual([{ key: 'ideas.ruleTrigger', params: { rule: 'Šećer', trigger: 'umor' } }]);
  });

  it('teška zabrana je veliki problem već s dva prekršaja', () => {
    const days = fullWeek(START).map((entry, index) =>
      index < 2 ? day(entry.stats.date, { broken: [{ title: 'Alkohol', weight: 3 }] }) : entry,
    );
    const diagnosis = buildWeekDiagnosis(week(days), null);
    expect(diagnosis.problems).toContainEqual({ key: 'problems.heavyRule', params: { rule: 'Alkohol', count: 2 } });
    expect(diagnosis.ideas[0]?.key).toBe('ideas.rule');
  });

  it('slab plan: problem i manji plan; večernji propusti daju lakšu večer', () => {
    const low = buildWeekDiagnosis(week(fullWeek(START, { done: 1, total: 4, score: 30 })), null);
    expect(low.problems).toContainEqual({ key: 'problems.lowPlan', params: { done: 7, total: 28, percent: 25 } });
    expect(low.ideas).toEqual([{ key: 'ideas.smallerPlan', params: { count: 2 } }]);

    const evening = buildWeekDiagnosis(
      week(fullWeek(START, { done: 2, total: 4, misses: [{ title: 'A', start: '19:00' }, { title: 'B', start: '21:00' }] })),
      null,
    );
    expect(evening.noticed).toContainEqual({ key: 'noticed.misses.evening', params: { count: 14, total: 14 } });
    expect(evening.ideas[0]?.key).toBe('ideas.eveningLighter');
  });

  it('kratak san: problem, uzorak i raniji krevet', () => {
    const days = fullWeek(START).map((entry, index) =>
      day(entry.stats.date, index < 3 ? { sleep: 320, score: 50 } : { sleep: 460, score: 80 }),
    );
    const diagnosis = buildWeekDiagnosis(week(days), null);
    expect(diagnosis.problems).toContainEqual({ key: 'problems.shortSleep', params: { nights: 3, hours: 6.7 } });
    expect(diagnosis.noticed).toContainEqual({ key: 'noticed.shortSleep', params: { short: 50, rest: 80 } });
    expect(diagnosis.ideas[0]?.key).toBe('ideas.bedEarlier');
  });

  it('najbolji i najslabiji dan, odustajanja, premještanja i komentari su u primijećenom', () => {
    const days = [
      day('2026-11-09', { score: 90 }),
      day('2026-11-10', { score: 50, gaveUp: true, moved: 3, comments: [{ title: 'Trening', outcome: 'not', comment: 'umoran' }] }),
      day('2026-11-11', { score: 70 }),
      day('2026-11-12', { score: 70 }),
    ];
    const keys = buildWeekDiagnosis(week(days), null).noticed;
    expect(keys).toContainEqual({
      key: 'noticed.bestWorst',
      params: { bestDate: '2026-11-09', best: 90, worstDate: '2026-11-10', worst: 50 },
    });
    expect(keys).toContainEqual({ key: 'noticed.gaveUp', params: { count: 1 } });
    expect(keys).toContainEqual({ key: 'noticed.moved', params: { count: 3 } });
    expect(keys).toContainEqual({
      key: 'noticed.comment',
      params: { commentDate: '2026-11-10', title: 'Trening', comment: 'umoran' },
    });
  });

  it('pad od 10 i više bodova je problem, uvijek uz ideju', () => {
    const previous = week(fullWeek(PREV_START, { score: 80 }), PREV_START, PREV_END);
    const diagnosis = buildWeekDiagnosis(week(fullWeek(START, { score: 65 })), previous);
    expect(diagnosis.problems).toEqual([{ key: 'problems.worse', params: { diff: 15 } }]);
    expect(diagnosis.ideas).toHaveLength(1);
  });

  describe('jedna promjena tjedno', () => {
    const lowPlanWeek = () => week(fullWeek(START, { done: 1, total: 4, score: 30, sleep: 320 }));
    const entry = (start: string, suggestion: string | null, accepted: boolean | null): WeekHistoryEntry => ({
      start,
      suggestion,
      accepted,
    });

    it('nudi točno jednu ideju i kad ima više problema', () => {
      const diagnosis = buildWeekDiagnosis(lowPlanWeek(), null);
      expect(weekIdeaCandidates(lowPlanWeek()).map((line) => line.key)).toEqual([
        'ideas.smallerPlan',
        'ideas.bedEarlier',
        'ideas.keepRhythm',
      ]);
      expect(diagnosis.ideas).toHaveLength(1);
      expect(diagnosis.suggestion).toBe('ideas.smallerPlan');
      expect(diagnosis.carried).toBe(false);
    });

    it('odbijeni prijedlog se ne nudi dva tjedna, pa ide sljedeći', () => {
      const lastWeek = buildWeekDiagnosis(lowPlanWeek(), null, { history: [entry(PREV_START, 'ideas.smallerPlan', false)] });
      expect(lastWeek.suggestion).toBe('ideas.bedEarlier');
      const twoWeeksAgo = buildWeekDiagnosis(lowPlanWeek(), null, { history: [entry('2026-10-26', 'ideas.smallerPlan', false)] });
      expect(twoWeeksAgo.suggestion).toBe('ideas.bedEarlier');
      const threeWeeksAgo = buildWeekDiagnosis(lowPlanWeek(), null, { history: [entry('2026-10-19', 'ideas.smallerPlan', false)] });
      expect(threeWeeksAgo.suggestion).toBe('ideas.smallerPlan');
    });

    it('sve odbijeno → zadrži ritam, bez prijedloga', () => {
      const diagnosis = buildWeekDiagnosis(lowPlanWeek(), null, {
        history: [entry(PREV_START, 'ideas.smallerPlan', false), entry('2026-10-26', 'ideas.bedEarlier', false)],
      });
      expect(diagnosis.ideas).toEqual([{ key: 'ideas.keepRhythm' }]);
      expect(diagnosis.suggestion).toBeNull();
    });

    it('prihvaćena promjena ostaje jedina sljedeći tjedan i dijagnoza kaže je li upalila', () => {
      const previous = week(fullWeek(PREV_START, { done: 1, total: 4, score: 30 }), PREV_START, PREV_END);
      const history = [entry(PREV_START, 'ideas.smallerPlan', true)];
      const worked = buildWeekDiagnosis(week(fullWeek(START, { done: 3, total: 4, sleep: 320 })), previous, { history });
      expect(worked.noticed[0]).toEqual({ key: 'followUp.plan.worked' });
      expect(worked.ideas).toEqual([{ key: 'ideas.stay.plan' }]);
      expect(worked.suggestion).toBe('ideas.smallerPlan');
      expect(worked.carried).toBe(true);

      const notYet = buildWeekDiagnosis(lowPlanWeek(), previous, { history });
      expect(notYet.noticed[0]).toEqual({ key: 'followUp.plan.notYet' });
      expect(notYet.ideas).toEqual([{ key: 'ideas.stay.plan' }]);
    });

    it('nakon dva tjedna promjena je stabilna i smije doći nova', () => {
      const previous = week(fullWeek(PREV_START, { done: 1, total: 4, score: 30 }), PREV_START, PREV_END);
      const history = [entry(PREV_START, 'ideas.smallerPlan', true), entry('2026-10-26', 'ideas.smallerPlan', true)];
      const diagnosis = buildWeekDiagnosis(week(fullWeek(START, { done: 3, total: 4, sleep: 320 })), previous, { history });
      expect(diagnosis.noticed[0]).toEqual({ key: 'followUp.plan.worked' });
      expect(diagnosis.carried).toBe(false);
      expect(diagnosis.suggestion).toBe('ideas.bedEarlier');
    });

    it('prijedlog bez odgovora ili nepoznat ključ se ne prenosi', () => {
      for (const history of [[entry(PREV_START, 'ideas.smallerPlan', null)], [entry(PREV_START, 'nešto.staro', true)]]) {
        const diagnosis = buildWeekDiagnosis(lowPlanWeek(), null, { history });
        expect(diagnosis.carried).toBe(false);
        expect(diagnosis.suggestion).toBe('ideas.smallerPlan');
      }
    });

    it('provjera po području: zabrane, večer, san, upit', () => {
      const previous = week(
        fullWeek(PREV_START, { broken: [{ title: 'Šećer' }], sleep: 330, misses: [{ title: 'A', start: '20:00' }] }).slice(0, 5),
        PREV_START,
        PREV_END,
      );
      const current = week(fullWeek(START, { sleep: 400 }));
      const followUp = (suggestion: string) =>
        buildWeekDiagnosis(current, previous, { history: [entry(PREV_START, suggestion, true)] }).noticed[0]?.key;
      expect(followUp('ideas.rule')).toBe('followUp.rules.worked');
      expect(followUp('ideas.eveningLighter')).toBe('followUp.evening.worked');
      expect(followUp('ideas.bedEarlier')).toBe('followUp.sleep.worked');
      expect(followUp('ideas.fillCheckin')).toBe('followUp.checkin.worked');
    });
  });

  it('svaki prijedlog ima područje, osim „zadrži ritam“', () => {
    for (const key of WEEK_IDEA_KEYS) {
      expect(WEEK_IDEA_AREA[key] === null).toBe(key === 'ideas.keepRhythm');
    }
  });

  it('parseWeekDiagnosis odbija dnevnu dijagnozu i smeće', () => {
    expect(parseWeekDiagnosis({ version: 'local-day-v2' })).toBeNull();
    expect(parseWeekDiagnosis(null)).toBeNull();
  });
});

describe('isWeekDiagnosisReady', () => {
  it('nije spremna usred tjedna ni u nedjelju prije večernjeg upita', () => {
    expect(isWeekDiagnosisReady(END, '2026-11-12', ['2026-11-09', '2026-11-10'])).toBe(false);
    expect(isWeekDiagnosisReady(END, END, ['2026-11-09', '2026-11-14'])).toBe(false);
  });

  it('spremna je u nedjelju nakon večernjeg upita i svaki dan poslije', () => {
    expect(isWeekDiagnosisReady(END, END, ['2026-11-09', END])).toBe(true);
    expect(isWeekDiagnosisReady(END, '2026-11-16', ['2026-11-09'])).toBe(true);
  });

  it('tjedan bez ijednog zaključenog dana nema dijagnozu', () => {
    expect(isWeekDiagnosisReady(END, '2026-11-20', ['2026-11-08', '2026-11-16'])).toBe(false);
    expect(isWeekDiagnosisReady('x', '2026-11-20', [])).toBe(false);
  });
});
