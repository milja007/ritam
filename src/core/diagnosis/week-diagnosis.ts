/**
 * Lokalna tjedna dijagnoza (korak 36, bez LLM-a): iz statistike tjedna i prošlog tjedna slaže
 * sekcije redom iz koncepta — Ukratko → Napredak → Pohvale → Što smo primijetili → Veliki problemi
 * → Ideje za napredak. Retci su i18n ključevi (`diagnosis.week.lines.*`) s parametrima.
 *
 * „Malo po malo“ (koncept): **najviše jedna nova promjena tjedno**; odbijeni prijedlog se ne nudi
 * ponovo dva tjedna; prihvaćena promjena ostaje jedina dok ne potraje dva tjedna, a dijagnoza
 * svaki tjedan kaže je li upalila. Ton: činjenice pa tumačenje, kritika uvijek s idejom, bez
 * posramljivanja. Čista logika: bez React importa.
 */
import { z } from 'zod';

import { scoreTrend } from '../progress';
import { addDays } from '../time/local-date';
import { SHORT_SLEEP_MINUTES, TRENDS, type Trend } from './day-diagnosis';
import type { DayPart, PeriodStats } from './period-stats';

/** Verzija pravila (sprema se kao `reports.prompt_version`). */
export const LOCAL_WEEK_DIAGNOSIS_VERSION = 'local-week-v1';

/** Ispod toliko zaključenih dana slika tjedna je nepotpuna (isti prag kao za rang). */
export const MIN_WEEK_DIAGNOSIS_DAYS = 4;
/** Koliko tjedana prihvaćena promjena ostaje jedina prije nove. */
export const STABLE_WEEKS = 2;
/** Koliko se dana odbijeni prijedlog ne nudi ponovo. */
export const REJECTED_COOLDOWN_DAYS = 14;

/**
 * Pragovi koji ovise o duljini razdoblja: isti graditelji redaka služe tjednu i mjesecu
 * (`month-diagnosis.ts`), a razlikuju se samo po tome koliko se puta nešto mora ponoviti.
 */
export type PeriodThresholds = {
  /** Ispod toliko zaključenih dana slika razdoblja je nepotpuna. */
  minDays: number;
  /** Prekršaja iste zabrane od kojih se ona spominje u „Što smo primijetili“ i nudi kao ideja. */
  ruleNoticed: number;
  /** Prekršaja iste zabrane od kojih je to veliki problem (važna zabrana: `heavyRuleProblem`). */
  ruleProblem: number;
  heavyRuleProblem: number;
  /** Kratkih noći od kojih je san veliki problem. */
  shortNights: number;
  /** Propusta istog bloka od kojih se nudi ideja o njemu. */
  repeatedIdea: number;
  movedNoticed: number;
  movedIdea: number;
};

export const WEEK_THRESHOLDS: PeriodThresholds = {
  minDays: MIN_WEEK_DIAGNOSIS_DAYS,
  ruleNoticed: 2,
  ruleProblem: 3,
  heavyRuleProblem: 2,
  shortNights: 3,
  repeatedIdea: 3,
  movedNoticed: 3,
  movedIdea: 4,
};

const PLAN_STEP = 0.1;
const PLAN_FOLLOW_UP_STEP = 0.05;
const SLEEP_FOLLOW_UP_MINUTES = 15;
const MAX_PRAISE = 4;
const MAX_NOTICED = 6;

/** Područje na koje se prijedlog odnosi — po njemu se sljedeći tjedan provjerava je li upalio. */
export const IDEA_AREAS = ['checkin', 'rules', 'plan', 'evening', 'sleep'] as const;
export type IdeaArea = (typeof IDEA_AREAS)[number];

/** Prijedlozi koji se mogu ponuditi (sprema se kao `reports.suggestion`). */
export const WEEK_IDEA_KEYS = [
  'ideas.fillCheckin',
  'ideas.ruleTrigger',
  'ideas.rule',
  'ideas.eveningLighter',
  'ideas.smallerPlan',
  'ideas.repeatedBlock',
  'ideas.bedEarlier',
  'ideas.fewerMoves',
  'ideas.keepRhythm',
] as const;
export type WeekIdeaKey = (typeof WEEK_IDEA_KEYS)[number];

