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

/** Level-up (korak 35): pauza prije slavlja, da se prethodni modal (npr. večernji upit) stigne zatvoriti. */
export const LEVEL_UP_DELAY_MS = 500;

/** Level-up: traka se napuni do kraja prije nego što razina poskoči. */
export const LEVEL_UP_FILL_MS = 700;

/** Level-up: koliko traje jedan korak odbrojavanja razine (kad se preskoči više razina). */
export const LEVEL_UP_COUNT_STEP_MS = 220;

/** Level-up: iskre polete iz plamena i izblijede. */
export const LEVEL_UP_BURST_MS = 1000;

/** Level-up: broj iskri u prasku. */
export const LEVEL_UP_SPARKS = 18;

/** Level-up: popis otključanog i gumbi izrone nakon praska. */
export const LEVEL_UP_REVEAL_MS = 350;

export type BurstSpark = {
  /** Smjer leta u radijanima. */
  angle: number;
  /** Domet 0–1 (udio najvećeg dometa). */
  reach: number;
  /** Veličina 0–1 (udio najveće iskre). */
  size: number;
  /** Kašnjenje polijetanja 0–1 (udio trajanja praska). */
  delay: number;
  /** Koja boja plamena (0, 1 ili 2), da prasak nije jednobojan. */
  tone: 0 | 1 | 2;
};

/**
 * Raspored iskri za prasak pri level-upu. Determinističan (bez slučajnih brojeva), da se isti
 * prasak crta pri svakom renderu: iskre su ravnomjerno raspoređene u krug, a domet, veličina i
 * kašnjenje se izmjenjuju po zlatnom kutu pa ne izgledaju pravilno.
 */
export function burstSparks(count: number): BurstSpark[] {
  const n = Number.isFinite(count) ? Math.max(0, Math.floor(count)) : 0;
  const golden = 0.618033988749895;
  return Array.from({ length: n }, (_, i) => {
    const wobble = (i * golden) % 1;
    return {
      angle: (i / n) * Math.PI * 2 + wobble * 0.35,
      reach: 0.55 + wobble * 0.45,
      size: 0.45 + ((i * 3 * golden) % 1) * 0.55,
      delay: ((i * 5 * golden) % 1) * 0.25,
      tone: (i % 3) as 0 | 1 | 2,
    };
  });
}

/**
 * Razine koje se redom prikazuju dok se broj „odbrojava“ od `from` do `to`. Kad je skok velik
 * (app je dugo bio zatvoren), prikazuje se najviše `maxSteps` zadnjih koraka — odbrojavanje ostaje
 * kratko, a uvijek završi na `to`. Bez rasta vraća samo `to`.
 */
export function countUpLevels(from: number, to: number, maxSteps = 6): number[] {
  const end = Number.isFinite(to) ? Math.max(1, Math.floor(to)) : 1;
  const start = Number.isFinite(from) ? Math.max(1, Math.floor(from)) : end;
  if (end <= start) return [end];
  const steps = Math.max(1, Math.floor(maxSteps));
  const first = Math.max(start, end - steps);
  return Array.from({ length: end - first + 1 }, (_, i) => first + i);
}
