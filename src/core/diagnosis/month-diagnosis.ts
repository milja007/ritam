/**
 * Lokalna mjesečna dijagnoza (korak 37, bez LLM-a): ista statistika razdoblja i isti graditelji
 * redaka kao tjedna (`week-diagnosis.ts`), s pragovima za mjesec, plus ono što se vidi tek na
 * mjesecu — uzorak po danu u tjednu, prva naspram druge polovice i pregled promjena prihvaćenih
 * u tjednim dijagnozama. Retci su i18n ključevi (`diagnosis.month.lines.*`) s parametrima.
 *
 * „Malo po malo“ (koncept: najviše 1 nova promjena tjedno, 2 mjesečno): mjesec daje **najviše
 * dvije ideje kao smjer**, bez pitanja „hoćeš li“. Nove promjene i dalje nudi samo tjedna
 * dijagnoza, jednu po jednu — tako mjesec ne zaobilazi tjedno pravilo. Čista logika, bez Reacta.
 */
import { z } from 'zod';

import { daysInMonth } from '../ember/periods';
import { weekStart } from '../progress/compare';
import { daysBetween } from '../time/local-date';
import { TRENDS } from './day-diagnosis';
import type { PeriodDay, PeriodStats } from './period-stats';
import {
  periodNoticedLines,
  periodPraiseLines,
  periodProblemLines,
  periodProgressRows,
  periodSummaryLine,
  WEEK_LINE_KEYS,
  weekIdeaCandidates,
  weekProgressRowSchema,
  weekTrend,
  type PeriodThresholds,
  type WeekLine,
  type WeekLineKey,
} from './week-diagnosis';

/** Verzija pravila (sprema se kao `reports.prompt_version`). */
export const LOCAL_MONTH_DIAGNOSIS_VERSION = 'local-month-v1';

/** Ispod toliko zaključenih dana slika mjeseca je nepotpuna (otprilike trećina mjeseca). */
export const MIN_MONTH_DIAGNOSIS_DAYS = 10;
export const MAX_MONTH_IDEAS = 2;

export const MONTH_THRESHOLDS: PeriodThresholds = {
  minDays: MIN_MONTH_DIAGNOSIS_DAYS,
  ruleNoticed: 4,
  ruleProblem: 8,
  heavyRuleProblem: 4,
  shortNights: 8,
  repeatedIdea: 6,
  movedNoticed: 8,
  movedIdea: 12,
};

/** Dan u tjednu se spominje tek s toliko ocijenjenih dana u mjesecu i toliko uzoraka tog dana. */
const WEEKDAY_MIN_SCORED = 8;
const WEEKDAY_MIN_SAMPLES = 2;
/** Koliko dan u tjednu mora odstupati od prosjeka mjeseca da bi bio uzorak. */
const WEEKDAY_GAP = 12;
const HALF_MIN_SCORED = 3;
const HALF_GAP = 8;
const SECOND_HALF_FROM_DAY = 16;
const MAX_MONTH_NOTICED = 8;

/** Retci koje ima samo mjesečna dijagnoza. */
export const MONTH_EXTRA_LINE_KEYS = [
  'noticed.weekday.weak',
  'noticed.weekday.strong',
  'noticed.halves.up',
  'noticed.halves.down',
  'noticed.changes',
] as const;
type MonthExtraLineKey = (typeof MONTH_EXTRA_LINE_KEYS)[number];

/** Tjedni retci koji u mjesecu nemaju smisla: praćenje jedne promjene i niz boljih tjedana. */
type WeekOnlyLineKey = Extract<WeekLineKey, `followUp.${string}` | `ideas.stay.${string}` | 'praise.betterWeeks'>;
type SharedLineKey = Exclude<WeekLineKey, WeekOnlyLineKey>;
export type MonthLineKey = SharedLineKey | MonthExtraLineKey;