export const WEEK_IDEA_AREA: Readonly<Record<WeekIdeaKey, IdeaArea | null>> = {
  'ideas.fillCheckin': 'checkin',
  'ideas.ruleTrigger': 'rules',
  'ideas.rule': 'rules',
  'ideas.eveningLighter': 'evening',
  'ideas.smallerPlan': 'plan',
  'ideas.repeatedBlock': 'plan',
  'ideas.bedEarlier': 'sleep',
  'ideas.fewerMoves': 'plan',
  'ideas.keepRhythm': null,
};

const DAY_PARTS: readonly DayPart[] = ['morning', 'afternoon', 'evening'];

/** Svi retci tjedne dijagnoze (i18n `diagnosis.week.lines.<ključ>`). */
export const WEEK_LINE_KEYS = [
  ...TRENDS.map((trend) => `summary.${trend}` as const),
  'summary.empty',
  'praise.better',
  'praise.betterWeeks',
  'praise.record',
  'praise.bestDay',
  'praise.planDone',
  'praise.planBetter',
  'praise.rulesClean',
  'praise.rulesFewer',
  'praise.sleepOnTarget',
  'praise.allDays',
  'praise.showedUp',
  ...IDEA_AREAS.flatMap((area) => [`followUp.${area}.worked`, `followUp.${area}.notYet`] as const),
  'noticed.bestWorst',
  ...DAY_PARTS.map((part) => `noticed.misses.${part}` as const),
  'noticed.repeated',
  'noticed.rule',
  'noticed.ruleTrigger',
  'noticed.shortSleep',
  'noticed.gaveUp',
  'noticed.moved',
  'noticed.comment',
  'noticed.none',
  'problems.fewDays',
  'problems.lowPlan',
  'problems.rule',
  'problems.heavyRule',
  'problems.shortSleep',
  'problems.worse',
  'problems.none',
  ...WEEK_IDEA_KEYS,
  ...IDEA_AREAS.map((area) => `ideas.stay.${area}` as const),
] as const;
export type WeekLineKey = (typeof WEEK_LINE_KEYS)[number];

export const WEEK_METRICS = ['average', 'days', 'plan', 'rules', 'sleep', 'xp', 'rating', 'best', 'betterWeeks'] as const;
export type WeekMetric = (typeof WEEK_METRICS)[number];

const paramsSchema = z.record(z.string(), z.union([z.string(), z.number()]));

export const weekLineSchema = z.object({
  key: z.enum(WEEK_LINE_KEYS),
  /** Parametar čije ime završava na `Date` je dan "YYYY-MM-DD" — prikaz ga pretvara u naziv dana. */
  params: paramsSchema.optional(),
});
export type WeekLine = z.infer<typeof weekLineSchema>;

export const weekProgressRowSchema = z.object({
  metric: z.enum(WEEK_METRICS),
  /** Vrijednost ovog tjedna (plan/zabrane/dani: odrađeno; san: minute). */
  value: z.number(),
  total: z.number().optional(),
  /** Ista mjera prošli tjedan; `null` kad je nema. */
  previous: z.number().nullable(),
  previousTotal: z.number().optional(),
  change: z.enum(['up', 'down', 'same']).nullable(),
  /** Je li promjena dobra; `null` = neutralno. */
  good: z.boolean().nullable(),
  /** Dan na koji se redak odnosi (najbolji dan). */
  date: z.string().optional(),
});
export type WeekProgressRow = z.infer<typeof weekProgressRowSchema>;

