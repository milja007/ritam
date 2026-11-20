/**
 * Pozadinsko osvježavanje widgeta (korak 41, Android) — čista logika, bez React importa.
 *
 * Android widget nema vremensku crtu: dok app ne radi, snimka zastari („Sada“ pokazuje aktivnost
 * koja je već gotova). Zato Android periodično (WorkManager, `expo-background-task`) pokrene JS i
 * zapiše novu snimku. iOS to ne treba — `updateTimeline` sam mijenja zapise.
 */

/** Najkraći razmak između pozadinskih osvježavanja (minute). Sustav ga tretira kao najmanji, ne točan. */
export const WIDGET_BACKGROUND_INTERVAL_MINUTES = 15;

/** Ime pozadinskog zadatka (expo-task-manager). */
export const WIDGET_REFRESH_TASK = 'ritam-widget-refresh';

/** Treba li ova platforma pozadinsko osvježavanje widgeta. */
export function usesWidgetBackgroundRefresh(os: string): boolean {
  return os === 'android';
}