const isShared = (key: WeekLineKey): key is SharedLineKey =>
  !key.startsWith('followUp.') && !key.startsWith('ideas.stay.') && key !== 'praise.betterWeeks';

/** Svi retci mjesečne dijagnoze (i18n `diagnosis.month.lines.<ključ>`). */
export const MONTH_LINE_KEYS: readonly MonthLineKey[] = [...WEEK_LINE_KEYS.filter(isShared), ...MONTH_EXTRA_LINE_KEYS];

const isMonthLineKey = (key: string): key is MonthLineKey => (MONTH_LINE_KEYS as readonly string[]).includes(key);

export const monthLineSchema = z.object({
  key: z.string().refine(isMonthLineKey),
  /**
   * Parametar čije ime završava na `Date` je dan "YYYY-MM-DD" (prikaz: datum), a na `Weekday`
   * dan koji predstavlja dan u tjednu (prikaz: naziv dana).
   */
  params: z.record(z.string(), z.union([z.string(), z.number()])).optional(),
});
export type MonthLine = { key: MonthLineKey; params?: Record<string, string | number> };

export const monthDiagnosisSchema = z.object({
  version: z.literal(LOCAL_MONTH_DIAGNOSIS_VERSION),
  /** "YYYY-MM". */
  month: z.string(),
  start: z.string(),
  end: z.string(),
  trend: z.enum(TRENDS),
  summary: monthLineSchema,
  progress: z.array(weekProgressRowSchema),
  praise: z.array(monthLineSchema),
  noticed: z.array(monthLineSchema),
  problems: z.array(monthLineSchema),
  /** Jedna ili dvije ideje kao smjer; bez prihvaćanja (to radi tjedna dijagnoza). */
  ideas: z.array(monthLineSchema).min(1).max(MAX_MONTH_IDEAS),
  /** Odgovori na prijedloge tjednih dijagnoza tog mjeseca. */
  changes: z.object({ accepted: z.number(), rejected: z.number() }),
});
export type MonthDiagnosis = Omit<z.infer<typeof monthDiagnosisSchema>, 'summary' | 'praise' | 'noticed' | 'problems' | 'ideas'> & {
  summary: MonthLine;
  praise: MonthLine[];
  noticed: MonthLine[];
  problems: MonthLine[];
  ideas: MonthLine[];
};

export type MonthChanges = { accepted: number; rejected: number };

/** Prijedlog i odgovor iz jedne tjedne dijagnoze (za pregled promjena mjeseca). */
export type MonthWeekAnswer = { start: string; suggestion: string | null; accepted: boolean | null };

/**
 * Promjene mjeseca: različiti prijedlozi tjednih dijagnoza čiji tjedan počinje u tom mjesecu.
 * Prenesena promjena (isti prijedlog više tjedana) broji se jednom; prihvaćanje ima prednost.
 */
export function monthChanges(month: string, weeks: readonly MonthWeekAnswer[]): MonthChanges {
  const answers = new Map<string, boolean>();
  for (const week of weeks) {
    if (week.start.slice(0, 7) !== month || week.suggestion === null || week.accepted === null) continue;
    answers.set(week.suggestion, week.accepted || answers.get(week.suggestion) === true);
  }
  const accepted = [...answers.values()].filter((value) => value).length;
  return { accepted, rejected: answers.size - accepted };
}

export type MonthDiagnosisOptions = {
  /** Najbolji prosjek nekog ranijeg ubrojenog mjeseca; `null` kad ga nema. */
  previousBest?: number | null;
  changes?: MonthChanges;
};

const toMonthLine = (line: WeekLine): MonthLine[] => (isMonthLineKey(line.key) ? [{ ...line, key: line.key }] : []);
const toMonthLines = (lines: readonly WeekLine[]): MonthLine[] => lines.flatMap(toMonthLine);

const roundedMean = (values: readonly number[]): number =>
  Math.round(values.reduce((sum, value) => sum + value, 0) / values.length);

