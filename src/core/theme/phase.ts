/**
 * Doba dana → gradijent. Čista logika, bez React importa.
 *
 * Granice prate vrijeme buđenja (Bornova odluka): zora = buđenje do +3 h, zatim dan, a večer
 * počinje 5 h prije kreveta (buđenje + budni sati − 5 h). Prije buđenja je i dalje večer.
 * Dok postavke ne postoje (onboarding), vrijede fiksne granice `PHASE_STARTS`.
 */

import { MINUTES_PER_DAY, parseClock } from '@/core/time/clock';

import type { DayPhase, Gradient } from './tokens';

export type PhaseStarts = Readonly<Record<DayPhase, number>>;

/** Fiksne granice (minute od ponoći) dok nema postavki. Večer traje do početka zore. */
export const PHASE_STARTS: PhaseStarts = {
  dawn: 5 * 60, // 05:00
  day: 9 * 60, // 09:00
  evening: 18 * 60, // 18:00
};

/** Koliko traje zora od buđenja. */
export const DAWN_MINUTES = 3 * 60;
/** Koliko prije kreveta počinje večer. */
export const EVENING_BEFORE_BED_MINUTES = 5 * 60;

function wrap(minutes: number): number {
  return ((Math.floor(minutes) % MINUTES_PER_DAY) + MINUTES_PER_DAY) % MINUTES_PER_DAY;
}

/**
 * Granice faza iz buđenja i sati sna. Npr. 07:00 i 8 h → zora 07:00, dan 10:00, večer 18:00
 * (krevet 23:00 − 5 h). Neispravan ulaz → `null`.
 */
export function phaseStartsFor(wakeTime: string, sleepHours: number): PhaseStarts | null {
  const wake = parseClock(wakeTime);
  if (wake === null || !Number.isFinite(sleepHours)) return null;
  const awake = MINUTES_PER_DAY - Math.round(sleepHours * 60);
  // Sati sna su najviše 12, pa budnih je barem 12 h i večer uvijek dolazi poslije zore.
  const eveningOffset = Math.max(DAWN_MINUTES, awake - EVENING_BEFORE_BED_MINUTES);
  return {
    dawn: wake,
    day: wrap(wake + DAWN_MINUTES),
    evening: wrap(wake + eveningOffset),
  };
}

/**
 * Faza dana za minutu od ponoći. Granice se gledaju u krugu od zore (pa rade i preko ponoći,
 * npr. buđenje u 22:00 za noćnu smjenu). Vrijednosti izvan [0, 1440) se omataju.
 */
export function dayPhaseAt(minuteOfDay: number, starts: PhaseStarts = PHASE_STARTS): DayPhase {
  const fromDawn = wrap(minuteOfDay - starts.dawn);
  if (fromDawn < wrap(starts.day - starts.dawn)) return 'dawn';
  if (fromDawn < wrap(starts.evening - starts.dawn)) return 'day';
  return 'evening';
}

/** Faza dana za lokalno vrijeme datuma. */
export function dayPhaseOf(date: Date, starts: PhaseStarts = PHASE_STARTS): DayPhase {
  return dayPhaseAt(date.getHours() * 60 + date.getMinutes(), starts);
}

/** Gradijent → CSS `linear-gradient(...)` za RN stil `backgroundImage`. */
export function linearGradientCss(gradient: Gradient): string {
  return `linear-gradient(${gradient.angle}deg, ${gradient.colors.join(', ')})`;
}
