/**
 * Razine (leveli) izvedene iz ukupnog XP-a — samo računanje za XP traku.
 * Krivulja iz koncepta: level 2 = 100 XP, svaki sljedeći korak ~15 % više (raste postupno).
 * Što razine otključavaju je u `unlocks.ts` (korak 32). Čista logika, bez React importa.
 */

/** XP potreban za prijelaz s razine 1 na 2. */
export const FIRST_LEVEL_STEP_XP = 100;
/** Svaki sljedeći korak je toliko puta veći. */
export const LEVEL_STEP_GROWTH = 1.15;
/** Koraci se zaokružuju na ovaj broj XP-a (čitljivi brojevi: 100, 115, 130, 150…). */
const ROUND_TO = 5;

/**
 * XP potreban da se s razine `level` dođe na `level + 1` (razina 1 → 100, 2 → 115, 3 → 130…).
 * Razina manja od 1 se tretira kao 1.
 */
export function xpForLevelStep(level: number): number {
  const n = Math.max(1, Math.floor(level));
  const raw = FIRST_LEVEL_STEP_XP * LEVEL_STEP_GROWTH ** (n - 1);
  return Math.round(raw / ROUND_TO) * ROUND_TO;
}

export type LevelProgress = {
  /** Trenutna razina (od 1). */
  level: number;
  /** XP skupljen unutar trenutne razine. */
  xpIntoLevel: number;
  /** XP potreban za sljedeću razinu (veličina trenutnog koraka). */
  xpForNext: number;
  /** Udio trake 0–1. */
  fraction: number;
};

/** Razina i napredak do sljedeće iz ukupnog XP-a (negativno ili neispravno → 0 XP). */
export function levelProgress(totalXp: number): LevelProgress {
  let remaining = Number.isFinite(totalXp) ? Math.max(0, Math.floor(totalXp)) : 0;
  let level = 1;
  let step = xpForLevelStep(level);
  while (remaining >= step) {
    remaining -= step;
    level += 1;
    step = xpForLevelStep(level);
  }
  return { level, xpIntoLevel: remaining, xpForNext: step, fraction: remaining / step };
}
