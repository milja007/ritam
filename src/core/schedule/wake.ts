/**
 * Vrijeme buđenja po danu (radni dan / vikend) i iz njega izvedeni krevet.
 * Čista logika: bez React importa.
 */
import type { Settings } from '../domain';
import { formatClock, MINUTES_PER_DAY, parseClock } from '../time/clock';
import { addDays } from '../time/local-date';

/** Vikend = subota i nedjelja (`Date.getDay()`). */
export const WEEKEND_DAYS: readonly number[] = [6, 0];

/** Razlika vikend − radni dan buđenja iznad koje upozoravamo (Bornova odluka: > 1 h). */
export const WEEKEND_WAKE_WARNING_MINUTES = 60;

export type WakeSettings = Pick<Settings, 'wakeTime' | 'weekendWakeTime'>;
export type SleepSettings = WakeSettings & Pick<Settings, 'sleepHours'>;

/** Dan u tjednu (0 = nedjelja) za "YYYY-MM-DD"; neispravan datum → `null`. */
export function weekdayOf(date: string): number | null {
  const [year, month, day] = date.split('-').map(Number);
  if (year === undefined || month === undefined || day === undefined) return null;
  const value = new Date(year, month - 1, day);
  return Number.isNaN(value.getTime()) ? null : value.getDay();
}

export function isWeekend(date: string): boolean {
  const weekday = weekdayOf(date);
  return weekday !== null && WEEKEND_DAYS.includes(weekday);
}

/** Vikend buđenje ili, ako nije zadano, radni dan. */
export function weekendWakeOf(settings: WakeSettings): string {
  return settings.weekendWakeTime ?? settings.wakeTime;
}

/** Ciljano buđenje za dan: vikendom vikend vrijeme (ako postoji), inače radni dan. */
export function wakeTimeFor(settings: WakeSettings, date: string): string {
  return isWeekend(date) ? weekendWakeOf(settings) : settings.wakeTime;
}

function wrap(minutes: number): number {
  return ((minutes % MINUTES_PER_DAY) + MINUTES_PER_DAY) % MINUTES_PER_DAY;
}

/**
 * Pomak vremena "HH:MM" s radnog dana na vikend, u minutama, najkraćim putem preko ponoći
 * (u rasponu (−720, 720]). Npr. 07:00 → 09:30 = +150, 23:30 → 00:30 = +60. Neispravno → `null`.
 */
export function wakeShiftMinutes(from: string, to: string): number | null {
  const a = parseClock(from);
  const b = parseClock(to);
  if (a === null || b === null) return null;
  const diff = wrap(b - a);
  return diff > MINUTES_PER_DAY / 2 ? diff - MINUTES_PER_DAY : diff;
}

/** Pomak vikend buđenja u odnosu na radni dan (0 kad vikend nije zadan). */
export function weekendShiftMinutes(settings: WakeSettings): number {
  if (settings.weekendWakeTime === null) return 0;
  return wakeShiftMinutes(settings.wakeTime, settings.weekendWakeTime) ?? 0;
}

/** Upozoriti ako se vikend buđenje razlikuje od radnog dana za više od sat vremena. */
export function weekendWakeWarning(wakeTime: string, weekendWakeTime: string | null): boolean {
  if (weekendWakeTime === null) return false;
  const shift = wakeShiftMinutes(wakeTime, weekendWakeTime);
  return shift !== null && Math.abs(shift) > WEEKEND_WAKE_WARNING_MINUTES;
}

/** Pomakni "HH:MM" za `deltaMinutes` (omatanje preko ponoći). Neispravno → `null`. */
export function shiftClockBy(time: string, deltaMinutes: number): string | null {
  const minutes = parseClock(time);
  if (minutes === null || !Number.isInteger(deltaMinutes)) return null;
  return formatClock(wrap(minutes + deltaMinutes));
}

/**
 * Krevet navečer dana `date` = buđenje *sljedećeg* dana − sati sna (petak navečer prati
 * subotnje buđenje). Neispravno → `null`.
 */
export function bedtimeOn(settings: SleepSettings, date: string): string | null {
  const next = addDays(date, 1);
  if (next === null || !Number.isFinite(settings.sleepHours)) return null;
  return shiftClockBy(wakeTimeFor(settings, next), -Math.round(settings.sleepHours * 60));
}
