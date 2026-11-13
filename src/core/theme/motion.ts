/**
 * Tokeni kretanja (korak 35). Kratko i mirno: animacija potvrđuje promjenu, ne zabavlja.
 * Komponente uz „smanji kretanje“ preskaču animaciju i odmah prikažu krajnje stanje.
 */

/** Klizanje ispune trake napretka do nove vrijednosti. */
export const FILL_DURATION_MS = 450;

/** Udio 0–1 za trake i grafove; neispravan broj (NaN, ±∞) je 0. */
export function clampFraction(value: number): number {
  return Number.isFinite(value) ? Math.min(1, Math.max(0, value)) : 0;
}
