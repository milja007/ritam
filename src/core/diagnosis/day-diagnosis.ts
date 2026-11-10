/**
 * Lokalna dnevna dijagnoza (bez LLM-a): iz statistike dana i jučer slaže sekcije redom iz
 * koncepta — Ukratko → Napredak → Pohvale → Što smo primijetili → Veliki problemi → Ideje za
 * napredak. Retci su i18n ključevi (`diagnosis.lines.*`) s parametrima, pa se prikazuju na
 * jeziku appa. Ton: činjenice pa tumačenje, kritika uvijek s idejom, bez kazni i posramljivanja.
 * Čista logika: bez React importa.
 */
import { z } from 'zod';

import { parseClock } from '../time/clock';
import { dayBalance, type DayStats } from './day-stats';

/** Verzija pravila (sprema se kao `reports.prompt_version`; LLM dijagnoza ima svoju). */
export const LOCAL_DAY_DIAGNOSIS_VERSION = 'local-day-v1';

/** Promjena omjera dana (0–1) potrebna da dan bude "bolji" ili "lošiji" od jučer. */
export const TREND_THRESHOLD = 0.1;
/** Manje sna od ovoga je veliki problem (6 h). */
export const SHORT_SLEEP_MINUTES = 6 * 60;
/** Propusti od ovog sata nadalje su "navečer", prije podneva "ujutro". */
const EVENING_FROM_MINUTES = 17 * 60;
const MORNING_UNTIL_MINUTES = 12 * 60;
const MAX_COMMENTS = 3;
const MAX_PRAISE = 3;

export const TRENDS = ['better', 'same', 'worse', 'first'] as const;
export type Trend = (typeof TRENDS)[number];

export const METRICS = ['plan', 'rules', 'sleep', 'xp', 'rating', 'streak'] as const;
export type Metric = (typeof METRICS)[number];

const paramsSchema = z.record(z.string(), z.union([z.string(), z.number()]));

export const diagnosisLineSchema = z.object({
  key: z.string().min(1),
  params: paramsSchema.optional(),
});
export type DiagnosisLine = z.infer<typeof diagnosisLineSchema>;

export const progressRowSchema = z.object({
  metric: z.enum(METRICS),
  /** Vrijednost danas (plan/zabrane: odrađeno; san: minute). */
  value: z.number(),
  /** Ukupno (plan/zabrane), inače izostavljeno. */
  total: z.number().optional(),
  /** Ista mjera jučer, `null` kad je jučer nema. */
  previous: z.number().nullable(),
  previousTotal: z.number().optional(),
  /** Smjer broja naspram jučer. */
  change: z.enum(['up', 'down', 'same']).nullable(),
  /** Je li promjena dobra; `null` = neutralno (npr. san — više nije uvijek bolje). */
  good: z.boolean().nullable(),
});
export type ProgressRow = z.infer<typeof progressRowSchema>;

export const dayDiagnosisSchema = z.object({
  version: z.literal(LOCAL_DAY_DIAGNOSIS_VERSION),
  date: z.string(),
  trend: z.enum(TRENDS),
  summary: diagnosisLineSchema,
  progress: z.array(progressRowSchema),
  praise: z.array(diagnosisLineSchema),
  noticed: z.array(diagnosisLineSchema),
  problems: z.array(diagnosisLineSchema),
  ideas: z.array(diagnosisLineSchema),
});
export type DayDiagnosis = z.infer<typeof dayDiagnosisSchema>;

const line = (key: string, params?: DiagnosisLine['params']): DiagnosisLine =>
  params ? { key, params } : { key };

/** Trend dana naspram jučer; `first` kad jučer nema s čime usporediti. */
export function dayTrend(today: DayStats, yesterday: DayStats | null): Trend {
  const now = dayBalance(today);
  const before = yesterday ? dayBalance(yesterday) : null;
  if (now === null || before === null) return 'first';
  const diff = now - before;
  if (diff >= TREND_THRESHOLD - 1e-9) return 'better';
  if (diff <= -TREND_THRESHOLD + 1e-9) return 'worse';
  return 'same';
}

function change(value: number, previous: number | null): ProgressRow['change'] {
  if (previous === null) return null;
  if (Math.abs(value - previous) < 1e-9) return 'same';
  return value > previous ? 'up' : 'down';
}

function goodFor(direction: ProgressRow['change']): boolean | null {
  if (direction === null || direction === 'same') return null;
  return direction === 'up';
}

