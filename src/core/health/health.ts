/**
 * Korak 39 (dio): pretvorba uzoraka iz Apple Health / Health Connect u podatke Ritma.
 * Čista logika: bez React importa i bez paketa. Uzorci dolaze kao `Date` objekti, a lokalni
 * dan i sat računaju se po vremenskoj zoni uređaja (kao `localDateOf`).
 * Sirove zapise iz HealthKita / Health Connecta u `SleepSample` pretvara `./source`.
 */

import { formatClock } from '../time/clock';

/** Faza sna kako je javlja izvor (HealthKit `inBed`/`asleep*`/`awake`, Health Connect stage). */
export type SleepStage = 'inBed' | 'asleep' | 'awake';

export interface SleepSample {
  start: Date;
  end: Date;
  stage: SleepStage;
}

export interface HealthNight {
  /** Početak sna, "HH:MM" (kao `checkins.sleepStart`). */
  sleepStart: string;
  /** Buđenje, "HH:MM" (kao `checkins.wakeTime`). */
  wakeTime: string;
  /** Minute stvarnog sna u bloku (bez prekida). */
  minutes: number;
  /** Iz kojih uzoraka: spavanje ili, ako ih nema, vrijeme u krevetu. */
  basis: 'asleep' | 'inBed';
}

const MINUTE_MS = 60 * 1000;
/** Prekid kraći od ovoga (buđenje, WC) ne dijeli noć na dva bloka. */
export const NIGHT_MERGE_GAP_MINUTES = 60;
/** Kraći blok nije noć (drijemanje, šum senzora). */
export const NIGHT_MIN_MINUTES = 60;
/** Prozor noći: od 18:00 prethodnog dana do 14:00 dana buđenja. */
const WINDOW_START_HOUR = 18;
const WINDOW_END_HOUR = 14;

interface Span {
  start: number;
  end: number;
}

interface Block extends Span {
  slept: number;
}

function parseDate(date: string): { year: number; month: number; day: number } | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(date);
  if (!match) return null;
  const year = Number(match[1]);
  const month = Number(match[2]) - 1;
  const day = Number(match[3]);
  const check = new Date(year, month, day);
  if (check.getFullYear() !== year || check.getMonth() !== month || check.getDate() !== day) return null;
  return { year, month, day };
}

function validSpan(start: Date, end: Date): Span | null {
  const a = start.getTime();
  const b = end.getTime();
  if (!Number.isFinite(a) || !Number.isFinite(b) || b < a) return null;
  return { start: a, end: b };
}

function clockOf(ms: number): string {
  const d = new Date(ms);
  return formatClock(d.getHours() * 60 + d.getMinutes()) ?? '00:00';
}

/** Spaja preklapanja i prekide ≤ `gapMs`; `slept` broji samo pokriveno vrijeme. */
function mergeSpans(spans: Span[], gapMs: number): Block[] {
  const sorted = [...spans].sort((a, b) => a.start - b.start || a.end - b.end);
  const blocks: Block[] = [];
  for (const span of sorted) {
    const last = blocks[blocks.length - 1];
    if (last && span.start - last.end <= gapMs) {
      // Pokriveno vrijeme: samo dio koji izlazi iz dosadašnjeg kraja (preklapanja se ne broje dvaput).
      last.slept += Math.max(0, span.end - Math.max(span.start, last.end));
      last.end = Math.max(last.end, span.end);
    } else {
      blocks.push({ start: span.start, end: span.end, slept: span.end - span.start });
    }
  }
  return blocks;
}

/**
 * Noć koja završava buđenjem dana `wakeDate` ("YYYY-MM-DD"): najdulji blok sna u prozoru
 * 18:00 prethodnog dana – 14:00 tog dana, čije je buđenje tog dana. Bez „spava“ uzoraka
 * (npr. samo sat ili ručni unos u krevetu) koristi vrijeme u krevetu. `null` ako noći nema.
 */