type Scored = { date: string; score: number };

const scoredDays = (stats: PeriodStats, days: readonly PeriodDay[]): Scored[] => {
  const byDate = new Map<string, number>();
  for (const day of days) {
    if (day.score !== null && day.stats.date >= stats.start && day.stats.date <= stats.end) {
      byDate.set(day.stats.date, day.score);
    }
  }
  return [...byDate.entries()].map(([date, score]) => ({ date, score })).sort((a, b) => a.date.localeCompare(b.date));
};

/** Najslabiji i najjači dan u tjednu naspram prosjeka mjeseca (samo kad jasno odstupaju). */
export function weekdayPattern(scored: readonly Scored[]): MonthLine[] {
  if (scored.length < WEEKDAY_MIN_SCORED) return [];
  const overall = roundedMean(scored.map((day) => day.score));
  const groups = new Map<number, Scored[]>();
  for (const day of scored) {
    const monday = weekStart(day.date);
    const weekday = monday === null ? null : daysBetween(monday, day.date);
    if (weekday === null) continue;
    groups.set(weekday, [...(groups.get(weekday) ?? []), day]);
  }
  const averages = [...groups.entries()]
    .filter(([, list]) => list.length >= WEEKDAY_MIN_SAMPLES)
    .map(([weekday, list]) => ({ weekday, date: list[0]?.date ?? '', average: roundedMean(list.map((day) => day.score)) }))
    .sort((a, b) => a.weekday - b.weekday);
  if (averages.length < 2) return [];
  const weakest = averages.reduce((low, entry) => (entry.average < low.average ? entry : low));
  const strongest = averages.reduce((high, entry) => (entry.average > high.average ? entry : high));
  const lines: MonthLine[] = [];
  if (overall - weakest.average >= WEEKDAY_GAP) {
    lines.push({ key: 'noticed.weekday.weak', params: { weakWeekday: weakest.date, average: weakest.average, overall } });
  }
  if (strongest.average - overall >= WEEKDAY_GAP) {
    lines.push({
      key: 'noticed.weekday.strong',
      params: { strongWeekday: strongest.date, average: strongest.average, overall },
    });
  }
  return lines;
}

/** Prva (1.–15.) naspram druge polovice mjeseca, kad se jasno razlikuju. */
export function halvesPattern(scored: readonly Scored[]): MonthLine | null {
  const dayOf = (date: string) => Number(date.slice(8, 10));
  const first = scored.filter((day) => dayOf(day.date) < SECOND_HALF_FROM_DAY).map((day) => day.score);
  const second = scored.filter((day) => dayOf(day.date) >= SECOND_HALF_FROM_DAY).map((day) => day.score);
  if (first.length < HALF_MIN_SCORED || second.length < HALF_MIN_SCORED) return null;
  const a = roundedMean(first);
  const b = roundedMean(second);
  if (Math.abs(a - b) < HALF_GAP) return null;
  return { key: b > a ? 'noticed.halves.up' : 'noticed.halves.down', params: { first: a, second: b } };
}

/**
 * Mjesečna dijagnoza iz statistike mjeseca i prošlog mjeseca (`previous = null`: nema
 * usporedbe). `days` su zaključeni dani mjeseca s rezultatima (za uzorke po danima).
 */
