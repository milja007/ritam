/**
 * Usporedbe dnevnog rezultata s vlastitom prošlošću (korak 16b): jučer, isti dan prošli tjedan,
 * zadnjih 7 dana naspram 7 prije, osobni rekordi. Mjeri se "bolje nego prije", ne savršenstvo.
 * Čista logika: bez React importa.
 */
import { addDays, daysBetween } from '../time/local-date';

/** Razlika u bodovima potrebna da dan bude "bolji" ili "slabiji". */
export const SCORE_TREND_THRESHOLD = 5;

export type ScoreTrend = 'better' | 'same' | 'worse';

/** Rezultat jednog dana; `final = false` dok večernji upit tog dana nije ispunjen. */
export type ScoredDay = { date: string; score: number; final: boolean };

export type ScoreComparison = { previous: number; diff: number; trend: ScoreTrend };

export type PeriodRecord = { start: string; average: number; days: number };

export type ProgressOverview = {
  date: string;
  today: ScoredDay | null;
  vsYesterday: ScoreComparison | null;
  vsLastWeek: ScoreComparison | null;
  /** Prosjek zadnjih 7 dana (do danas) i 7 prije; `null` bez ocijenjenih dana u razdoblju. */
  last7: number | null;
  prev7: number | null;
  last7Trend: ScoreTrend | null;
  records: {
    day: { date: string; score: number } | null;
    week: PeriodRecord | null;
    month: PeriodRecord | null;
    longestStreak: number;
  };
  /** Današnji rezultat je novi (ili izjednačen) osobni rekord dana, uz barem jedan raniji dan. */
  isDayRecord: boolean;
};

export function scoreTrend(diff: number): ScoreTrend {
  if (diff >= SCORE_TREND_THRESHOLD) return 'better';
  if (diff <= -SCORE_TREND_THRESHOLD) return 'worse';
  return 'same';
}

function compare(score: number, previous: number | undefined): ScoreComparison | null {
  if (previous === undefined) return null;
  const diff = score - previous;
  return { previous, diff, trend: scoreTrend(diff) };
}

const average = (values: readonly number[]): number | null =>
  values.length === 0 ? null : Math.round(values.reduce((sum, value) => sum + value, 0) / values.length);

function windowAverage(byDate: Map<string, number>, end: string, length: number): number | null {
  const values: number[] = [];
  for (let offset = 0; offset < length; offset += 1) {
    const date = addDays(end, -offset);
    const score = date === null ? undefined : byDate.get(date);
    if (score !== undefined) values.push(score);
  }
  return average(values);
}

/** Ponedjeljak tjedna kojem dan pripada. */
export function weekStart(date: string): string | null {
  const ms = Date.parse(`${date}T00:00:00Z`);
  if (Number.isNaN(ms)) return null;
  const weekday = (new Date(ms).getUTCDay() + 6) % 7; // pon = 0
  return addDays(date, -weekday);
}

const monthStart = (date: string) => `${date.slice(0, 7)}-01`;

function daysInMonth(start: string): number {
  const next = addDays(start, 31);
  const nextMonth = next === null ? null : monthStart(next);
  return nextMonth === null ? 31 : (daysBetween(start, nextMonth) ?? 31);
}

/**
 * Najbolji tjedan/mjesec po prosjeku. Razdoblje ulazi tek kad je ocijenjeno barem pola njegovih
 * dana (inače bi jedan sjajan dan bio "rekord tjedna"). Kod izjednačenja vrijedi raniji.
 */
function bestPeriod(
  days: readonly ScoredDay[],
  startOf: (date: string) => string | null,
  lengthOf: (start: string) => number,
): PeriodRecord | null {
  const groups = new Map<string, number[]>();
  for (const day of days) {
    const start = startOf(day.date);
    if (start === null) continue;
    const list = groups.get(start) ?? [];
    list.push(day.score);
    groups.set(start, list);
  }
  let best: PeriodRecord | null = null;
  for (const [start, scores] of [...groups.entries()].sort(([a], [b]) => a.localeCompare(b))) {
    if (scores.length * 2 < lengthOf(start)) continue;
    const avg = average(scores);
    if (avg !== null && (best === null || avg > best.average)) best = { start, average: avg, days: scores.length };
  }
  return best;
}

/**
 * Pregled napretka za dan `date`. `days` = ocijenjeni dani (bez `null` rezultata); dani poslije
 * `date` se zanemaruju. Rekordi broje sve dane do `date`, uključujući današnji "u tijeku".
 */
export function progressOverview(
  days: readonly ScoredDay[],
  date: string,
  longestStreak = 0,
): ProgressOverview {
  const upTo = days.filter((day) => day.date <= date).sort((a, b) => a.date.localeCompare(b.date));
  const byDate = new Map(upTo.map((day) => [day.date, day.score]));
  const today = upTo.find((day) => day.date === date) ?? null;
  const yesterday = addDays(date, -1);
  const lastWeek = addDays(date, -7);
  const prevEnd = addDays(date, -7);

  const last7 = windowAverage(byDate, date, 7);
  const prev7 = prevEnd === null ? null : windowAverage(byDate, prevEnd, 7);

  let dayRecord: { date: string; score: number } | null = null;
  for (const day of upTo) {
    if (dayRecord === null || day.score > dayRecord.score) dayRecord = { date: day.date, score: day.score };
  }
  const earlier = upTo.filter((day) => day.date < date);
  const bestEarlier = earlier.reduce<number | null>((best, day) => (best === null || day.score > best ? day.score : best), null);

  return {
    date,
    today,
    vsYesterday: today && yesterday !== null ? compare(today.score, byDate.get(yesterday)) : null,
    vsLastWeek: today && lastWeek !== null ? compare(today.score, byDate.get(lastWeek)) : null,
    last7,
    prev7,
    last7Trend: last7 !== null && prev7 !== null ? scoreTrend(last7 - prev7) : null,
    records: {
      day: dayRecord,
      week: bestPeriod(upTo, weekStart, () => 7),
      month: bestPeriod(upTo, monthStart, daysInMonth),
      longestStreak,
    },
    isDayRecord: today !== null && bestEarlier !== null && today.score >= bestEarlier,
  };
}