/** Omjer za usporedbu plana/zabrana (različiti ukupni brojevi dana). */
const ratio = (value: number, total: number) => (total > 0 ? value / total : 0);

function progressRows(today: DayStats, yesterday: DayStats | null): ProgressRow[] {
  const rows: ProgressRow[] = [];
  const yPlan = yesterday && yesterday.plan.total > 0 ? yesterday.plan : null;
  if (today.plan.total > 0) {
    const doneToday = today.plan.done + today.plan.partial / 2;
    const dir = yPlan
      ? change(ratio(doneToday, today.plan.total), ratio(yPlan.done + yPlan.partial / 2, yPlan.total))
      : null;
    rows.push({
      metric: 'plan',
      value: today.plan.done,
      total: today.plan.total,
      previous: yPlan ? yPlan.done : null,
      ...(yPlan ? { previousTotal: yPlan.total } : {}),
      change: dir,
      good: goodFor(dir),
    });
  }
  const yRules = yesterday && yesterday.rules.active > 0 ? yesterday.rules : null;
  if (today.rules.active > 0) {
    const dir = yRules
      ? change(ratio(today.rules.kept, today.rules.active), ratio(yRules.kept, yRules.active))
      : null;
    rows.push({
      metric: 'rules',
      value: today.rules.kept,
      total: today.rules.active,
      previous: yRules ? yRules.kept : null,
      ...(yRules ? { previousTotal: yRules.active } : {}),
      change: dir,
      good: goodFor(dir),
    });
  }
  if (today.sleep) {
    const previous = yesterday?.sleep?.minutes ?? null;
    rows.push({
      metric: 'sleep',
      value: today.sleep.minutes,
      previous,
      change: change(today.sleep.minutes, previous),
      good: null,
    });
  }
  const xpDir = change(today.xp, yesterday ? yesterday.xp : null);
  rows.push({ metric: 'xp', value: today.xp, previous: yesterday ? yesterday.xp : null, change: xpDir, good: goodFor(xpDir) });
  if (today.rating !== null) {
    const previous = yesterday?.rating ?? null;
    const dir = change(today.rating, previous);
    rows.push({ metric: 'rating', value: today.rating, previous, change: dir, good: goodFor(dir) });
  }
  rows.push({ metric: 'streak', value: today.streak, previous: null, change: null, good: null });
  return rows;
}

function summaryLine(today: DayStats, trend: Trend): DiagnosisLine {
  if (today.plan.total === 0) return line(`summary.${trend}NoPlan`);
  return line(`summary.${trend}`, { done: today.plan.done, total: today.plan.total });
}

function planImproved(today: DayStats, yesterday: DayStats | null): boolean {
  if (!yesterday || today.plan.rate === null || yesterday.plan.rate === null) return false;
  return today.plan.rate - yesterday.plan.rate >= TREND_THRESHOLD - 1e-9;
}

function praiseLines(today: DayStats, yesterday: DayStats | null): DiagnosisLine[] {
  const praise: DiagnosisLine[] = [];
  if (today.plan.total > 0 && today.plan.done === today.plan.total) {
    praise.push(line('praise.allDone', { total: today.plan.total }));
  } else if (planImproved(today, yesterday)) {
    praise.push(line('praise.planBetter', { done: today.plan.done, total: today.plan.total }));
  }
  if (today.rules.active > 0 && today.rules.broken === 0) {
    praise.push(line('praise.rulesKept', { count: today.rules.kept }));
  }
  if (today.sleep?.onTarget === true) praise.push(line('praise.bedtime'));
  if (today.streak >= 3) praise.push(line('praise.streak', { days: today.streak }));
  if (today.rating !== null && today.rating >= 4) praise.push(line('praise.goodRating', { rating: today.rating }));
  // Uvijek barem jedna pohvala: ispunjen upit je navika koju gradimo.
  if (praise.length === 0) praise.push(line('praise.showedUp'));
  return praise.slice(0, MAX_PRAISE);
}

/** Jesu li svi (barem dva) propusta u istom dijelu dana. */
function missPattern(today: DayStats): 'evening' | 'morning' | null {
  if (today.misses.length < 2) return null;
  const starts = today.misses.map((miss) => parseClock(miss.start) ?? -1);
  if (starts.every((start) => start >= EVENING_FROM_MINUTES)) return 'evening';
  if (starts.every((start) => start >= 0 && start < MORNING_UNTIL_MINUTES)) return 'morning';
  return null;
}

