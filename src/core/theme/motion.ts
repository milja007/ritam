/**
 * Tokeni kretanja (korak 35). Kratko i mirno: animacija potvrđuje promjenu, ne zabavlja.
 * Komponente uz „smanji kretanje“ preskaču animaciju i odmah prikažu krajnje stanje.
 */

/** Klizanje ispune trake napretka do nove vrijednosti. */
export const FILL_DURATION_MS = 450;

/** Paljenje žara nakon večernjeg upita (Ž9): aureola nabuja i smiri se. */
export const IGNITE_DURATION_MS = 900;

/** Koliko dugo žar naraste prije smirivanja; ostatak `IGNITE_DURATION_MS` je povratak na svoju veličinu. */
export const IGNITE_SWELL_MS = 260;

/** „+N XP“ uz XP traku (korak 35): pojavi se, kratko stoji i izblijedi dok se diže. */
export const XP_POP_DURATION_MS = 1400;

/** Koliko brzo se „+N XP“ pojavi; ostatak `XP_POP_DURATION_MS` je stajanje i blijeđenje. */
export const XP_POP_IN_MS = 160;

/** Koliko se „+N XP“ digne (px) dok blijedi; uz „smanji kretanje“ samo blijedi. */
export const XP_POP_RISE = 14;

/** Udio 0–1 za trake i grafove; neispravan broj (NaN, ±∞) je 0. */
export function clampFraction(value: number): number {
  return Number.isFinite(value) ? Math.min(1, Math.max(0, value)) : 0;
}
