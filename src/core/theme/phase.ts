/**
 * Doba dana → gradijent. Čista logika, bez React importa.
 *
 * Granice su zasad fiksne (lokalno vrijeme). Kad postoje settings, mogu se
 * vezati uz korisnikovo vrijeme buđenja — vidi "Pitanja za Bornu" u PROGRESS.md.
 */

import { MINUTES_PER_DAY } from '@/core/time/clock';

import type { DayPhase, Gradient } from './tokens';

/** Početak svake faze u minutama od ponoći. Večer traje do početka zore. */
export const PHASE_STARTS: Readonly<Record<DayPhase, number>> = {
  dawn: 5 * 60, // 05:00
  day: 9 * 60, // 09:00
  evening: 18 * 60, // 18:00
};

/** Faza dana za minutu od ponoći. Vrijednosti izvan [0, 1440) se omataju. */
export function dayPhaseAt(minuteOfDay: number): DayPhase {
  const minute = ((Math.floor(minuteOfDay) % MINUTES_PER_DAY) + MINUTES_PER_DAY) % MINUTES_PER_DAY;
  if (minute >= PHASE_STARTS.dawn && minute < PHASE_STARTS.day) return 'dawn';
  if (minute >= PHASE_STARTS.day && minute < PHASE_STARTS.evening) return 'day';
  return 'evening';
}

/** Faza dana za lokalno vrijeme datuma. */
export function dayPhaseOf(date: Date): DayPhase {
  return dayPhaseAt(date.getHours() * 60 + date.getMinutes());
}

/** Gradijent → CSS `linear-gradient(...)` za RN stil `backgroundImage`. */
export function linearGradientCss(gradient: Gradient): string {
  return `linear-gradient(${gradient.angle}deg, ${gradient.colors.join(', ')})`;
}
