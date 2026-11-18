/**
 * Lokalna godišnja dijagnoza (korak 37b, bez LLM-a): koncept „31. 12. → dan + tjedan + mjesec +
 * godina“. Iste statistike i isti graditelji redaka kao tjedan i mjesec, s pragovima za godinu,
 * plus ono što se vidi tek na godini — najjači i najslabiji mjesec, najduži niz zaključenih dana,
 * prva naspram druge polovice godine, dan u tjednu i pregled tjednih promjena cijele godine.
 * Ideje su smjer za iduću godinu (najviše dvije), bez prihvaćanja — kao mjesec. Čista logika.
 */
import { z } from 'zod';

import { addDays, daysBetween } from '../time/local-date';
import { TRENDS } from './day-diagnosis';
import { llmYearTextSchema } from './llm-year';
import {
  isSharedLineKey,
  monthChanges,
  scoredDays,
  weekdayPattern,
  type MonthChanges,
  type MonthWeekAnswer,
  type Scored,
  type SharedLineKey,
} from './month-diagnosis';
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
} from './week-diagnosis';

/** Verzija pravila (sprema se kao `reports.prompt_version`). */
export const LOCAL_YEAR_DIAGNOSIS_VERSION = 'local-year-v1';

/** Ispod toliko zaključenih dana slika godine je nepotpuna (otprilike trećina godine). */
export const MIN_YEAR_DIAGNOSIS_DAYS = 120;
export const MAX_YEAR_IDEAS = 2;

export const YEAR_THRESHOLDS: PeriodThresholds = {
  minDays: MIN_YEAR_DIAGNOSIS_DAYS,
  ruleNoticed: 12,
  ruleProblem: 24,
  heavyRuleProblem: 12,
  shortNights: 40,
  repeatedIdea: 20,
  movedNoticed: 40,
  movedIdea: 60,
};

/** Mjesec ulazi u usporedbu mjeseci tek s toliko ocijenjenih dana. */
const MONTH_MIN_SCORED = 5;
/** Usporedba mjeseci treba barem toliko ubrojenih mjeseci. */
const MONTHS_MIN = 3;
/** Koliko mjesec mora odstupati od prosjeka godine da bi se spomenuo. */
const MONTH_GAP = 6;
const HALF_MIN_SCORED = 20;
const HALF_GAP = 6;
/** Niz zaključenih dana se spominje od toliko dana. */
const RUN_MIN = 7;
const MAX_YEAR_NOTICED = 8;

/** Retci koje ima samo godišnja dijagnoza (uz dan u tjednu i tjedne promjene iz mjeseca). */
export const YEAR_EXTRA_LINE_KEYS = [
  'noticed.weekday.weak',
  'noticed.weekday.strong',
  'noticed.changes',
  'noticed.month.strong',
  'noticed.month.weak',
  'noticed.run',
  'noticed.halves.up',
  'noticed.halves.down',
] as const;
type YearExtraLineKey = (typeof YEAR_EXTRA_LINE_KEYS)[number];
export type YearLineKey = SharedLineKey | YearExtraLineKey;

/** Svi retci godišnje dijagnoze (i18n `diagnosis.year.lines.<ključ>`). */
export const YEAR_LINE_KEYS: readonly YearLineKey[] = [...WEEK_LINE_KEYS.filter(isSharedLineKey), ...YEAR_EXTRA_LINE_KEYS];

const isYearLineKey = (key: string): key is YearLineKey => (YEAR_LINE_KEYS as readonly string[]).includes(key);

export const yearLineSchema = z.object({
  key: z.string().refine(isYearLineKey),
  /** `…Date`: dan "YYYY-MM-DD" (datum); `…Weekday`: naziv dana; `…Month`: "YYYY-MM" (naziv mjeseca). */
  params: z.record(z.string(), z.union([z.string(), z.number()])).optional(),
});
export type YearLine = { key: YearLineKey; params?: Record<string, string | number> };

export const yearDiagnosisSchema = z.object({
  version: z.literal(LOCAL_YEAR_DIAGNOSIS_VERSION),
  /** "YYYY". */
  year: z.string(),
  start: z.string(),
  end: z.string(),
  trend: z.enum(TRENDS),
  summary: yearLineSchema,
  progress: z.array(weekProgressRowSchema),
  praise: z.array(yearLineSchema),
  noticed: z.array(yearLineSchema),
  problems: z.array(yearLineSchema),
  ideas: z.array(yearLineSchema).min(1).max(MAX_YEAR_IDEAS),
  changes: z.object({ accepted: z.number(), rejected: z.number() }),
  /** Prosjek po mjesecu (`null` = mjesec bez ocijenjenih dana), 12 vrijednosti — za traku žarova. */
  months: z.array(z.number().nullable()).length(12),
  /** Riječi modela (korak 31e); brojke, trend, mjeseci i smjer ostaju lokalni. Pokvaren tekst ne ruši lokalnu. */
  llm: llmYearTextSchema.optional().catch(undefined),
});
export type YearDiagnosis = Omit<z.infer<typeof yearDiagnosisSchema>, 'summary' | 'praise' | 'noticed' | 'problems' | 'ideas'> & {
  summary: YearLine;
  praise: YearLine[];
  noticed: YearLine[];
  problems: YearLine[];
  ideas: YearLine[];
};