export function buildMonthDiagnosis(
  current: PeriodStats,
  previous: PeriodStats | null,
  days: readonly PeriodDay[],
  { previousBest = null, changes = { accepted: 0, rejected: 0 } }: MonthDiagnosisOptions = {},
): MonthDiagnosis {
  const usablePrevious = previous !== null && previous.recorded > 0 ? previous : null;
  const trend = weekTrend(current, usablePrevious);
  const scored = scoredDays(current, days);

  const shared = toMonthLines(periodNoticedLines(current, null, MONTH_THRESHOLDS)).filter(
    (line) => line.key !== 'noticed.none',
  );
  const half = halvesPattern(scored);
  const noticed: MonthLine[] = [
    ...(changes.accepted + changes.rejected > 0
      ? [{ key: 'noticed.changes' as const, params: { accepted: changes.accepted, rejected: changes.rejected } }]
      : []),
    ...weekdayPattern(scored),
    ...(half !== null ? [half] : []),
    ...shared,
  ].slice(0, MAX_MONTH_NOTICED);
  if (noticed.length === 0) noticed.push({ key: 'noticed.none' });

  const candidates = toMonthLines(weekIdeaCandidates(current, MONTH_THRESHOLDS));
  const real = candidates.filter((line) => line.key !== 'ideas.keepRhythm').slice(0, MAX_MONTH_IDEAS);
  const ideas: MonthLine[] = real.length > 0 ? real : [{ key: 'ideas.keepRhythm' }];

  const summary = toMonthLine(periodSummaryLine(current, usablePrevious, trend))[0] ?? {
    key: 'summary.empty',
    params: { days: current.recorded },
  };

  return {
    version: LOCAL_MONTH_DIAGNOSIS_VERSION,
    month: current.start.slice(0, 7),
    start: current.start,
    end: current.end,
    trend,
    summary,
    progress: periodProgressRows(current, usablePrevious, trend, null),
    praise: toMonthLines(periodPraiseLines(current, usablePrevious, trend, 0, previousBest)),
    noticed,
    problems: toMonthLines(periodProblemLines(current, usablePrevious, trend, MONTH_THRESHOLDS)),
    ideas,
    changes,
  };
}

/** Sekcije pohranjene dijagnoze, ili `null` ako JSON nije lokalna mjesečna dijagnoza. */
export function parseMonthDiagnosis(sections: unknown): MonthDiagnosis | null {
  const result = monthDiagnosisSchema.safeParse(sections);
  // Ključevi su provjereni `refine`-om; tip ih samo sužava.
  return result.success ? (result.data as MonthDiagnosis) : null;
}

/** Prvi i zadnji dan mjeseca "YYYY-MM"; `null` za neispravan mjesec. */
export function monthBounds(month: string): { start: string; end: string; length: number } | null {
  const length = /^\d{4}-\d{2}$/.test(month) ? daysInMonth(month) : 0;
  if (length === 0) return null;
  return { start: `${month}-01`, end: `${month}-${String(length).padStart(2, '0')}`, length };
}

/**
 * Je li dijagnoza mjeseca dostupna (koncept: zadnji dan u mjesecu uz dnevnu): mjesec je prošao,
 * ili je danas njegov zadnji dan i večernji upit je ispunjen. Treba i barem jedan zaključen dan.
 */
export function isMonthDiagnosisReady(month: string, today: string, completedDates: Iterable<string>): boolean {
  const bounds = monthBounds(month);
  if (bounds === null) return false;
  let any = false;
  let lastDone = false;
  for (const date of completedDates) {
    if (date < bounds.start || date > bounds.end) continue;
    any = true;
    if (date === bounds.end) lastDone = true;
  }
  if (!any) return false;
  return today > bounds.end || (today === bounds.end && lastDone);
}

/** Prosjeci ubrojenih mjeseci (≥ `MIN_MONTH_DIAGNOSIS_DAYS` konačnih rezultata) prije `month`. */
export function earlierMonthAverages(days: readonly { date: string; score: number; final: boolean }[], month: string): number[] {
  const byMonth = new Map<string, Map<string, number>>();
  for (const day of days) {
    const key = day.date.slice(0, 7);
    if (!day.final || key >= month) continue;
    const scores = byMonth.get(key) ?? new Map<string, number>();
    scores.set(day.date, day.score);
    byMonth.set(key, scores);
  }
  return [...byMonth.values()]
    .filter((scores) => scores.size >= MIN_MONTH_DIAGNOSIS_DAYS)
    .map((scores) => roundedMean([...scores.values()]));
}
