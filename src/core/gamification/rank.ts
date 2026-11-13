/**
 * Rang E → S (korak 34b, koncept: „raste kad napredak traje tjednima“). Čista logika, bez React
 * importa; sve je izvedeno iz konačnih dnevnih rezultata i ništa se ne sprema.
 *
 * Rang broji „dobre tjedne“: zaključen tjedan (pon–ned, prije tekućeg) s barem
 * `MIN_WEEK_DAYS` konačnih rezultata koji je ili bolji od prethodnog ubrojenog tjedna ili je
 * prosjekom jak (`STRONG_WEEK_AVERAGE`). Slab tjedan ništa ne oduzima — rang nikad ne pada.
 */
import { isValidLocalDate } from '../domain/common';
import type { EmberLevel } from '../ember/ember';
import { weekStart } from '../progress/compare';

export const RANKS = ['E', 'D', 'C', 'B', 'A', 'S'] as const;
export type Rank = (typeof RANKS)[number];

/** Koliko dobrih tjedana ukupno treba za rang. */
export const RANK_GOOD_WEEKS: Readonly<Record<Rank, number>> = { E: 0, D: 2, C: 5, B: 9, A: 14, S: 20 };

/** Svjetlina medaljona ranga: plamen raste s rangom (E tinja, A i S gore punim sjajem). */
export const RANK_EMBER: Readonly<Record<Rank, Exclude<EmberLevel, 'unlit'>>> = {
  E: 'faint',
  D: 'low',
  C: 'warm',
  B: 'warm',
  A: 'bright',
  S: 'bright',
};

/** Tjedan se broji tek s toliko konačnih rezultata (više od pola tjedna). */
export const MIN_WEEK_DAYS = 4;

/** Prosjek od kojeg je tjedan dobar i kad nije bolji od prethodnog (žar tada „grije“). */
export const STRONG_WEEK_AVERAGE = 70;

export type RankDay = { date: string; score: number; final: boolean };

export type WeekResult = {
  /** Ponedjeljak tjedna. */
  start: string;
  /** Prosjek konačnih rezultata, zaokružen. */
  average: number;
  /** Broj dana s konačnim rezultatom. */
  days: number;
  good: boolean;
};

/**
 * Ubrojeni zaključeni tjedni uzlazno. Tekući tjedan (onaj u kojem je `today`) i kasniji ne ulaze,
 * kao ni rezultati „u tijeku“ ni tjedni s premalo dana. Neispravan `today` → prazno.
 */
export function closedWeeks(days: readonly RankDay[], today: string): WeekResult[] {
  const currentWeek = isValidLocalDate(today) ? weekStart(today) : null;
  if (currentWeek === null) return [];

  const byWeek = new Map<string, Map<string, number>>();
  for (const day of days) {
    if (!day.final || !Number.isFinite(day.score) || !isValidLocalDate(day.date)) continue;
    const start = weekStart(day.date);
    if (start === null || start >= currentWeek) continue;
    const week = byWeek.get(start) ?? new Map<string, number>();
    week.set(day.date, day.score); // isti dan dvaput → vrijedi zadnji
    byWeek.set(start, week);
  }

  const weeks: WeekResult[] = [];
  let previous: number | null = null;
  for (const start of [...byWeek.keys()].sort()) {
    const scores = [...(byWeek.get(start)?.values() ?? [])];
    if (scores.length < MIN_WEEK_DAYS) continue;
    const average = Math.round(scores.reduce((sum, score) => sum + score, 0) / scores.length);
    const good = average >= STRONG_WEEK_AVERAGE || (previous !== null && average > previous);
    weeks.push({ start, average, days: scores.length, good });
    previous = average;
  }
  return weeks;
}

/** Rang za ukupan broj dobrih tjedana (negativno ili neispravno → E). */
export function rankForGoodWeeks(goodWeeks: number): Rank {
  const count = Number.isFinite(goodWeeks) ? Math.floor(goodWeeks) : 0;
  let rank: Rank = 'E';
  for (const candidate of RANKS) {
    if (count >= RANK_GOOD_WEEKS[candidate]) rank = candidate;
  }
  return rank;
}

export type RankProgress = {
  rank: Rank;
  /** Ukupno dobrih tjedana. */
  goodWeeks: number;
  /** Ubrojenih zaključenih tjedana (dobrih i ostalih). */
  countedWeeks: number;
  /** Put do sljedećeg ranga; `null` na rangu S. */
  next: {
    rank: Rank;
    /** Dobrih tjedana između trenutnog i sljedećeg ranga. */
    stepWeeks: number;
    /** Koliko ih je od toga već skupljeno. */
    doneWeeks: number;
    /** Koliko ih još treba (barem 1). */
    weeksLeft: number;
  } | null;
};

/** Rang i put do sljedećeg za dan `today`. */
export function rankProgress(days: readonly RankDay[], today: string): RankProgress {
  const weeks = closedWeeks(days, today);
  const goodWeeks = weeks.filter((week) => week.good).length;
  const rank = rankForGoodWeeks(goodWeeks);
  const nextRank = RANKS[RANKS.indexOf(rank) + 1];
  if (nextRank === undefined) return { rank, goodWeeks, countedWeeks: weeks.length, next: null };
  const from = RANK_GOOD_WEEKS[rank];
  const to = RANK_GOOD_WEEKS[nextRank];
  return {
    rank,
    goodWeeks,
    countedWeeks: weeks.length,
    next: { rank: nextRank, stepWeeks: to - from, doneWeeks: goodWeeks - from, weeksLeft: to - goodWeeks },
  };
}

/**
 * Poruka „[Sustav]“ uz rang: `start` dok nema nijednog ubrojenog tjedna (objašnjava pravilo),
 * `toNext` koliko dobrih tjedana fali, `top` na rangu S. Tekst slaže UI (i18n).
 */
export type SystemMessage =
  | { kind: 'start'; rank: Rank }
  | { kind: 'toNext'; rank: Rank; count: number }
  | { kind: 'top' };

export function systemMessage(progress: RankProgress): SystemMessage {
  if (progress.next === null) return { kind: 'top' };
  if (progress.countedWeeks === 0) return { kind: 'start', rank: progress.next.rank };
  return { kind: 'toNext', rank: progress.next.rank, count: progress.next.weeksLeft };
}
