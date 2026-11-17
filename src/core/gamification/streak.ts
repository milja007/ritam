/**
 * Streakovi: dani zaredom. Glavni streak = dani zaredom s ispunjenom večernjom provjerom (koncept).
 * Čista logika: bez React importa. Izvedeno iz `checkins` (kasnije i `rule_logs`), ne sprema se.
 *
 * Freeze tokeni („žeravica“, korak 34): također izvedeni iz povijesti, ne spremaju se. Svakih
 * `FREEZE_EVERY` ubrojenih dana zaredom donese jednu žeravicu (najviše `FREEZE_MAX` odjednom).
 * Propušten dan premošćuje se žeravicom: niz ostaje živ, ali premošteni dan ga ne povećava.
 * Ako žeravica nema dovoljno za cijelu rupu, niz pukne, a zarađene žeravice ostaju (bez kazni).
 */
import type { Checkin } from '../domain/checkin';
import { isValidLocalDate } from '../domain/common';
import { addDays, daysBetween } from '../time/local-date';

/** Koliko ubrojenih dana zaredom donosi jednu žeravicu. */
export const FREEZE_EVERY = 7;
/** Najviše žeravica odjednom. */
export const FREEZE_MAX = 2;

export type StreakFreezes = {
  /** Žeravice koje su još na raspolaganju (nakon što su premostile i rupu do danas). */
  held: number;
  /** Za koliko ubrojenih dana stiže sljedeća; 0 kad je `held === FREEZE_MAX`. */
  nextIn: number;
  /** Dani koje je žeravica premostila u trenutnom nizu (uzlazno), uključivo propuštene dane do danas. */
  savedDates: string[];
};

export type Streak = {
  /** Trenutni niz dana; živ je ako je zadnji dan danas ili jučer (današnji upit još nije propušten) ili žeravica čuva rupu. */
  current: number;
  /** Najduži niz ikad. */
  longest: number;
  /** Zadnji ubrojeni dan, `null` ako nema nijednog. */
  lastDate: string | null;
  /** Je li današnji dan već ubrojen. */
  doneToday: boolean;
  freezes: StreakFreezes;
};

const NO_FREEZES: StreakFreezes = { held: 0, nextIn: FREEZE_EVERY, savedDates: [] };

export const EMPTY_STREAK: Streak = {
  current: 0,
  longest: 0,
  lastDate: null,
  doneToday: false,
  freezes: NO_FREEZES,
};

/** Dani strogo između `from` i `to`, uzlazno. */
function datesBetween(from: string, to: string): string[] {
  const out: string[] = [];
  for (let date = addDays(from, 1); date !== null && date < to; date = addDays(date, 1)) out.push(date);
  return out;
}

/**
 * Streak iz skupa dana ("YYYY-MM-DD") u odnosu na `today`, sa žeravicama.
 * Duplikati, neispravni datumi i dani nakon `today` se ignoriraju.
 */
export function streakFromDates(dates: Iterable<string>, today: string): Streak {
  if (!isValidLocalDate(today)) return EMPTY_STREAK;

  const unique = [...new Set(dates)]
    .filter((date) => isValidLocalDate(date) && date <= today)
    .sort();
  if (unique.length === 0) return EMPTY_STREAK;

  let held = 0;
  // Ubrojeni dani od zadnje zarađene žeravice (ili od početka niza).
  let progress = 0;
  let run = 0;
  let longest = 0;
  let saved: string[] = [];

  const count = () => {
    run += 1;
    progress += 1;
    if (run > longest) longest = run;
    if (progress >= FREEZE_EVERY) {
      if (held < FREEZE_MAX) held += 1;
      progress = 0;
    }
  };

  for (let i = 0; i < unique.length; i++) {
    if (i > 0) {
      const missed = datesBetween(unique[i - 1], unique[i]);
      if (missed.length > held) {
        run = 0;
        progress = 0;
        saved = [];
      } else if (missed.length > 0) {
        held -= missed.length;
        saved = [...saved, ...missed];
      }
    }
    count();
  }

  const lastDate = unique[unique.length - 1];
  const sinceLast = daysBetween(lastDate, today) ?? Number.POSITIVE_INFINITY;
  let current = run;
  if (sinceLast > 1) {
    // Današnji upit još nije propušten; dani između zadnjeg ubrojenog i danas jesu.
    const missed = datesBetween(lastDate, today);
    if (missed.length <= held) {
      held -= missed.length;
      saved = [...saved, ...missed];
    } else {
      current = 0;
      saved = [];
      progress = 0;
    }
  }

  return {
    current,
    longest,
    lastDate,
    doneToday: sinceLast === 0,
    freezes: { held, nextIn: held >= FREEZE_MAX ? 0 : FREEZE_EVERY - progress, savedDates: saved },
  };
}

/** Čuva li žeravica trenutni niz (propušten je barem jedan dan prije danas). */
export function isStreakFrozen(streak: Streak): boolean {
  return streak.current > 0 && streak.freezes.savedDates.length > 0 && streak.lastDate !== null &&
    streak.freezes.savedDates[streak.freezes.savedDates.length - 1] > streak.lastDate;
}

/** Je li broj žeravica narastao između dva crtanja (bljesak na Profilu). Prvo crtanje → false. */
export function freezeEarned(previous: number | null, next: number): boolean {
  return previous !== null && Number.isFinite(previous) && Number.isFinite(next) && next > previous;
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

/**
 * Za koliko je niz narastao između dva crtanja (animacija niza, korak 35). Prvo crtanje
 * (`previous === null`), pad ili prekid niza i neispravni brojevi daju 0 — bljesne samo stvaran
 * rast dok je ekran otvoren.
 */
export function streakGain(previous: number | null, next: number): number {
  if (previous === null || !Number.isFinite(previous) || !Number.isFinite(next)) return 0;
  return Math.max(0, Math.floor(next) - Math.floor(previous));
}
