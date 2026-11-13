/**
 * Žar kroz razdoblja: isti dnevni žar u tjednu (7 stupaca), mjesecu (kalendar) i godini
 * (365 točkica). Čista logika nad lokalnim danima "YYYY-MM-DD"; bez React importa.
 */
import type { ScheduleBlock } from '../domain';
import { weekStart, type ScoredDay } from '../progress';
import { streakFromDates } from '../gamification/streak';
import { blockRange } from '../schedule';
import { addDays, daysBetween } from '../time/local-date';
import { emberLevel, type EmberLevel } from './ember';

/** Žar jednog dana u kalendaru. */
export type DayEmber =
  | { kind: 'past'; level: EmberLevel; score: number | null }
  | { kind: 'today'; score: number | null }
  | { kind: 'future' };

/** Konačni rezultati po danu (rezultat „u tijeku“ ne pali žar). */
export function finalScores(days: readonly ScoredDay[]): Map<string, number> {
  const map = new Map<string, number>();
  for (const day of days) if (day.final) map.set(day.date, day.score);
  return map;
}

/** Prošli dan bez rezultata je ugašen žar; današnji je obrub u boji plamena; budući tek ocrtan. */
export function dayEmber(date: string, today: string, scores: ReadonlyMap<string, number>): DayEmber {
  const score = scores.get(date) ?? null;
  if (date === today) return { kind: 'today', score };
  if (date > today) return { kind: 'future' };
  return { kind: 'past', level: emberLevel(score), score };
}

/** Sedam dana tjedna (pon–ned) kojem `date` pripada. */
export function weekDates(date: string): string[] {
  const start = weekStart(date);
  if (start === null) return [];
  const out: string[] = [];
  for (let i = 0; i < 7; i += 1) {
    const day = addDays(start, i);
    if (day !== null) out.push(day);
  }
  return out;
}

/** ISO broj tjedna (tjedan s prvim četvrtkom u godini je 1). */
export function isoWeek(date: string): number | null {
  const start = weekStart(date);
  const thursday = start === null ? null : addDays(start, 3);
  if (thursday === null) return null;
  const sinceNewYear = daysBetween(`${thursday.slice(0, 4)}-01-01`, thursday);
  return sinceNewYear === null ? null : Math.floor(sinceNewYear / 7) + 1;
}

/** Izgled bloka u stupcu tjedna. */
export const SEGMENT_LOOKS = ['done', 'half', 'missed', 'plan', 'fixed', 'fixedPlan'] as const;
export type SegmentLook = (typeof SEGMENT_LOOKS)[number];

export type WeekSegment = {
  id: string;
  /** Početak i visina kao udio prikazanog raspona dana, 0–1. */
  top: number;
  height: number;
  look: SegmentLook;
};

/** Prikazani raspon dana u stupcu tjedna: 06:00–24:00 (kao na platnu). */
export const WEEK_WINDOW = { start: 6 * 60, end: 24 * 60 } as const;

type SegmentBlock = Pick<ScheduleBlock, 'id' | 'date' | 'start' | 'end' | 'kind' | 'status'>;

/**
 * Izgled bloka: odrađeno svijetli, djelomično je pola, neodrađeno (ili prošlo bez prijave) je
 * ugašeno; ono što tek dolazi je ocrtano. Fiksne i kalendarske obaveze imaju svoju boju.
 */
export function segmentLook(block: SegmentBlock, today: string, nowMinutes: number): SegmentLook {
  const fixed = block.kind === 'fixed' || block.kind === 'calendar';
  if (block.status === 'done') return fixed ? 'fixed' : 'done';
  if (block.status === 'partial') return 'half';
  if (block.status === 'skipped' || block.status === 'moved') return 'missed';
  const range = blockRange(block);
  const over = block.date < today || (block.date === today && range !== null && range.end <= nowMinutes);
  if (over) return 'missed';
  return fixed ? 'fixedPlan' : 'plan';
}

/** Blokovi jednog dana kao odsječci stupca; san i blokovi izvan raspona se ne crtaju. */
export function weekSegments(
  blocks: readonly SegmentBlock[],
  date: string,
  today: string,
  nowMinutes: number,
): WeekSegment[] {
  const span = WEEK_WINDOW.end - WEEK_WINDOW.start;
  const out: WeekSegment[] = [];
  for (const block of blocks) {
    if (block.date !== date || block.kind === 'sleep') continue;
    const range = blockRange(block);
    if (range === null) continue;
    const start = Math.max(range.start, WEEK_WINDOW.start);
    const end = Math.min(range.end, WEEK_WINDOW.end);
    if (end <= start) continue;
    out.push({
      id: block.id,
      top: (start - WEEK_WINDOW.start) / span,
      height: (end - start) / span,
      look: segmentLook(block, today, nowMinutes),
    });
  }
  return out;
}

/** Položaj linije „sada“ u stupcu (0–1), ili `null` izvan prikazanog raspona. */
export function nowLine(nowMinutes: number): number | null {
  if (nowMinutes < WEEK_WINDOW.start || nowMinutes > WEEK_WINDOW.end) return null;
  return (nowMinutes - WEEK_WINDOW.start) / (WEEK_WINDOW.end - WEEK_WINDOW.start);
}

/** Prosjek konačnih rezultata u danima `dates` (zaokružen), ili `null` bez ijednog. */
export function averageScore(dates: readonly string[], scores: ReadonlyMap<string, number>): number | null {
  const exact = exactAverage(dates, scores);
  return exact === null ? null : Math.round(exact);
}