function noticedLines(today: DayStats): DiagnosisLine[] {
  const noticed: DiagnosisLine[] = [];
  for (const item of today.comments.slice(0, MAX_COMMENTS)) {
    noticed.push(line(`noticed.comment.${item.outcome}`, { title: item.title, comment: item.comment }));
  }
  for (const rule of today.rules.brokenRules) {
    if (rule.trigger !== null) noticed.push(line('noticed.trigger', { rule: rule.title, trigger: rule.trigger }));
  }
  const pattern = missPattern(today);
  if (pattern !== null) noticed.push(line(`noticed.misses.${pattern}`, { count: today.misses.length }));
  if (today.plan.moved > 0) noticed.push(line('noticed.moved', { count: today.plan.moved }));
  if (today.rating !== null && today.plan.rate !== null) {
    if (today.rating <= 2 && today.plan.rate >= 0.8) noticed.push(line('noticed.lowRatingDespitePlan'));
    else if (today.rating >= 4 && today.plan.rate < 0.5) noticed.push(line('noticed.goodRatingDespitePlan'));
  }
  if (noticed.length === 0) noticed.push(line('noticed.none'));
  return noticed;
}

function problemLines(today: DayStats): DiagnosisLine[] {
  const problems: DiagnosisLine[] = [];
  if (today.plan.total >= 2 && today.plan.rate !== null && today.plan.rate < 0.5) {
    problems.push(line('problems.lowPlan', { done: today.plan.done, total: today.plan.total }));
  }
  for (const rule of today.rules.brokenRules) {
    problems.push(line(rule.weight >= 3 ? 'problems.heavyRule' : 'problems.ruleBroken', { rule: rule.title }));
  }
  if (today.sleep && today.sleep.minutes < SHORT_SLEEP_MINUTES) {
    problems.push(line('problems.shortSleep', { hours: Math.round((today.sleep.minutes / 60) * 10) / 10 }));
  }
  if (problems.length === 0) problems.push(line('problems.none'));
  return problems;
}

/**
 * Jedna mala ideja (koncept: malo po malo — nikad više promjena odjednom). Prednost ima
 * najveći problem dana; bez problema → zadrži ritam.
 */
function ideaLine(today: DayStats): DiagnosisLine {
  const rule = today.rules.brokenRules[0];
  if (rule) {
    return rule.trigger !== null
      ? line('ideas.ruleTrigger', { rule: rule.title, trigger: rule.trigger })
      : line('ideas.ruleNote', { rule: rule.title });
  }
  if (today.plan.total >= 2 && today.plan.rate !== null && today.plan.rate < 0.5) {
    return missPattern(today) === 'evening' ? line('ideas.eveningEarlier') : line('ideas.smallerPlan');
  }
  if (today.sleep && today.sleep.minutes < SHORT_SLEEP_MINUTES) return line('ideas.earlierBed');
  if (missPattern(today) === 'evening') return line('ideas.eveningEarlier');
  if (today.plan.moved >= 2) return line('ideas.fewerMoves');
  return line('ideas.keepRhythm');
}

/** Dijagnoza dana iz statistike dana i jučer (jučer `null` = prvi dan / nema podataka). */
export function buildDayDiagnosis(today: DayStats, yesterday: DayStats | null): DayDiagnosis {
  const trend = dayTrend(today, yesterday);
  return {
    version: LOCAL_DAY_DIAGNOSIS_VERSION,
    date: today.date,
    trend,
    summary: summaryLine(today, trend),
    progress: progressRows(today, yesterday),
    praise: praiseLines(today, yesterday),
    noticed: noticedLines(today),
    problems: problemLines(today),
    ideas: [ideaLine(today)],
  };
}

/** Ključ ponuđene ideje (sprema se kao `reports.suggestion`). */
export function diagnosisSuggestion(diagnosis: DayDiagnosis): string | null {
  return diagnosis.ideas[0]?.key ?? null;
}

/** Sekcije pohranjene dijagnoze, ili `null` ako JSON nije lokalna dnevna dijagnoza. */
export function parseDayDiagnosis(sections: unknown): DayDiagnosis | null {
  const result = dayDiagnosisSchema.safeParse(sections);
  return result.success ? result.data : null;
}
