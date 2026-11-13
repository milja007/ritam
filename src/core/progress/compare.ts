/**
 * Usporedbe dnevnog rezultata s vlastitom prošlošću (korak 16b): jučer, isti dan prošli tjedan,
 * zadnjih 7 dana naspram 7 prije, osobni rekordi. Mjeri se "bolje nego prije", ne savršenstvo.
 * Čista logika: bez React importa.
 */
import { addDays } from '../time/local-date';
import type { ScorePart } from './score';

/** Razlika u bodovima potrebna da dan bude "bolji" ili "slabiji". */
export const SCORE_TREND_THRESHOLD = 5;

export type ScoreTrend = 'better' | 'same' | 'worse';

/**
 * Rezultat jednog dana; `final = false` dok večernji upit tog dana nije ispunjen.
 * `parts` su dijelovi rezultata 0–1 (plan / zabrane / san) za statove (korak 34b); `null` =
 * nije zabilježeno ili područje nije odabrano.
 */
export type ScoredDay = {
  date: string;
  score: number;
  final: boolean;
  parts?: Readonly<Record<ScorePart, number | null>>;
};

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

/**
 * Najbolji tjedan/mjesec po prosjeku ocijenjenih dana. Bez uvjeta o broju dana (odluka P42): ulazi
 * svako razdoblje s barem jednim ocijenjenim danom. Kod izjednačenja vrijedi raniji.
 */
function bestPeriod(days: readonly ScoredDay[], startOf: (date: string) => string | null): PeriodRecord | null {
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
      week: bestPeriod(upTo, weekStart),
      month: bestPeriod(upTo, monthStart),
      longestStreak,
    },
    isDayRecord: today !== null && bestEarlier !== null && today.score >= bestEarlier,
  };
}

export type ScoreHeadline = {
  /** Dan koji se prikazuje velik: jučer (konačan) dok današnji upit nije ispunjen, inače danas. */
  featured: ProgressOverview;
  /** `true` kad je istaknut jučerašnji konačni rezultat. */
  featuresYesterday: boolean;
  /** Današnji rezultat "u tijeku" (manji, ispod) kad je istaknut jučer; inače `null`. */
  todayInProgress: ScoredDay | null;
};

/**
 * Što Danas prikazuje (odluka P43): prije večernjeg upita jučerašnji konačni rezultat velik i
 * današnji "u tijeku" manji ispod; nakon upita današnji konačni. Bez jučerašnjeg konačnog
 * rezultata istaknut je današnji (i "u tijeku").
 */
export function scoreHeadline(days: readonly ScoredDay[], date: string, longestStreak = 0): ScoreHeadline {
  const todayOverview = progressOverview(days, date, longestStreak);
  const today = todayOverview.today;
  const yesterday = addDays(date, -1);
  const yesterdayFinal = yesterday === null ? undefined : days.find((day) => day.date === yesterday && day.final);
  if ((today !== null && today.final) || yesterday === null || yesterdayFinal === undefined) {
    return { featured: todayOverview, featuresYesterday: false, todayInProgress: null };
  }
  return {
    featured: progressOverview(days, yesterday, longestStreak),
    featuresYesterday: true,
    todayInProgress: today,
  };
}

export type ScorePill = {
  score: number;
  /** Trend naspram dana prije; `null` kad nema dana za usporedbu. */
  trend: ScoreTrend | null;
  /** `true` kad je to jučerašnji konačni rezultat (današnji upit još nije ispunjen). */
  yesterday: boolean;
};

/**
 * Pilula rezultata u zaglavlju Dana (smjer „Žar“): isti broj koji je istaknut na kartici rezultata
 * (pravilo P43), sa strelicom trenda. Bez ijednog rezultata nema pilule.
 */
export function scorePill(headline: ScoreHeadline): ScorePill | null {
  const { featured, featuresYesterday } = headline;
  if (featured.today === null) return null;
  return {
    score: featured.today.score,
    trend: featured.vsYesterday?.trend ?? null,
    yesterday: featuresYesterday,
  };
}