export const weekDiagnosisSchema = z.object({
  version: z.literal(LOCAL_WEEK_DIAGNOSIS_VERSION),
  /** Ponedjeljak i nedjelja tjedna. */
  start: z.string(),
  end: z.string(),
  trend: z.enum(TRENDS),
  summary: weekLineSchema,
  progress: z.array(weekProgressRowSchema),
  praise: z.array(weekLineSchema),
  noticed: z.array(weekLineSchema),
  problems: z.array(weekLineSchema),
  /** Uvijek točno jedan redak: jedna promjena tjedno. */
  ideas: z.array(weekLineSchema),
  /** Prijedlog tjedna; `null` kad nema što mijenjati („zadrži ritam“). */
  suggestion: z.enum(WEEK_IDEA_KEYS).nullable(),
  /** Prijedlog je prenesen iz prošlog tjedna (već prihvaćen) — ne pita se ponovno. */
  carried: z.boolean(),
  /** Niz boljih tjedana zaključno s ovim tjednom. */
  betterWeeks: z.number(),
});
export type WeekDiagnosis = z.infer<typeof weekDiagnosisSchema>;

/** Prijedlog i odgovor iz dijagnoze nekog ranijeg tjedna. */
export type WeekHistoryEntry = {
  /** Ponedjeljak tog tjedna. */
  start: string;
  suggestion: string | null;
  /** `true` prihvaćen, `false` odbijen, `null` bez odgovora. */
  accepted: boolean | null;
};

export type WeekDiagnosisOptions = {
  /** Dijagnoze ranijih tjedana (bilo kojim redom); bez njih nema praćenja prijedloga. */
  history?: readonly WeekHistoryEntry[];
  /** Niz boljih tjedana zaključno s ovim tjednom. */
  betterWeeks?: number;
  /** Najbolji prosjek nekog ranijeg ubrojenog tjedna; `null` kad ga nema. */
  previousBest?: number | null;
};

const line = (key: WeekLineKey, params?: WeekLine['params']): WeekLine => (params ? { key, params } : { key });

const percent = (rate: number) => Math.round(rate * 100);
const hours = (minutes: number) => Math.round((minutes / 60) * 10) / 10;

const isWeekIdeaKey = (value: string | null): value is WeekIdeaKey =>
  value !== null && (WEEK_IDEA_KEYS as readonly string[]).includes(value);

/** Trend tjedna naspram prošlog po prosjeku dnevnih rezultata; `first` kad nema usporedbe. */
export function weekTrend(current: PeriodStats, previous: PeriodStats | null): Trend {
  if (current.average === null || previous === null || previous.average === null) return 'first';
  return scoreTrend(current.average - previous.average);
}

function change(value: number, previous: number | null): WeekProgressRow['change'] {
  if (previous === null) return null;
  if (Math.abs(value - previous) < 1e-9) return 'same';
  return value > previous ? 'up' : 'down';
}

const goodFor = (direction: WeekProgressRow['change']): boolean | null =>
  direction === null || direction === 'same' ? null : direction === 'up';

/**
 * Retci „Napredak“. `betterWeeks = null` izostavlja redak niza boljih tjedana (mjesec ga nema).
 */
export function periodProgressRows(
  current: PeriodStats,
  previous: PeriodStats | null,
  trend: Trend,
  betterWeeks: number | null,
): WeekProgressRow[] {
  const rows: WeekProgressRow[] = [];
  if (current.average !== null) {
    const before = previous?.average ?? null;
    const direction = trend === 'first' ? null : trend === 'better' ? 'up' : trend === 'worse' ? 'down' : 'same';
    rows.push({ metric: 'average', value: current.average, previous: before, change: direction, good: goodFor(direction) });
  }
  const daysDir = change(current.recorded, previous ? previous.recorded : null);
  rows.push({
    metric: 'days',
    value: current.recorded,
    total: current.length,
    previous: previous ? previous.recorded : null,
    ...(previous ? { previousTotal: previous.length } : {}),
    change: daysDir,
    good: goodFor(daysDir),
  });
  if (current.plan.total > 0 && current.plan.rate !== null) {
    const before = previous && previous.plan.rate !== null ? previous.plan : null;
    const direction = before && before.rate !== null ? change(current.plan.rate, before.rate) : null;
    rows.push({
      metric: 'plan',
      value: current.plan.done,
      total: current.plan.total,
      previous: before ? before.done : null,
      ...(before ? { previousTotal: before.total } : {}),
      change: direction,
      good: goodFor(direction),
    });
  }
  if (current.rules.active > 0) {
    const before = previous && previous.rules.active > 0 ? previous.rules : null;
    const direction = before
      ? change(current.rules.kept / current.rules.active, before.kept / before.active)
      : null;
    rows.push({
      metric: 'rules',
      value: current.rules.kept,
      total: current.rules.active,
      previous: before ? before.kept : null,
      ...(before ? { previousTotal: before.active } : {}),
      change: direction,
      good: goodFor(direction),
    });
  }
  if (current.sleep) {
    const before = previous?.sleep?.averageMinutes ?? null;
    rows.push({
      metric: 'sleep',
      value: current.sleep.averageMinutes,
      previous: before,
      change: change(current.sleep.averageMinutes, before),
      good: null,
    });
  }
  const xpDir = change(current.xp, previous ? previous.xp : null);
  rows.push({ metric: 'xp', value: current.xp, previous: previous ? previous.xp : null, change: xpDir, good: goodFor(xpDir) });
  if (current.rating) {
    const before = previous?.rating?.average ?? null;
    const direction = change(current.rating.average, before);
    rows.push({ metric: 'rating', value: current.rating.average, previous: before, change: direction, good: goodFor(direction) });
  }
  if (current.best) {
    rows.push({ metric: 'best', value: current.best.score, previous: null, change: null, good: null, date: current.best.date });
  }
  if (betterWeeks !== null) rows.push({ metric: 'betterWeeks', value: betterWeeks, previous: null, change: null, good: null });
  return rows;
}

