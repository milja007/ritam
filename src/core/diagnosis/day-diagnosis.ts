/**
 * Lokalna dnevna dijagnoza (bez LLM-a): iz statistike dana i jučer slaže sekcije redom iz
 * koncepta — Ukratko → Napredak → Pohvale → Što smo primijetili → Veliki problemi → Ideje za
 * napredak. Retci su i18n ključevi (`diagnosis.lines.*`) s parametrima, pa se prikazuju na
 * jeziku appa. Ton: činjenice pa tumačenje, kritika uvijek s idejom, bez kazni i posramljivanja.
 * Čista logika: bez React importa.
 */
import { z } from 'zod';

import { dayScore, SCORE_PARTS, scoreTrend, type ScorePart } from '../progress';
import { parseClock } from '../time/clock';
import type { DayStats } from './day-stats';

/** Verzija pravila (sprema se kao `reports.prompt_version`; LLM dijagnoza ima svoju). */
export const LOCAL_DAY_DIAGNOSIS_VERSION = 'local-day-v2';

/** Promjena udjela odrađenog plana (0–1) potrebna za pohvalu "bolje nego jučer". */
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

export const METRICS = ['score', 'plan', 'rules', 'sleep', 'xp', 'rating', 'streak'] as const;
export type Metric = (typeof METRICS)[number];

/** Svi retci lokalne dijagnoze (i18n `diagnosis.lines.<ključ>`). */
export const DIAGNOSIS_LINE_KEYS = [
  ...TRENDS.flatMap((trend) => [`summary.${trend}`, `summary.${trend}NoPlan`] as const),
  'praise.allDone',
  'praise.planBetter',
  'praise.rulesKept',
  'praise.bedtime',
  'praise.streak',
  'praise.goodRating',
  'praise.showedUp',
  'noticed.comment.partial',
  'noticed.comment.not',
  'noticed.trigger',
  'noticed.misses.evening',
  'noticed.misses.morning',
  'noticed.moved',
  'noticed.lowRatingDespitePlan',
  'noticed.goodRatingDespitePlan',
  'noticed.none',
  'problems.lowPlan',
  'problems.heavyRule',
  'problems.ruleBroken',
  'problems.shortSleep',
  'problems.none',
  'ideas.ruleTrigger',
  'ideas.ruleNote',
  'ideas.smallerPlan',
  'ideas.eveningEarlier',
  'ideas.earlierBed',
  'ideas.fewerMoves',
  'ideas.keepRhythm',
  'ideas.ruleSmallStep',
  'ideas.planBuffer',
  'ideas.eveningPrep',
  'ideas.screensOff',
] as const;
export type DiagnosisLineKey = (typeof DIAGNOSIS_LINE_KEYS)[number];

const paramsSchema = z.record(z.string(), z.union([z.string(), z.number()]));

