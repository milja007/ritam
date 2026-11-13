/**
 * Bedževi (korak 34, platno „Profil“). Čista logika, bez React importa; sve je izvedeno iz
 * konačnih dnevnih rezultata i dana niza — ništa se ne sprema.
 *
 * Bedž samo nagrađuje: jednom osvojen ostaje osvojen (računa se nad cijelom poviješću), a slab
 * dan ili prekinut niz ništa ne oduzima. Kao i žar, bedž pali samo **konačni** rezultat — rezultat
 * „u tijeku“ ne ulazi.
 */
import { isValidLocalDate } from '../domain/common';
import { EMBER_THRESHOLDS } from '../ember/ember';
import { weekStart } from '../progress/compare';
import type { ScorePart } from '../progress/score';
import { addDays, daysBetween } from '../time/local-date';
import { closedWeeks, type WeekResult } from './rank';
import { streakFromDates } from './streak';

/** Redoslijed je i redoslijed prikaza osvojenih bedževa. */
export const BADGES = [
  'firstWeek',
  'streak7',
  'cleanWeek',
  'brightDay',
  'weekRecord',
  'goodWeeks4',
  'embers30',
  'streak30',
  'embers100',
] as const;
export type Badge = (typeof BADGES)[number];

/** Cilj svakog bedža (dani, tjedni ili 1 za jednokratni događaj). */
export const BADGE_TARGETS: Readonly<Record<Badge, number>> = {
  firstWeek: 7,
  streak7: 7,
  cleanWeek: 7,
  brightDay: 1,
  weekRecord: 1,
  goodWeeks4: 4,
  embers30: 30,
  streak30: 30,
  embers100: 100,
};

export type BadgeDay = {
  date: string;
  score: number;
  final: boolean;
  /** Dijelovi rezultata 0–1; `rules` = 1 znači dan bez prekršaja. */
  parts?: Readonly<Record<ScorePart, number | null>>;
};

export type BadgeProgress = {
  badge: Badge;
  earned: boolean;
  /** Koliko je skupljeno prema cilju (0…`total`); za osvojen bedž jednako `total`. */
  done: number;
  total: number;
};

/** Konačni dani do `today`, uzlazno, po jedan po datumu (isti dan dvaput → vrijedi zadnji). */
function finalDays(days: readonly BadgeDay[], today: string): BadgeDay[] {
  const byDate = new Map<string, BadgeDay>();
  for (const day of days) {
    if (!day.final || !Number.isFinite(day.score)) continue;
    if (!isValidLocalDate(day.date) || day.date > today) continue;
    byDate.set(day.date, day);
  }
  return [...byDate.values()].sort((a, b) => (a.date < b.date ? -1 : 1));
}

type Run = { best: number; current: number };

/**
 * Najduži i tekući niz uzastopnih kalendarskih dana bez prekršaja (`parts.rules` = 1). Tekući je
 * niz koji završava danas ili jučer — današnji dan još nema konačni rezultat dok upit ne stigne.
 */
function cleanRun(days: readonly BadgeDay[], today: string): Run {
  let best = 0;
  let run = 0;
  let previous: string | null = null;
  for (const day of days) {
    const clean = day.parts?.rules === 1;
    if (!clean) {
      run = 0;
    } else {
      run = previous !== null && run > 0 && daysBetween(previous, day.date) === 1 ? run + 1 : 1;
      if (run > best) best = run;
    }
    previous = day.date;
  }
  const sinceLast = previous === null ? null : daysBetween(previous, today);
  const current = sinceLast !== null && sinceLast <= 1 ? run : 0;
  return { best, current };
}

/**
 * Najduži i tekući niz dobrih tjedana **zaredom** (susjedni kalendarski tjedni; tjedan bez dovoljno
 * dana prekida niz). Tekući je niz koji završava tjednom prije tekućeg.
 */
function goodWeekRun(weeks: readonly WeekResult[], today: string): Run {
  let best = 0;
  let run = 0;
  let previous: string | null = null;
  for (const week of weeks) {
    if (!week.good) {
      run = 0;
    } else {
      run = previous !== null && run > 0 && daysBetween(previous, week.start) === 7 ? run + 1 : 1;
      if (run > best) best = run;
    }
    previous = week.start;
  }
  const currentWeek = weekStart(today);
  const lastWeek = currentWeek === null ? null : addDays(currentWeek, -7);
  return { best, current: previous !== null && previous === lastWeek ? run : 0 };
}

/** Postoji li ubrojeni tjedan s prosjekom boljim od svih prethodnih ubrojenih (treba barem dva). */
function hasWeekRecord(weeks: readonly WeekResult[]): boolean {
  let top: number | null = null;
  for (const week of weeks) {
    if (top !== null && week.average > top) return true;
    if (top === null || week.average > top) top = week.average;
  }
  return false;
}

function progress(badge: Badge, best: number, current: number = best): BadgeProgress {
  const total = BADGE_TARGETS[badge];
  const earned = best >= total;
  return { badge, earned, done: earned ? total : Math.max(0, Math.min(total - 1, current)), total };
}

/**
 * Stanje svih bedževa za dan `today`, redom iz `BADGES`. `streakDates` su dani koji se broje u
 * glavni niz (ispunjen večernji upit). Neispravan `today` → ništa nije osvojeno.
 */
export function badgeProgress(
  days: readonly BadgeDay[],
  streakDates: Iterable<string>,
  today: string,
): BadgeProgress[] {
  if (!isValidLocalDate(today)) return BADGES.map((badge) => progress(badge, 0));

  const finals = finalDays(days, today);
  const streak = streakFromDates(streakDates, today);
  const clean = cleanRun(finals, today);
  const weeks = closedWeeks(days, today);
  const goodWeeks = goodWeekRun(weeks, today);
  const bright = finals.some((day) => day.score >= EMBER_THRESHOLDS.bright) ? 1 : 0;

  const byBadge: Record<Badge, BadgeProgress> = {
    firstWeek: progress('firstWeek', finals.length),
    streak7: progress('streak7', streak.longest, streak.current),
    cleanWeek: progress('cleanWeek', clean.best, clean.current),
    brightDay: progress('brightDay', bright),
    weekRecord: progress('weekRecord', hasWeekRecord(weeks) ? 1 : 0),
    goodWeeks4: progress('goodWeeks4', goodWeeks.best, goodWeeks.current),
    embers30: progress('embers30', finals.length),
    streak30: progress('streak30', streak.longest, streak.current),
    embers100: progress('embers100', finals.length),
  };
  return BADGES.map((badge) => byBadge[badge]);
}

/**
 * Redoslijed prikaza: osvojeni prvi (redom iz `BADGES`), zatim neosvojeni od najbližeg cilju.
 * Ulaz se ne mijenja.
 */
export function sortBadges(badges: readonly BadgeProgress[]): BadgeProgress[] {
  const order = (badge: Badge) => BADGES.indexOf(badge);
  return [...badges].sort((a, b) => {
    if (a.earned !== b.earned) return a.earned ? -1 : 1;
    if (!a.earned) {
      const diff = b.done / b.total - a.done / a.total;
      if (diff !== 0) return diff;
    }
    return order(a.badge) - order(b.badge);
  });
}

/** Bedž s brojačem („3/4“) — jednokratni događaji (cilj 1) ga nemaju. */
export function hasCounter(badge: BadgeProgress): boolean {
  return !badge.earned && badge.total > 1;
}