export function periodSummaryLine(current: PeriodStats, previous: PeriodStats | null, trend: Trend): WeekLine {
  if (current.average === null) return line('summary.empty', { days: current.recorded });
  const params = { average: current.average, days: current.recorded };
  if (trend === 'first' || previous === null || previous.average === null) return line('summary.first', params);
  return line(`summary.${trend}`, {
    ...params,
    previous: previous.average,
    diff: Math.abs(current.average - previous.average),
  });
}

export function periodPraiseLines(
  current: PeriodStats,
  previous: PeriodStats | null,
  trend: Trend,
  betterWeeks: number,
  previousBest: number | null,
): WeekLine[] {
  const praise: WeekLine[] = [];
  if (current.average !== null && previousBest !== null && current.average > previousBest) {
    praise.push(line('praise.record', { average: current.average }));
  } else if (trend === 'better' && current.average !== null && previous?.average != null) {
    praise.push(line('praise.better', { diff: current.average - previous.average }));
  }
  if (betterWeeks >= 2) praise.push(line('praise.betterWeeks', { count: betterWeeks }));
  if (current.plan.rate !== null && current.plan.total > 0) {
    if (current.plan.rate >= 0.8) {
      praise.push(line('praise.planDone', { done: current.plan.done, total: current.plan.total }));
    } else if (previous && previous.plan.rate !== null && current.plan.rate - previous.plan.rate >= PLAN_STEP - 1e-9) {
      praise.push(
        line('praise.planBetter', { percent: percent(current.plan.rate), previous: percent(previous.plan.rate) }),
      );
    }
  }
  if (current.rules.active > 0 && current.rules.broken === 0) {
    praise.push(line('praise.rulesClean', { count: current.rules.kept }));
  } else if (previous && previous.rules.broken > 0 && current.rules.active > 0 && current.rules.broken < previous.rules.broken) {
    praise.push(line('praise.rulesFewer', { broken: current.rules.broken, previous: previous.rules.broken }));
  }
  if (current.sleep && current.sleep.withTarget >= 2 && current.sleep.onTarget / current.sleep.withTarget >= 0.7) {
    praise.push(line('praise.sleepOnTarget', { count: current.sleep.onTarget, total: current.sleep.withTarget }));
  }
  if (current.recorded === current.length) praise.push(line('praise.allDays', { days: current.recorded }));
  if (current.best && current.recorded >= 2 && praise.length < MAX_PRAISE) {
    praise.push(line('praise.bestDay', { bestDate: current.best.date, score: current.best.score }));
  }
  // Uvijek barem jedna pohvala: ispunjeni upiti su navika koju gradimo.
  if (praise.length === 0) praise.push(line('praise.showedUp', { days: current.recorded }));
  return praise.slice(0, MAX_PRAISE);
}