export type YearDiagnosisOptions = {
  /** Najbolji prosjek neke ranije ubrojene godine; `null` kad je nema. */
  previousBest?: number | null;
  changes?: MonthChanges;
};

const toYearLine = (line: WeekLine): YearLine[] => (isYearLineKey(line.key) ? [{ ...line, key: line.key }] : []);
const toYearLines = (lines: readonly WeekLine[]): YearLine[] => lines.flatMap(toYearLine);

const mean = (values: readonly number[]): number => Math.round(values.reduce((sum, value) => sum + value, 0) / values.length);

/** Prvi i zadnji dan godine "YYYY"; `null` za neispravnu godinu. */
export function yearBounds(year: string): { start: string; end: string; length: number } | null {
  if (!/^\d{4}$/.test(year)) return null;
  const start = `${year}-01-01`;
  const end = `${year}-12-31`;
  const span = daysBetween(start, end);
  return span === null ? null : { start, end, length: span + 1 };
}

/** Je li `date` zadnji dan godine (31. 12.). */
export function isYearLastDay(date: string): boolean {
  return /^\d{4}-12-31$/.test(date);
}

/** Prosjek po mjesecu godine (12 vrijednosti; `null` za mjesec bez ocijenjenih dana). */
export function yearMonthAverages(year: string, scored: readonly Scored[]): (number | null)[] {
  return Array.from({ length: 12 }, (_, index) => {
    const prefix = `${year}-${String(index + 1).padStart(2, '0')}`;
    const values = scored.filter((day) => day.date.startsWith(prefix)).map((day) => day.score);
    return values.length > 0 ? mean(values) : null;
  });
}

/** Najjači i najslabiji mjesec naspram prosjeka godine (samo mjeseci s dovoljno dana). */
export function monthPattern(year: string, scored: readonly Scored[]): YearLine[] {
  const counted = Array.from({ length: 12 }, (_, index) => {
    const month = `${year}-${String(index + 1).padStart(2, '0')}`;
    const values = scored.filter((day) => day.date.startsWith(month)).map((day) => day.score);
    return { month, values, count: values.length, average: values.length > 0 ? mean(values) : 0 };
  }).filter((entry) => entry.count >= MONTH_MIN_SCORED);
  if (counted.length < MONTHS_MIN) return [];
  // Prosjek godine iz istih (ubrojenih) mjeseci, da par usamljenih dana ne pomakne usporedbu.
  const overall = mean(counted.flatMap((entry) => entry.values));
  const strongest = counted.reduce((high, entry) => (entry.average > high.average ? entry : high));
  const weakest = counted.reduce((low, entry) => (entry.average < low.average ? entry : low));
  const lines: YearLine[] = [];
  if (strongest.average - overall >= MONTH_GAP) {
    lines.push({ key: 'noticed.month.strong', params: { strongMonth: strongest.month, average: strongest.average, overall } });
  }
  if (overall - weakest.average >= MONTH_GAP) {
    lines.push({ key: 'noticed.month.weak', params: { weakMonth: weakest.month, average: weakest.average, overall } });
  }
  return lines;
}

/** Najduži niz uzastopnih zaključenih dana u godini (početak i duljina); `null` ispod `RUN_MIN`. */
export function longestClosedRun(dates: readonly string[]): { startDate: string; days: number } | null {
  const sorted = [...new Set(dates)].sort();
  let best: { startDate: string; days: number } | null = null;
  let runStart: string | null = null;
  let runLength = 0;
  let previous: string | null = null;
  for (const date of sorted) {
    if (previous !== null && addDays(previous, 1) === date) {
      runLength += 1;
    } else {
      runStart = date;
      runLength = 1;
    }
    if (runStart !== null && (best === null || runLength > best.days)) best = { startDate: runStart, days: runLength };
    previous = date;
  }
  return best !== null && best.days >= RUN_MIN ? best : null;
}

