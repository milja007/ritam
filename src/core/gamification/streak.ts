/**
 * Streakovi: dani zaredom. Glavni streak = dani zaredom s ispunjenom večernjom provjerom (koncept).
 * Čista logika: bez React importa. Izvedeno iz `checkins` (kasnije i `rule_logs`), ne sprema se.
 * Freeze tokeni dolaze kasnije (faza 3) i nadograđuju `streakFromDates`.
 */
import type { Checkin } from '../domain/checkin';
import { isValidLocalDate } from '../domain/common';
import { daysBetween } from '../time/local-date';

export type Streak = {
  /** Trenutni niz dana; živ je ako je zadnji dan danas ili jučer (današnji upit još nije propušten). */
  current: number;
  /** Najduži niz ikad. */
  longest: number;
  /** Zadnji ubrojeni dan, `null` ako nema nijednog. */
  lastDate: string | null;
  /** Je li današnji dan već ubrojen. */
  doneToday: boolean;
};

export const EMPTY_STREAK: Streak = { current: 0, longest: 0, lastDate: null, doneToday: false };

/**
 * Streak iz skupa dana ("YYYY-MM-DD") u odnosu na `today`.
 * Duplikati, neispravni datumi i dani nakon `today` se ignoriraju.
 */
export function streakFromDates(dates: Iterable<string>, today: string): Streak {
  if (!isValidLocalDate(today)) return EMPTY_STREAK;

  const unique = [...new Set(dates)]
    .filter((date) => isValidLocalDate(date) && date <= today)
    .sort();
  if (unique.length === 0) return EMPTY_STREAK;

  let longest = 1;
  let run = 1;
  for (let i = 1; i < unique.length; i++) {
    run = daysBetween(unique[i - 1], unique[i]) === 1 ? run + 1 : 1;
    if (run > longest) longest = run;
  }

  const lastDate = unique[unique.length - 1];
  const sinceLast = daysBetween(lastDate, today) ?? Number.POSITIVE_INFINITY;
  const current = sinceLast <= 1 ? run : 0;

  return { current, longest, lastDate, doneToday: sinceLast === 0 };
}

type CheckinLike = Pick<Checkin, 'date' | 'kind' | 'dayRating'> & Partial<Pick<Checkin, 'gaveUp'>>;

/**
 * Je li večernja provjera ispunjena. Ocjena dana je zadnji obavezni korak provjere
 * (checklist → zabrane → ocjena), pa se računa kao ispunjena kad ocjena postoji.
 */
export function isEveningCheckinComplete(checkin: CheckinLike): boolean {
  return checkin.kind === 'evening' && checkin.dayRating !== null;
}

/**
 * Računa li se dan u glavni streak: ispunjena večernja provjera ili "Odustajem od svega"
 * (korak 17d, odluka P58 — odustajanje ne ruši streak).
 */
export function countsForStreak(checkin: CheckinLike): boolean {
  return isEveningCheckinComplete(checkin) || (checkin.kind === 'evening' && checkin.gaveUp === true);
}

/** Glavni streak: dani zaredom s ispunjenom večernjom provjerom (ili s Odustajem). */
export function mainStreak(checkins: readonly CheckinLike[], today: string): Streak {
  return streakFromDates(
    checkins.filter(countsForStreak).map((checkin) => checkin.date),
    today,
  );
}