/** Je li prošlotjedna promjena upalila, po području prijedloga. */
function followUpWorked(area: IdeaArea, current: PeriodStats, previous: PeriodStats): boolean {
  switch (area) {
    case 'checkin':
      return current.recorded > previous.recorded || current.recorded >= current.length - 1;
    case 'rules':
      return current.rules.broken < previous.rules.broken;
    case 'plan':
      return (
        current.plan.rate !== null &&
        previous.plan.rate !== null &&
        current.plan.rate - previous.plan.rate >= PLAN_FOLLOW_UP_STEP - 1e-9
      );
    case 'evening':
      return current.misses.evening < previous.misses.evening;
    case 'sleep':
      return (
        current.sleep !== null &&
        previous.sleep !== null &&
        (current.sleep.averageMinutes - previous.sleep.averageMinutes >= SLEEP_FOLLOW_UP_MINUTES ||
          current.sleep.shortNights < previous.sleep.shortNights)
      );
  }
}

function dominantPart(misses: PeriodStats['misses']): { part: DayPart; count: number; total: number } | null {
  const total = misses.morning + misses.afternoon + misses.evening;
  if (total < 3) return null;
  for (const part of DAY_PARTS) {
    if (misses[part] / total >= 0.6) return { part, count: misses[part], total };
  }
  return null;
}

export function periodNoticedLines(
  current: PeriodStats,
  followUp: WeekLine | null,
  thresholds: PeriodThresholds = WEEK_THRESHOLDS,
): WeekLine[] {
  const noticed: WeekLine[] = [];
  if (followUp !== null) noticed.push(followUp);
  if (current.best && current.worst && current.recorded >= 3 && current.best.score - current.worst.score >= 15) {
    noticed.push(
      line('noticed.bestWorst', {
        bestDate: current.best.date,
        best: current.best.score,
        worstDate: current.worst.date,
        worst: current.worst.score,
      }),
    );
  }
  const part = dominantPart(current.misses);
  if (part !== null) noticed.push(line(`noticed.misses.${part.part}`, { count: part.count, total: part.total }));
  const repeated = current.repeatedMisses[0];
  if (repeated) noticed.push(line('noticed.repeated', { title: repeated.title, count: repeated.count }));
  const rule = current.rules.byRule[0];
  if (rule && rule.broken >= thresholds.ruleNoticed) {
    const trigger = rule.triggers[0];
    noticed.push(
      trigger !== undefined
        ? line('noticed.ruleTrigger', { rule: rule.title, count: rule.broken, trigger })
        : line('noticed.rule', { rule: rule.title, count: rule.broken }),
    );
  }
  const sleepEffect = current.shortSleepEffect;
  if (sleepEffect && sleepEffect.restAverage - sleepEffect.shortAverage >= 10) {
    noticed.push(line('noticed.shortSleep', { short: sleepEffect.shortAverage, rest: sleepEffect.restAverage }));
  }
  if (current.gaveUpDays > 0) noticed.push(line('noticed.gaveUp', { count: current.gaveUpDays }));
  if (current.plan.moved >= thresholds.movedNoticed) noticed.push(line('noticed.moved', { count: current.plan.moved }));
  for (const comment of current.comments.slice(0, 2)) {
    noticed.push(line('noticed.comment', { commentDate: comment.date, title: comment.title, comment: comment.comment }));
  }
  if (noticed.length === 0) noticed.push(line('noticed.none'));
  return noticed.slice(0, MAX_NOTICED);
}

const lowPlan = (stats: PeriodStats) => stats.plan.total >= 5 && stats.plan.rate !== null && stats.plan.rate < 0.5;
const shortSleep = (stats: PeriodStats, thresholds: PeriodThresholds) =>
  stats.sleep !== null &&
  (stats.sleep.shortNights >= thresholds.shortNights || stats.sleep.averageMinutes < SHORT_SLEEP_MINUTES);

