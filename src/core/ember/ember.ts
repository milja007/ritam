/**
 * Smjer „Žar“ (odluka Borna, 2026-11-12): dan izgori u žar.
 * Čista logika: svjetlina žara iz dnevnog rezultata i stanje točke na traci dana.
 * Neodrađeno je ugašen žar — nikad crveni X ni kazna.
 */
import type { ScheduleBlock } from '../domain';
import type { BlockPhase } from '../schedule';
import { contrastRatio, DEFAULT_COLOR_THEME, type FlamePalette, flamePalettes, palette, type ColorScheme } from '../theme';

/** Paleta kad pozivatelj ne proslijedi temu (testovi, zadana tema „Žar“). */
const DEFAULT_FLAME = flamePalettes[DEFAULT_COLOR_THEME];

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

/**
 * Pali li se žar upravo sada (Ž9): prijelaz iz ugašenog u upaljeni dok ekran stoji otvoren —
 * dan je dobio konačni rezultat (večernji upit). Prvo crtanje (`previous === null`) ne animira,
 * jer je dan tada već bio upaljen kad se ekran otvorio. Gašenje se nikad ne animira.
 */
export function shouldIgnite(previous: EmberLevel | null, next: EmberLevel): boolean {
  return previous === 'unlit' && next !== 'unlit';
}

export type EmberColor = {
  /** Ispuna žara; `null` za ugašen žar (samo obrub). */
  fill: string | null;
  /** Boja teksta ili obruba na žaru. */
  on: string;
  /** Jačina sjaja oko žara, 0–1. */
  glow: number;
};

type LitLevel = Exclude<EmberLevel, 'unlit'>;

function darkFill(flame: FlamePalette): Record<LitLevel, string> {
  return { faint: flame.ember800, low: flame.ember600, warm: flame.ember400, bright: flame.ember200 };
}

// Na svijetloj pozadini jači dan je zasićeniji i tamniji, slabiji blijedi.
function lightFill(flame: FlamePalette): Record<LitLevel, string> {
  return { faint: flame.ember100, low: flame.ember200, warm: flame.ember400, bright: flame.flame600 };
}

const GLOW: Record<EmberLevel, number> = { unlit: 0, faint: 0.25, low: 0.45, warm: 0.7, bright: 1 };

/**
 * Boje žara za razinu, shemu i temu plamena; tekst na žaru bira se po kontrastu (bijela ili tamna).
 */
export function emberColor(level: EmberLevel, scheme: ColorScheme, flame: FlamePalette = DEFAULT_FLAME): EmberColor {
  if (level === 'unlit') {
    return { fill: null, on: scheme === 'dark' ? palette.ink500 : palette.ink400, glow: 0 };
  }
  const fill = (scheme === 'dark' ? darkFill(flame) : lightFill(flame))[level];
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

/**
 * Stanje točke na traci. `flame: false` = plamen već nosi drugi redak (redak „Sada“ ili ranija
 * preklopljena aktivnost), pa aktivnost koja traje ostaje ocrtana — na traci je uvijek jedan orb.
 */
export function railState(block: RailBlock, phase: BlockPhase, flame = true): RailState {
  if (block.status === 'done') return 'lit';
  if (block.status === 'partial') return 'half';
  if (block.status === 'skipped' || block.status === 'moved') return 'unlit';
  if (phase === 'current') return block.kind === 'sleep' || !flame ? 'ahead' : 'now';
  return phase === 'past' ? 'unlit' : 'ahead';
}

/** Koliko točka svijetli: ugašena/ocrtana 0, pola 1, odrađeno 2. */
function railGlow(state: RailState): number {
  return state === 'lit' ? 2 : state === 'half' ? 1 : 0;
}

/**
 * Bljesne li točka na traci (korak 35, animacija „Gotovo“): samo kad zasvijetli jače nego prije dok
 * je ekran otvoren — aktivnost je upravo prijavljena kao odrađena ili napola odrađena. Prvo crtanje
 * (`previous === null`) i gašenje (poništena prijava) ne animiraju.
 */
export function shouldFlareDot(previous: RailState | null, next: RailState): boolean {
  return previous !== null && railGlow(next) > railGlow(previous);
}

/**
 * Aktivnost koja nosi plamen na traci bez zasebnog retka „Sada“: prva (po redoslijedu trake)
 * koja traje. Kod preklopa ostale ostaju ocrtane.
 */
export function flameBlockId<T extends RailBlock & { id: string }>(
  blocks: readonly T[],
  phaseOf: (block: T) => BlockPhase,
): string | null {
  return blocks.find((block) => railState(block, phaseOf(block)) === 'now')?.id ?? null;
}

/** Linija ispod točke: iza plamena je izgorjela (puna), ispred njega tek ocrtana (crtkana). */
export type RailLine = 'burnt' | 'ahead';

export function railLine(phase: BlockPhase): RailLine {
  return phase === 'past' ? 'burnt' : 'ahead';
}

export type RailColors = {
  /** Odrađena točka. */
  lit: string;
  /** Djelomično odrađena točka (ispuna); obrub je `lit`. */
  half: string;
  /** Obrub ugašenog žara. */
  ring: string;
  /** Izgorjela linija iza plamena. */
  burnt: string;
  /** Crtkana linija plana ispred plamena. */
  ahead: string;
  /** Orb-plamen: jezgra, sredina, rub i sjaj. */
  orb: { core: string; mid: string; edge: string; glow: string };
};

/** Boje trake dana po shemi i temi plamena. */
export function railColors(scheme: ColorScheme, flame: FlamePalette = DEFAULT_FLAME): RailColors {
  return scheme === 'dark'
    ? {
        lit: flame.flame300,
        half: flame.flame600,
        ring: palette.ink400,
        burnt: flame.flame600,
        ahead: palette.ink500,
        orb: { core: flame.ember50, mid: flame.flame300, edge: flame.flame600, glow: flame.flame400 },
      }
    : {
        lit: flame.flame600,
        half: flame.ember200,
        ring: palette.ink400,
        burnt: flame.flame300,
        ahead: palette.ink400,
        orb: { core: flame.ember50, mid: flame.flame400, edge: flame.flame700, glow: flame.flame400 },
      };
}

export type SegmentColor = { fill: string | null; border: string | null };

/**
 * Boje odsječka u stupcu tjedna. Tip je string ključ (`SegmentLook` iz `periods`), da ovaj modul
 * ostane bez kružnog uvoza.
 */
export function segmentColor(
  look: 'done' | 'half' | 'missed' | 'plan' | 'fixed' | 'fixedPlan',
  scheme: ColorScheme,
  flame: FlamePalette = DEFAULT_FLAME,
): SegmentColor {
  const dark = scheme === 'dark';
  switch (look) {
    case 'done':
      return { fill: dark ? flame.flame400 : flame.flame600, border: null };
    case 'half':
      return { fill: dark ? flame.flame600 : flame.ember200, border: dark ? flame.flame300 : flame.flame600 };
    case 'missed':
      return { fill: dark ? palette.ink700 : palette.ink100, border: null };
    case 'plan':
      return { fill: null, border: palette.ink400 };
    case 'fixed':
      return { fill: dark ? palette.sky700 : palette.sky400, border: null };
    case 'fixedPlan':
      return { fill: null, border: dark ? palette.sky400 : palette.sky700 };
  }
}
