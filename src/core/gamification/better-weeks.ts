/**
 * Niz boljih tjedana (korak 36, koncept „Napredak u odnosu na prošlost“): tjedni zaredom jednako
 * dobri ili bolji od prethodnog. Broje se isti tjedni kao za rang (`closedWeeks`: zaključen
 * tjedan s dovoljno konačnih rezultata), a tjedan bez dovoljno dana prekida niz. Čista logika,
 * bez React importa; ništa se ne sprema.
 */
import { weekStart } from '../progress/compare';
import { addDays, daysBetween } from '../time/local-date';
import type { WeekResult } from './rank';

export type BetterWeeks = {
  /** Niz koji završava tjednom prije tekućeg; 0 ako taj tjedan nije ubrojen ili je bio slabiji. */
  current: number;
  longest: number;
};

/**
 * `weeks` su ubrojeni zaključeni tjedni uzlazno (iz `closedWeeks`), `today` dan za koji se pita.
 * Prvi ubrojeni tjedan nema s čime usporediti, pa ne ulazi u niz.
 */
export function betterWeeksStreak(weeks: readonly WeekResult[], today: string): BetterWeeks {
  let longest = 0;
  let run = 0;
  let previous: WeekResult | null = null;
  for (const week of weeks) {
    const adjacent = previous !== null && daysBetween(previous.start, week.start) === 7;
    run = adjacent && previous !== null && week.average >= previous.average ? run + 1 : 0;
    if (run > longest) longest = run;
    previous = week;
  }
  const currentWeek = weekStart(today);
  const lastWeek = currentWeek === null ? null : addDays(currentWeek, -7);
  return { current: previous !== null && previous.start === lastWeek ? run : 0, longest };
}