export const diagnosisLineSchema = z.object({
  key: z.enum(DIAGNOSIS_LINE_KEYS),
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

const line = (key: DiagnosisLineKey, params?: DiagnosisLine['params']): DiagnosisLine =>
  params ? { key, params } : { key };

/**
 * Trend dana naspram jučer prema dnevnom rezultatu 0–100 (korak 16b, prag 5 bodova); `first` kad
 * jučer nema s čime usporediti.
 */
export function dayTrend(
  today: DayStats,
  yesterday: DayStats | null,
  areas: readonly ScorePart[] = SCORE_PARTS,
  yesterdayAreas: readonly ScorePart[] = areas,
): Trend {
  const now = dayScore(today, areas).score;
  const before = yesterday ? dayScore(yesterday, yesterdayAreas).score : null;
  if (now === null || before === null) return 'first';
  return scoreTrend(now - before);
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

function progressRows(
  today: DayStats,
  yesterday: DayStats | null,
  previousScore: number | null,
  areas: readonly ScorePart[],
): ProgressRow[] {
  const rows: ProgressRow[] = [];
  const score = dayScore(today, areas).score;
  if (score !== null) {
    const previous = previousScore;
    const dir = previous === null ? null : scoreTrend(score - previous);
    const direction = dir === null ? null : dir === 'better' ? 'up' : dir === 'worse' ? 'down' : 'same';
    rows.push({ metric: 'score', value: score, previous, change: direction, good: goodFor(direction) });
  }
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
 * Kandidati za ideju redom važnosti (najveći problem dana prvi); uvijek završava sa "zadrži ritam".
 * Koncept: malo po malo — nikad više promjena odjednom.
 */
function ideaCandidates(today: DayStats): DiagnosisLine[] {
  const candidates: DiagnosisLine[] = [];
  const rule = today.rules.brokenRules[0];
  if (rule) {
    candidates.push(
      rule.trigger !== null
        ? line('ideas.ruleTrigger', { rule: rule.title, trigger: rule.trigger })
        : line('ideas.ruleNote', { rule: rule.title }),
    );
  }
  if (today.plan.total >= 2 && today.plan.rate !== null && today.plan.rate < 0.5) {
    candidates.push(missPattern(today) === 'evening' ? line('ideas.eveningEarlier') : line('ideas.smallerPlan'));
  }
  if (today.sleep && today.sleep.minutes < SHORT_SLEEP_MINUTES) candidates.push(line('ideas.earlierBed'));
  if (missPattern(today) === 'evening') candidates.push(line('ideas.eveningEarlier'));
  if (today.plan.moved >= 2) candidates.push(line('ideas.fewerMoves'));
  candidates.push(line('ideas.keepRhythm'));
  const seen = new Set<string>();
  return candidates.filter((candidate) => (seen.has(candidate.key) ? false : (seen.add(candidate.key), true)));
}

/** Druga ideja za isti problem kad se ponavlja, a dan nema drugog problema. */
const ALTERNATIVE_IDEA: Partial<Record<DiagnosisLineKey, DiagnosisLineKey>> = {
  'ideas.ruleTrigger': 'ideas.ruleSmallStep',
  'ideas.ruleNote': 'ideas.ruleSmallStep',
  'ideas.smallerPlan': 'ideas.planBuffer',
  'ideas.fewerMoves': 'ideas.planBuffer',
  'ideas.eveningEarlier': 'ideas.eveningPrep',
  'ideas.earlierBed': 'ideas.screensOff',
};

/** Koliko je dana zaredom ideja ponuđena (spremljeno u parametrima ponovljene ideje). */
function repeatedDaysOf(idea: DiagnosisLine): number {
  const value = idea.params?.repeatedDays;
  return typeof value === 'number' && value >= 1 ? value : 1;
}

/**
 * Ideje za napredak (odluka P38): jedna mala ideja za najveći problem dana. Ako je ista kao jučer
 * (problem se ponavlja), ostaje — s brojem dana zaredom, da se vidi da nije riješeno — i dodaje se
 * nova ideja uz nju: sljedeći problem dana, ili drugi pristup istom problemu.
 * "Zadrži ritam" se ne broji kao ponavljanje.
 */
export function ideaLines(today: DayStats, previous: DayDiagnosis | null = null): DiagnosisLine[] {
  const candidates = ideaCandidates(today);
  const primary = candidates[0] ?? line('ideas.keepRhythm');
  const previousIdea = previous?.ideas[0];
  if (previousIdea === undefined || previousIdea.key !== primary.key || primary.key === 'ideas.keepRhythm') {
    return [primary];
  }
  const repeated: DiagnosisLine = {
    key: primary.key,
    params: { ...primary.params, repeatedDays: repeatedDaysOf(previousIdea) + 1 },
  };
  const next = candidates.find((candidate) => candidate.key !== primary.key && candidate.key !== 'ideas.keepRhythm');
  const alternative = ALTERNATIVE_IDEA[primary.key];
  const fresh = next ?? (alternative ? line(alternative, primary.params) : null);
  return fresh ? [repeated, fresh] : [repeated];
}

export type DayDiagnosisOptions = {
  /** Jučerašnja spremljena dijagnoza (za ponovljene ideje); bez nje nema ponavljanja. */
  previous?: DayDiagnosis | null;
  /** Područja koja korisnik prati za ovaj dan (korak 16c); zadano sva tri. */
  areas?: readonly ScorePart[];
  /** Područja s kojima je bodovan jučerašnji dan (P48); zadano isto kao `areas`. */
  yesterdayAreas?: readonly ScorePart[];
};

const NO_RULES: DayStats['rules'] = {
  active: 0,
  kept: 0,
  broken: 0,
  brokenRules: [],
  activeWeight: 0,
  keptWeight: 0,
};

/**
 * Statistika svedena na područja koja korisnik prati (odluka P50): neodabrane zabrane i san se ne
 * spominju ni u jednoj sekciji dijagnoze. Plan je uvijek uključen.
 */
export function statsForAreas(stats: DayStats, areas: readonly ScorePart[]): DayStats {
  return {
    ...stats,
    rules: areas.includes('rules') ? stats.rules : NO_RULES,
    sleep: areas.includes('sleep') ? stats.sleep : null,
  };
}

/** Dijagnoza dana iz statistike dana i jučer (jučer `null` = prvi dan / nema podataka). */
export function buildDayDiagnosis(
  fullToday: DayStats,
  fullYesterday: DayStats | null,
  { previous = null, areas = SCORE_PARTS, yesterdayAreas = areas }: DayDiagnosisOptions = {},
): DayDiagnosis {
  const today = statsForAreas(fullToday, areas);
  // Jučer: sekcije vide samo područja koja se prate danas; rezultat jučer je onaj s jučerašnjim područjima.
  const yesterday = fullYesterday ? statsForAreas(fullYesterday, areas) : null;
  const yesterdayScore = fullYesterday ? dayScore(fullYesterday, yesterdayAreas).score : null;
  const trend = dayTrend(fullToday, fullYesterday, areas, yesterdayAreas);
  return {
    version: LOCAL_DAY_DIAGNOSIS_VERSION,
    date: today.date,
    trend,
    summary: summaryLine(today, trend),
    progress: progressRows(today, yesterday, yesterdayScore, areas),
    praise: praiseLines(today, yesterday),
    noticed: noticedLines(today),
    problems: problemLines(today),
    ideas: ideaLines(today, previous),
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
