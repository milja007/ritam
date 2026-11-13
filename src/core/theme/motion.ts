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

/** Bljesak žara u piluli niza kad niz naraste (korak 35): aureola nabuja i nestane. */
export const FLARE_DURATION_MS = 700;

/** Koliko brzo bljesak nabuja; ostatak `FLARE_DURATION_MS` je smirivanje. */
export const FLARE_SWELL_MS = 200;

/** Koliko broj niza poskoči (višekratnik veličine) dok žar bljesne. */
export const BUMP_SCALE = 1.2;

/** Jedan krug iskri oko orb-plamena na Profilu (korak 33); sporo, da ne odvlači pažnju. */
export const ORB_ORBIT_MS = 28000;

/** Treperenje žarišta orb-plamena kao udio trajanja udaha; namjerno neusklađeno s disanjem aureole. */
export const ORB_FLICKER_RATIO = 0.37;

/** Udio 0–1 za trake i grafove; neispravan broj (NaN, ±∞) je 0. */
export function clampFraction(value: number): number {
  return Number.isFinite(value) ? Math.min(1, Math.max(0, value)) : 0;
}