export function periodProblemLines(
  current: PeriodStats,
  previous: PeriodStats | null,
  trend: Trend,
  thresholds: PeriodThresholds = WEEK_THRESHOLDS,
): WeekLine[] {
  const problems: WeekLine[] = [];
  if (current.recorded < thresholds.minDays) {
    problems.push(line('problems.fewDays', { days: current.recorded, length: current.length }));
  }
  if (lowPlan(current) && current.plan.rate !== null) {
    problems.push(
      line('problems.lowPlan', { done: current.plan.done, total: current.plan.total, percent: percent(current.plan.rate) }),
    );
  }
  for (const rule of current.rules.byRule) {
    if (rule.weight >= 3 && rule.broken >= thresholds.heavyRuleProblem) {
      problems.push(line('problems.heavyRule', { rule: rule.title, count: rule.broken }));
    } else if (rule.broken >= thresholds.ruleProblem) problems.push(line('problems.rule', { rule: rule.title, count: rule.broken }));
  }
  if (shortSleep(current, thresholds) && current.sleep) {
    problems.push(
      line('problems.shortSleep', { nights: current.sleep.shortNights, hours: hours(current.sleep.averageMinutes) }),
    );
  }
  if (trend === 'worse' && current.average !== null && previous?.average != null && previous.average - current.average >= 10) {
    problems.push(line('problems.worse', { diff: previous.average - current.average }));
  }
  if (problems.length === 0) problems.push(line('problems.none'));
  return problems;
}

/** Kandidati za promjenu tjedna, najvažniji prvi; uvijek završava sa „zadrži ritam“. */
export function weekIdeaCandidates(current: PeriodStats, thresholds: PeriodThresholds = WEEK_THRESHOLDS): WeekLine[] {
  const candidates: WeekLine[] = [];
  // Bez podataka nijedan drugi savjet nije pouzdan.
  if (current.recorded < thresholds.minDays) candidates.push(line('ideas.fillCheckin', { days: current.recorded }));
  const rule = current.rules.byRule[0];
  if (rule && rule.broken >= thresholds.ruleNoticed) {
    const trigger = rule.triggers[0];
    candidates.push(
      trigger !== undefined
        ? line('ideas.ruleTrigger', { rule: rule.title, trigger })
        : line('ideas.rule', { rule: rule.title }),
    );
  }
  const part = dominantPart(current.misses);
  if (current.plan.total >= 5 && current.plan.rate !== null && current.plan.rate < 0.6) {
    if (part?.part === 'evening') {
      candidates.push(line('ideas.eveningLighter'));
    } else {
      // Koliko se stvarno odradi po danu, plus jedan: plan koji se može ispuniti.
      const perDay = current.recorded > 0 ? Math.round(current.plan.done / current.recorded) : 0;
      candidates.push(line('ideas.smallerPlan', { count: Math.max(1, perDay + 1) }));
    }
  }
  if (shortSleep(current, thresholds)) candidates.push(line('ideas.bedEarlier'));
  const repeated = current.repeatedMisses[0];
  if (repeated && repeated.count >= thresholds.repeatedIdea) candidates.push(line('ideas.repeatedBlock', { title: repeated.title, count: repeated.count }));
  if (part?.part === 'evening') candidates.push(line('ideas.eveningLighter'));
  if (current.plan.moved >= thresholds.movedIdea) candidates.push(line('ideas.fewerMoves', { count: current.plan.moved }));
  candidates.push(line('ideas.keepRhythm'));
  const seen = new Set<string>();
  return candidates.filter((candidate) => (seen.has(candidate.key) ? false : (seen.add(candidate.key), true)));
}

type Carried = { key: WeekIdeaKey; area: IdeaArea; weeks: number };

/**
 * Promjena prihvaćena prošli tjedan i koliko tjedana zaredom traje (uključujući prošli). `null`
 * kad prošli tjedan nema prihvaćenog prijedloga s područjem.
 */
