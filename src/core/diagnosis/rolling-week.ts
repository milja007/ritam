/**
 * „Zadnjih 7 dana“ (koncept, Dijagnoze): zadnji dan mjeseca koji nije nedjelja dobiva uz dnevnu i
 * mjesečnu i tjedni dio — ne kalendarski tjedan (on još traje), nego zadnjih 7 dana naspram 7 dana
 * prije. Isti graditelji kao tjedna dijagnoza, ali samo pregled: bez prijedloga za prihvaćanje
 * (jedna nova promjena tjedno ostaje nedjeljom) i bez niza boljih tjedana (vezan je uz pon–ned).
 * Čista logika, bez Reacta.
 */
import { addDays } from '../time/local-date';
import { isMonthLastDay } from './month-diagnosis';
import type { PeriodStats } from './period-stats';
import { buildWeekDiagnosis, isWeekLastDay, type WeekDiagnosis } from './week-diagnosis';

/** Pokazuje li dan `date` „zadnjih 7 dana“: zadnji dan mjeseca koji nije nedjelja. */
export function showsRollingWeek(date: string): boolean {
  return isMonthLastDay(date) && !isWeekLastDay(date);
}

/** Prvi dan razdoblja „zadnjih 7 dana“ koje završava danom `end`; `null` za neispravan datum. */
export function rollingWeekStart(end: string): string | null {
  return addDays(end, -6);
}

/**
 * Pregled zadnjih 7 dana iz statistike tih dana (`current`) i 7 dana prije (`previous`, `null` kad
 * nema usporedbe). Ideje i prijedlog se ne pokazuju, pa povijest tjednih prijedloga ne treba.
 */
export function buildRollingWeekDiagnosis(
  current: PeriodStats,
  previous: PeriodStats | null,
): WeekDiagnosis {
  const full = buildWeekDiagnosis(current, previous, { betterWeeks: 0, previousBest: null });
  return {
    ...full,
    progress: full.progress.filter((row) => row.metric !== 'betterWeeks'),
    ideas: [],
    suggestion: null,
    carried: false,
  };
}