export function healthNight(samples: readonly SleepSample[], wakeDate: string): HealthNight | null {
  const parts = parseDate(wakeDate);
  if (!parts) return null;
  const windowStart = new Date(parts.year, parts.month, parts.day - 1, WINDOW_START_HOUR).getTime();
  const windowEnd = new Date(parts.year, parts.month, parts.day, WINDOW_END_HOUR).getTime();
  const midnight = new Date(parts.year, parts.month, parts.day).getTime();

  const clipped = (stage: SleepStage): Span[] =>
    samples.flatMap((sample) => {
      if (sample.stage !== stage) return [];
      const span = validSpan(sample.start, sample.end);
      if (!span) return [];
      const start = Math.max(span.start, windowStart);
      const end = Math.min(span.end, windowEnd);
      return end > start ? [{ start, end }] : [];
    });

  const asleep = clipped('asleep');
  const basis: HealthNight['basis'] = asleep.length > 0 ? 'asleep' : 'inBed';
  const spans = basis === 'asleep' ? asleep : clipped('inBed');

  const candidates = mergeSpans(spans, NIGHT_MERGE_GAP_MINUTES * MINUTE_MS).filter(
    (block) => block.end >= midnight && block.slept >= NIGHT_MIN_MINUTES * MINUTE_MS,
  );
  let best: Block | null = null;
  for (const block of candidates) {
    if (!best || block.slept > best.slept) best = block;
  }
  if (!best) return null;

  return {
    sleepStart: clockOf(best.start),
    wakeTime: clockOf(best.end),
    minutes: Math.round(best.slept / MINUTE_MS),
    basis,
  };
}

/** Uzorak količine: koraci, aktivne kilokalorije… (`value` za cijeli interval). */
export interface QuantitySample {
  start: Date;
  end: Date;
  value: number;
}

/**
 * Zbroj za lokalni dan `date`. Uzorak preko ponoći dijeli se razmjerno vremenu u danu;
 * trenutni uzorak (početak = kraj) broji se cijeli u danu u kojem je. Zaokruženo na cijeli broj.
 * Duplikate iz više izvora (sat + mobitel) treba ukloniti izvor (HealthKit statistika,
 * Health Connect agregat) — ovdje se zbraja sve što stigne.
 */
export function dailyHealthTotal(samples: readonly QuantitySample[], date: string): number | null {
  const parts = parseDate(date);
  if (!parts) return null;
  const dayStart = new Date(parts.year, parts.month, parts.day).getTime();
  const dayEnd = new Date(parts.year, parts.month, parts.day + 1).getTime();

  let total = 0;
  for (const sample of samples) {
    const span = validSpan(sample.start, sample.end);
    if (!span || !Number.isFinite(sample.value) || sample.value < 0) continue;
    if (span.end === span.start) {
      if (span.start >= dayStart && span.start < dayEnd) total += sample.value;
      continue;
    }
    const overlap = Math.min(span.end, dayEnd) - Math.max(span.start, dayStart);
    if (overlap > 0) total += (sample.value * overlap) / (span.end - span.start);
  }
  return Math.round(total);
}

/** Što je korisnik već upisao u jutarnji upit (ili `null` ako upita još nema). */
export interface LoggedSleep {
  sleepStart: string | null;
  wakeTime: string | null;
}

/**
 * Prijedlog sna za jutarnji upit iz Healtha. Ručni unos uvijek pobjeđuje: čim je korisnik
 * upisao bilo koje od dva vremena, ništa se ne predlaže.
 */
export function healthSleepFill(
  logged: LoggedSleep | null,
  night: HealthNight | null,
): { sleepStart: string; wakeTime: string } | null {
  if (!night) return null;
  if (logged && (logged.sleepStart !== null || logged.wakeTime !== null)) return null;
  return { sleepStart: night.sleepStart, wakeTime: night.wakeTime };
}