function carriedIdea(start: string, history: readonly WeekHistoryEntry[]): Carried | null {
  const byStart = new Map(history.map((entry) => [entry.start, entry]));
  const lastStart = addDays(start, -7);
  const last = lastStart === null ? undefined : byStart.get(lastStart);
  if (!last || last.accepted !== true || !isWeekIdeaKey(last.suggestion)) return null;
  const area = WEEK_IDEA_AREA[last.suggestion];
  if (area === null) return null;
  let weeks = 1;
  let cursor = lastStart === null ? null : addDays(lastStart, -7);
  while (cursor !== null) {
    const entry = byStart.get(cursor);
    if (!entry || entry.accepted !== true || entry.suggestion !== last.suggestion) break;
    weeks += 1;
    cursor = addDays(cursor, -7);
  }
  return { key: last.suggestion, area, weeks };
}

/** Prijedlozi odbijeni u zadnja dva tjedna — ne nude se ponovo. */
function rejectedKeys(start: string, history: readonly WeekHistoryEntry[]): Set<string> {
  const since = addDays(start, -REJECTED_COOLDOWN_DAYS);
  const rejected = new Set<string>();
  for (const entry of history) {
    if (entry.accepted !== false || entry.suggestion === null) continue;
    if (since !== null && entry.start >= since && entry.start < start) rejected.add(entry.suggestion);
  }
  return rejected;
}

/** Tjedna dijagnoza iz statistike tjedna i prošlog tjedna (`previous = null`: nema usporedbe). */
export function buildWeekDiagnosis(
  current: PeriodStats,
  previous: PeriodStats | null,
  { history = [], betterWeeks = 0, previousBest = null }: WeekDiagnosisOptions = {},
): WeekDiagnosis {
  const usablePrevious = previous !== null && previous.recorded > 0 ? previous : null;
  const trend = weekTrend(current, usablePrevious);
  const carried = carriedIdea(current.start, history);
  const followUp =
    carried !== null && usablePrevious !== null
      ? line(`followUp.${carried.area}.${followUpWorked(carried.area, current, usablePrevious) ? 'worked' : 'notYet'}`)
      : null;

  let idea: WeekLine;
  let suggestion: WeekIdeaKey | null;
  const stay = carried !== null && carried.weeks < STABLE_WEEKS;
  if (carried !== null && stay) {
    // Prihvaćena promjena još nije stabilna: ostaje jedina, bez nove uz nju.
    idea = line(`ideas.stay.${carried.area}`);
    suggestion = carried.key;
  } else {
    const rejected = rejectedKeys(current.start, history);
    idea =
      weekIdeaCandidates(current).find((candidate) => !rejected.has(candidate.key)) ?? line('ideas.keepRhythm');
    suggestion = isWeekIdeaKey(idea.key) && WEEK_IDEA_AREA[idea.key] !== null ? idea.key : null;
  }

  return {
    version: LOCAL_WEEK_DIAGNOSIS_VERSION,
    start: current.start,
    end: current.end,
    trend,
    summary: periodSummaryLine(current, usablePrevious, trend),
    progress: periodProgressRows(current, usablePrevious, trend, betterWeeks),
    praise: periodPraiseLines(current, usablePrevious, trend, betterWeeks, previousBest),
    noticed: periodNoticedLines(current, followUp),
    problems: periodProblemLines(current, usablePrevious, trend),
    ideas: [idea],
    suggestion,
    carried: stay,
    betterWeeks,
  };
}

/** Sekcije pohranjene dijagnoze, ili `null` ako JSON nije lokalna tjedna dijagnoza. */
export function parseWeekDiagnosis(sections: unknown): WeekDiagnosis | null {
  const result = weekDiagnosisSchema.safeParse(sections);
  return result.success ? result.data : null;
}

/**
 * Je li dijagnoza tjedna dostupna (koncept: nedjeljom uz dnevnu): tjedan je prošao, ili je danas
 * njegov zadnji dan i večernji upit je ispunjen. Treba i barem jedan zaključen dan u tjednu.
 */
export function isWeekDiagnosisReady(end: string, today: string, completedDates: Iterable<string>): boolean {
  let any = false;
  let lastDone = false;
  const start = addDays(end, -6);
  if (start === null) return false;
  for (const date of completedDates) {
    if (date < start || date > end) continue;
    any = true;
    if (date === end) lastDone = true;
  }
  if (!any) return false;
  return today > end || (today === end && lastDone);
}