/** Prva (siječanj–lipanj) naspram druge polovice godine, kad se jasno razlikuju. */
export function yearHalvesPattern(scored: readonly Scored[]): YearLine | null {
  const month = (date: string) => Number(date.slice(5, 7));
  const first = scored.filter((day) => month(day.date) <= 6).map((day) => day.score);
  const second = scored.filter((day) => month(day.date) > 6).map((day) => day.score);
  if (first.length < HALF_MIN_SCORED || second.length < HALF_MIN_SCORED) return null;
  const a = mean(first);
  const b = mean(second);
  if (Math.abs(a - b) < HALF_GAP) return null;
  return { key: b > a ? 'noticed.halves.up' : 'noticed.halves.down', params: { first: a, second: b } };
}

/** Promjene iz tjednih dijagnoza čiji tjedan počinje u godini (iste konkretne ideje jednom). */
export function yearChanges(year: string, weeks: readonly MonthWeekAnswer[]): MonthChanges {
  return monthChanges(year, weeks);
}

/**
 * Godišnja dijagnoza iz statistike godine i prošle godine (`previous = null`: nema usporedbe).
 * `days` su zaključeni dani godine s rezultatima.
 */
export function buildYearDiagnosis(
  current: PeriodStats,
  previous: PeriodStats | null,
  days: readonly PeriodDay[],
  { previousBest = null, changes = { accepted: 0, rejected: 0 } }: YearDiagnosisOptions = {},
): YearDiagnosis {
  const year = current.start.slice(0, 4);
  const usablePrevious = previous !== null && previous.recorded > 0 ? previous : null;
  const trend = weekTrend(current, usablePrevious);
  const scored = scoredDays(current, days);
  const run = longestClosedRun(current.dates);
  const half = yearHalvesPattern(scored);

  const shared = toYearLines(periodNoticedLines(current, null, YEAR_THRESHOLDS)).filter(
    (line) => line.key !== 'noticed.none' && line.key !== 'noticed.comment',
  );
  const noticed: YearLine[] = [
    ...monthPattern(year, scored),
    ...(run !== null ? [{ key: 'noticed.run' as const, params: { days: run.days, startDate: run.startDate } }] : []),
    ...(half !== null ? [half] : []),
    ...(changes.accepted + changes.rejected > 0
      ? [{ key: 'noticed.changes' as const, params: { accepted: changes.accepted, rejected: changes.rejected } }]
      : []),
    ...(weekdayPattern(scored) as YearLine[]),
    ...shared,
  ].slice(0, MAX_YEAR_NOTICED);
  if (noticed.length === 0) noticed.push({ key: 'noticed.none' });

  const candidates = toYearLines(weekIdeaCandidates(current, YEAR_THRESHOLDS));
  const real = candidates.filter((line) => line.key !== 'ideas.keepRhythm').slice(0, MAX_YEAR_IDEAS);
  const ideas: YearLine[] = real.length > 0 ? real : [{ key: 'ideas.keepRhythm' }];

  const summary = toYearLine(periodSummaryLine(current, usablePrevious, trend))[0] ?? {
    key: 'summary.empty',
    params: { days: current.recorded },
  };

  return {
    version: LOCAL_YEAR_DIAGNOSIS_VERSION,
    year,
    start: current.start,
    end: current.end,
    trend,
    summary,
    progress: periodProgressRows(current, usablePrevious, trend, null),
    praise: toYearLines(periodPraiseLines(current, usablePrevious, trend, 0, previousBest)),
    noticed,
    problems: toYearLines(periodProblemLines(current, usablePrevious, trend, YEAR_THRESHOLDS)),
    ideas,
    changes,
    months: yearMonthAverages(year, scored),
  };
}

/** Sekcije pohranjene dijagnoze, ili `null` ako JSON nije lokalna godišnja dijagnoza. */
export function parseYearDiagnosis(sections: unknown): YearDiagnosis | null {
  const result = yearDiagnosisSchema.safeParse(sections);
  return result.success ? (result.data as YearDiagnosis) : null;
}

/**
 * Je li dijagnoza godine dostupna: godina je prošla, ili je danas 31. 12. i večernji upit je
 * ispunjen. Treba i barem jedan zaključen dan u godini.
 */
export function isYearDiagnosisReady(year: string, today: string, completedDates: Iterable<string>): boolean {
  const bounds = yearBounds(year);
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

/** Prosjeci ubrojenih godina (≥ `MIN_YEAR_DIAGNOSIS_DAYS` konačnih rezultata) prije `year`. */
export function earlierYearAverages(days: readonly { date: string; score: number; final: boolean }[], year: string): number[] {
  const byYear = new Map<string, Map<string, number>>();
  for (const day of days) {
    const key = day.date.slice(0, 4);
    if (!day.final || key >= year) continue;
    const scores = byYear.get(key) ?? new Map<string, number>();
    scores.set(day.date, day.score);
    byYear.set(key, scores);
  }
  return [...byYear.values()]
    .filter((scores) => scores.size >= MIN_YEAR_DIAGNOSIS_DAYS)
    .map((scores) => mean([...scores.values()]));
}
