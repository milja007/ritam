/**
 * Pravi plamen u jezgri orb-plamena (korak 33, Skia): koliko je visok, koliko brzo gori i koliko
 * žeravica se diže, po toplini. Čista logika; shader je u `src/ui/orb-fire-shader.ts`.
 * Pravila ostaju ista kao u `orb.ts`: toplina = prosjek zadnjih 7 dana, a plamen se nikad ne
 * gasi ni ne smanjuje zbog pauze — tinja (`faint`) je nizak i spor, ali gori.
 */
import type { EmberLevel } from '../ember/ember';

export type OrbFireMotion = {
  /** Visina vrha plamena kao udio jezgre (0–1). */
  height: number;
  /** Brzina dizanja turbulencije (1 = normalno). */
  speed: number;
  /** Gustoća žeravica koje se dižu (0–1). */
  embers: number;
};

export const ORB_FIRE_MOTION: Readonly<Record<Exclude<EmberLevel, 'unlit'>, OrbFireMotion>> = {
  faint: { height: 0.45, speed: 0.45, embers: 0 },
  low: { height: 0.62, speed: 0.65, embers: 0.25 },
  warm: { height: 0.8, speed: 0.85, embers: 0.55 },
  bright: { height: 0.95, speed: 1, embers: 0.9 },
};

/** Gibanje plamena za toplinu; ugašen nema plamena (`null`). */
export function orbFireMotion(heat: EmberLevel): OrbFireMotion | null {
  return heat === 'unlit' ? null : ORB_FIRE_MOTION[heat];
}

/**
 * Boja za uniform shadera: `#RRGGBB` ili `#RRGGBBAA` → [r, g, b, a] u 0–1. Neispravan zapis ili
 * `transparent` daje potpuno prozirnu crnu, da shader nikad ne dobije NaN.
 */
export function colorUniform(hex: string): [number, number, number, number] {
  const match = /^#([0-9a-f]{6})([0-9a-f]{2})?$/i.exec(hex.trim());
  if (match === null) return [0, 0, 0, 0];
  const rgb = parseInt(match[1], 16);
  const alpha = match[2] === undefined ? 255 : parseInt(match[2], 16);
  return [((rgb >> 16) & 255) / 255, ((rgb >> 8) & 255) / 255, (rgb & 255) / 255, alpha / 255];
}

/** Vrijeme (s) u kojem plamen stoji kad je uključeno „smanji kretanje“: lijep, pun oblik. */
export const ORB_FIRE_STILL_TIME = 1.5;
