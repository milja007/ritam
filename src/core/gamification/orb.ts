/**
 * Orb-plamen avatar (korak 33, platno „Profil“): plamen je slika napretka naspram vlastite prošlosti.
 * - **veličina** jezgre raste s rangom („plamen raste kad napredak traje“),
 * - **toplina** (svjetlina) je prosjek konačnih dnevnih rezultata zadnjih 7 dana,
 * - **iskre** kruže oko plamena dok traje niz (3, 7 i 30 dana).
 * Bez kazni: jednom upaljen plamen bez svježih rezultata samo tinja — nikad se ne gasi, i ne smanjuje se.
 * Rezultat „u tijeku“ ne grije (žar pali samo konačni rezultat). Čista logika, ništa se ne sprema.
 */
import { isValidLocalDate } from '../domain/common';
import { emberLevel, type EmberLevel } from '../ember/ember';
import { palette, type ColorScheme } from '../theme';
import { addDays } from '../time/local-date';
import { rankProgress, type Rank, type RankDay } from './rank';
import { streakFromDates } from './streak';

/** Koliko dana unatrag (uključujući `today`) grije plamen. */
export const ORB_HEAT_WINDOW_DAYS = 7;

/** Promjer jezgre kao udio promjera avatara, po rangu (platno: rang D ≈ 68 / 116). */
export const ORB_CORE_SCALE: Readonly<Record<Rank, number>> = {
  E: 0.5,
  D: 0.58,
  C: 0.65,
  B: 0.72,
  A: 0.79,
  S: 0.86,
};

/** Duljine niza (dani) od kojih oko plamena kruži jedna, dvije i tri iskre. */
export const ORB_SPARK_STREAKS = [3, 7, 30] as const;

/** Trajanje jednog udaha aureole (ms); topliji plamen diše brže. Ugašen ne diše. */
export const ORB_PULSE_MS: Readonly<Record<EmberLevel, number>> = {
  unlit: 0,
  faint: 3400,
  low: 2800,
  warm: 2300,
  bright: 1900,
};

/** Zašto plamen gori kako gori — za tekst uz avatar. */
export type OrbState = 'unlit' | 'resting' | 'burning';

export type OrbFlame = {
  rank: Rank;
  /** Svjetlina plamena. */
  heat: EmberLevel;
  /**
   * `unlit` još nema nijednog konačnog rezultata, `resting` ima ih, ali ne u zadnjih 7 dana (tinja),
   * `burning` grije ga prosjek zadnjih 7 dana.
   */
  state: OrbState;
  /** Prosjek konačnih rezultata zadnjih 7 dana, zaokružen; `null` kad ih u tom razdoblju nema. */
  average: number | null;
  /** Promjer jezgre kao udio promjera avatara (0–1). */
  coreScale: number;
  /** Tekući niz u danima. */
  streak: number;
  /** Broj iskri oko plamena (0–3). */
  sparks: number;
  /** Trajanje udaha aureole u ms; 0 = ne diše. */
  pulseMs: number;
};

/** Broj iskri za duljinu niza; neispravan ili negativan niz je 0. */
export function orbSparks(streak: number): number {
  if (!Number.isFinite(streak)) return 0;
  return ORB_SPARK_STREAKS.filter((days) => streak >= days).length;
}

/**
 * Stanje orb-plamena na dan `today` iz ocijenjenih dana i dana niza.
 * Neispravan `today` daje ugašen plamen ranga E.
 */
export function orbFlame(days: readonly RankDay[], streakDates: Iterable<string>, today: string): OrbFlame {
  const { rank } = rankProgress(days, today);
  const from = isValidLocalDate(today) ? addDays(today, -(ORB_HEAT_WINDOW_DAYS - 1)) : null;

  // Zadnji zapis za dan pobjeđuje, da se isti dan ne broji dvaput.
  const recent = new Map<string, number>();
  let everLit = false;
  if (from !== null) {
    for (const day of days) {
      if (!day.final || !Number.isFinite(day.score) || !isValidLocalDate(day.date) || day.date > today) continue;
      everLit = true;
      if (day.date >= from) recent.set(day.date, day.score);
    }
  }

  let average: number | null = null;
  if (recent.size > 0) {
    let sum = 0;
    for (const score of recent.values()) sum += score;
    average = Math.round(sum / recent.size);
  }

  const state: OrbState = average !== null ? 'burning' : everLit ? 'resting' : 'unlit';
  const heat: EmberLevel = state === 'burning' ? emberLevel(average) : state === 'resting' ? 'faint' : 'unlit';
  const streak = streakFromDates(streakDates, today).current;

  return {
    rank,
    heat,
    state,
    average,
    coreScale: ORB_CORE_SCALE[rank],
    streak,
    // Ugašen plamen nema iskri: prvo treba konačan rezultat.
    sparks: state === 'unlit' ? 0 : orbSparks(streak),
    pulseMs: ORB_PULSE_MS[heat],
  };
}

export type OrbFlameColors = {
  /** Boje jezgre od žarišta prema rubu (radijalni gradijent). */
  core: string;
  mid: string;
  glow: string;
  edge: string;
  /** Vanjski i crtkani prsten. */
  ring: string;
  dashed: string;
  /** Boja iskre. */
  spark: string;
  /** Jačina aureole 0–1. */
  halo: number;
};

const HALO: Readonly<Record<EmberLevel, number>> = { unlit: 0, faint: 0.3, low: 0.5, warm: 0.75, bright: 1 };

/**
 * Boje plamena po toplini i shemi. Topliji plamen ima svjetlije žarište i jaču aureolu; slabiji je
 * tamniji žar. Ugašen plamen nema ispunu — crta se samo obrub (`edge`).
 */
export function orbFlameColors(heat: EmberLevel, scheme: ColorScheme): OrbFlameColors {
  const dark = scheme === 'dark';
  const rings = {
    ring: dark ? palette.ink700 : palette.ink100,
    dashed: dark ? palette.ink500 : palette.ink400,
    spark: dark ? palette.flame300 : palette.flame600,
    halo: HALO[heat],
  };
  switch (heat) {
    case 'bright':
      return { ...rings, core: palette.ember50, mid: palette.flame300, glow: palette.flame400, edge: palette.flame600 };
    case 'warm':
      return { ...rings, core: palette.ember100, mid: palette.flame400, glow: palette.ember400, edge: palette.flame700 };
    case 'low':
      return { ...rings, core: palette.ember200, mid: palette.ember400, glow: palette.ember600, edge: palette.ember800 };
    case 'faint':
      return { ...rings, core: palette.ember400, mid: palette.ember600, glow: palette.ember800, edge: palette.ember900 };
    default:
      return {
        ...rings,
        core: 'transparent',
        mid: 'transparent',
        glow: 'transparent',
        edge: dark ? palette.ink500 : palette.ink400,
      };
  }
}