/** Nezaokružen prosjek (za usporedbe; prikaz ide kroz `averageScore`). */
function exactAverage(dates: readonly string[], scores: ReadonlyMap<string, number>): number | null {
  const values = dates.map((date) => scores.get(date)).filter((value): value is number => value !== undefined);
  if (values.length === 0) return null;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

/** Broj dana u mjesecu "YYYY-MM". */
export function daysInMonth(month: string): number {
  const [year, m] = month.split('-').map(Number);
  if (year === undefined || m === undefined || !Number.isInteger(year) || !Number.isInteger(m)) return 0;
  if (m < 1 || m > 12) return 0;
  return new Date(Date.UTC(year, m, 0)).getUTCDate();
}

/** Svi dani mjeseca "YYYY-MM". */
export function monthDates(month: string): string[] {
  const out: string[] = [];
  for (let day = 1; day <= daysInMonth(month); day += 1) out.push(`${month}-${String(day).padStart(2, '0')}`);
  return out;
}

/** Kalendar mjeseca: tjedan počinje ponedjeljkom, prazna polja prije prvog dana su `null`. */
export function monthGrid(month: string): (string | null)[] {
  const dates = monthDates(month);
  const first = dates[0];
  const start = first === undefined ? null : weekStart(first);
  const lead = first === undefined || start === null ? 0 : (daysBetween(start, first) ?? 0);
  return [...Array.from({ length: lead }, () => null), ...dates];
}

/** Prethodni mjesec: "2026-01" → "2025-12". */
export function previousMonth(month: string): string | null {
  const [year, m] = month.split('-').map(Number);
  if (year === undefined || m === undefined || daysInMonth(month) === 0) return null;
  const prev = m === 1 ? { y: year - 1, m: 12 } : { y: year, m: m - 1 };
  return `${String(prev.y).padStart(4, '0')}-${String(prev.m).padStart(2, '0')}`;
}

/** Dvanaest mjeseci godine, svaki sa svojim danima. */
export function yearMonths(year: string): { month: string; dates: string[] }[] {
  return Array.from({ length: 12 }, (_, index) => {
    const month = `${year}-${String(index + 1).padStart(2, '0')}`;
    return { month, dates: monthDates(month) };
  });
}

/** Najjači dan (najviši konačni rezultat) među `dates`; kod izjednačenja raniji. */
export function strongestDay(
  dates: readonly string[],
  scores: ReadonlyMap<string, number>,
): { date: string; score: number } | null {
  let best: { date: string; score: number } | null = null;
  for (const date of dates) {
    const score = scores.get(date);
    if (score !== undefined && (best === null || score > best.score)) best = { date, score };
  }
  return best;
}

/**
 * Mjesec s najvišim prosjekom u godini (barem jedan ocijenjen dan); kod izjednačenja raniji.
 * Uspoređuju se stvarni prosjeci; `average` je zaokružen samo za prikaz.
 */
export function strongestMonth(
  year: string,
  scores: ReadonlyMap<string, number>,
): { month: string; average: number } | null {
  let best: { month: string; exact: number } | null = null;
  for (const { month, dates } of yearMonths(year)) {
    const exact = exactAverage(dates, scores);
    if (exact !== null && (best === null || exact > best.exact)) best = { month, exact };
  }
  return best === null ? null : { month: best.month, average: Math.round(best.exact) };
}

/**
 * Najduži niz unutar godine `year`: uzastopni dani iz `streakDates` (dani koji se računaju u
 * glavni niz — ispunjen večernji upit ili „Odustajem“) koji pripadaju toj godini, do `through`.
 * Niz koji prelazi iz prošle godine broji se samo od 1. siječnja.
 */
export function longestStreakInYear(streakDates: Iterable<string>, year: string, through: string): number {
  const inYear = [...streakDates].filter((date) => date.length === 10 && date.slice(0, 4) === year);
  return streakFromDates(inYear, through).longest;
}

/** Zadnjih `count` dana do `end` (uključivo), uzlazno; prazno za neispravan datum ili broj. */
export function trailingDates(end: string, count: number): string[] {
  if (!Number.isInteger(count) || count <= 0) return [];
  const dates: string[] = [];
  for (let back = count - 1; back >= 0; back--) {
    const date = addDays(end, -back);
    if (date === null) return [];
    dates.push(date);
  }
  return dates;
}

/** Stupac grafa trenda: dan, konačni rezultat (ili `null`) i je li u zadnjem, istaknutom dijelu. */
export type TrendBar = { date: string; score: number | null; recent: boolean };

export type Trend = {
  bars: TrendBar[];
  /** Prosjek prikazanog razdoblja i razdoblja iste duljine prije njega (zaokruženo), ili `null`. */
  average: number | null;
  previous: number | null;
  /** Broj ocijenjenih dana u prikazanom razdoblju. */
  scored: number;
};

/**
 * Trend zadnjih `count` dana do `end` (Profil, „Zadnjih 30 dana“): stupac po danu, zadnjih
 * `recent` dana je istaknuto; usporedba je s `count` dana prije toga.
 */
export function trend(end: string, scores: ReadonlyMap<string, number>, count = 30, recent = 7): Trend {
  const dates = trailingDates(end, count);
  const before = dates.length > 0 ? addDays(dates[0], -1) : null;
  const previousDates = before === null ? [] : trailingDates(before, count);
  const bars = dates.map((date, index) => ({
    date,
    score: scores.get(date) ?? null,
    recent: index >= dates.length - recent,
  }));
  return {
    bars,
    average: averageScore(dates, scores),
    previous: averageScore(previousDates, scores),
    scored: bars.filter((bar) => bar.score !== null).length,
  };
}
