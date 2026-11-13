/**
 * Smjer „Žar“ (odluka Borna, 2026-11-12): dan izgori u žar.
 * Čista logika: svjetlina žara iz dnevnog rezultata i stanje točke na traci dana.
 * Neodrađeno je ugašen žar — nikad crveni X ni kazna.
 */
import type { ScheduleBlock } from '../domain';
import type { BlockPhase } from '../schedule';
import { contrastRatio, palette, type ColorScheme } from '../theme';

/** Svjetlina žara, od ugašenog do najjačeg. */
export const EMBER_LEVELS = ['unlit', 'faint', 'low', 'warm', 'bright'] as const;
export type EmberLevel = (typeof EMBER_LEVELS)[number];

/** Donje granice rezultata (0–100) za razine `low`, `warm` i `bright`. */
export const EMBER_THRESHOLDS = { low: 55, warm: 70, bright: 85 } as const;

/**
 * Svjetlina žara za dnevni rezultat 0–100. Dan bez rezultata (`null`, npr. bez večernjeg
 * upita) je ugašen žar; dan s rezultatom uvijek barem tinja, i kad je rezultat 0.
 */
export function emberLevel(score: number | null): EmberLevel {
  if (score === null || !Number.isFinite(score)) return 'unlit';
  if (score >= EMBER_THRESHOLDS.bright) return 'bright';
  if (score >= EMBER_THRESHOLDS.warm) return 'warm';
  if (score >= EMBER_THRESHOLDS.low) return 'low';
  return 'faint';
}

export type EmberColor = {
  /** Ispuna žara; `null` za ugašen žar (samo obrub). */
  fill: string | null;
  /** Boja teksta ili obruba na žaru. */
  on: string;
  /** Jačina sjaja oko žara, 0–1. */
  glow: number;
};

const DARK_FILL: Record<Exclude<EmberLevel, 'unlit'>, string> = {
  faint: palette.ember800,
  low: palette.ember600,
  warm: palette.ember400,
  bright: palette.ember200,
};

// Na svijetloj pozadini jači dan je zasićeniji i tamniji, slabiji blijedi.
const LIGHT_FILL: Record<Exclude<EmberLevel, 'unlit'>, string> = {
  faint: palette.ember100,
  low: palette.ember200,
  warm: palette.ember400,
  bright: palette.flame600,
};

const GLOW: Record<EmberLevel, number> = { unlit: 0, faint: 0.25, low: 0.45, warm: 0.7, bright: 1 };

/** Boje žara za razinu i shemu; tekst na žaru bira se po kontrastu (bijela ili tamna). */
export function emberColor(level: EmberLevel, scheme: ColorScheme): EmberColor {
  if (level === 'unlit') {
    return { fill: null, on: scheme === 'dark' ? palette.ink500 : palette.ink400, glow: 0 };
  }
  const fill = (scheme === 'dark' ? DARK_FILL : LIGHT_FILL)[level];
  const light = contrastRatio(palette.white, fill) ?? 0;
  const dark = contrastRatio(palette.ink950, fill) ?? 0;
  return { fill, on: light >= dark ? palette.white : palette.ink950, glow: GLOW[level] };
}

/**
 * Stanje točke na traci dana:
 * `lit` odrađeno (svijetli), `half` djelomično, `unlit` nije odrađeno ili još neprijavljeno
 * (ugašen žar), `now` traje sada (orb-plamen), `ahead` plan ispred plamena (tek ocrtan).
 */
export const RAIL_STATES = ['lit', 'half', 'unlit', 'now', 'ahead'] as const;
export type RailState = (typeof RAIL_STATES)[number];

type RailBlock = Pick<ScheduleBlock, 'status' | 'kind'>;

export function railState(block: RailBlock, phase: BlockPhase): RailState {
  if (block.status === 'done') return 'lit';
  if (block.status === 'partial') return 'half';
  if (block.status === 'skipped' || block.status === 'moved') return 'unlit';
  if (phase === 'current') return block.kind === 'sleep' ? 'ahead' : 'now';
  return phase === 'past' ? 'unlit' : 'ahead';
}

/** Linija ispod točke: iza plamena je izgorjela (puna), ispred njega tek ocrtana (crtkana). */
export type RailLine = 'burnt' | 'ahead';

export function railLine(phase: BlockPhase): RailLine {
  return phase === 'past' ? 'burnt' : 'ahead';
}
