/**
 * Otključavanja po razini (korak 32). Koncept: „svaki level otključava nešto vidljivo: novu temu
 * boja, … novi naslov“. Ovdje su **teme boja plamena** (korak 38), **naslovi**, **okviri avatara**
 * i **animacije „Gotovo“** (korak 32b, odluka Borna 2026-11-18).
 *
 * Sve je izvedeno iz razine, a razina iz ukupnog XP-a — ništa se ne sprema. XP se nikad ne oduzima
 * (bez kazni), pa razina i otključano ne padaju. Čista logika, bez React importa.
 */
import { COLOR_THEMES, type ColorThemeId, DEFAULT_COLOR_THEME } from '../theme';

/** Naslovi redom kojim se osvajaju; prvi vrijedi od razine 1. */
export const TITLES = ['spark', 'earlyBird', 'flameKeeper', 'routineMaster', 'habitSmith', 'eternalFlame'] as const;
export type TitleId = (typeof TITLES)[number];

/** Okviri orb-avatara na Profilu; prvi je početni (samo prsten). */
export const AVATAR_FRAMES = ['plain', 'embers', 'halo', 'corona'] as const;
export type AvatarFrameId = (typeof AVATAR_FRAMES)[number];
export const DEFAULT_AVATAR_FRAME: AvatarFrameId = 'plain';

/** Animacija točke na traci dana kad se aktivnost prijavi kao odrađena; prva je početna. */
export const DONE_EFFECTS = ['flare', 'sparks', 'wave'] as const;
export type DoneEffectId = (typeof DONE_EFFECTS)[number];
export const DEFAULT_DONE_EFFECT: DoneEffectId = 'flare';

export type Unlock =
  | { level: number; kind: 'theme'; theme: ColorThemeId }
  | { level: number; kind: 'title'; title: TitleId }
  | { level: number; kind: 'frame'; frame: AvatarFrameId }
  | { level: number; kind: 'doneEffect'; effect: DoneEffectId };

/**
 * Što koja razina otključava, uzlazno po razini. Razina 1 je početno stanje (zadana tema i prvi
 * naslov). Prve nagrade stižu brzo (razina 2 ≈ 100 XP, 3 ≈ 215 XP), kasnije rjeđe — krivulja XP-a
 * raste ~15 % po razini, pa je razina 15 otprilike 4 000 XP.
 */
export const UNLOCKS: readonly Unlock[] = [
  { level: 1, kind: 'title', title: 'spark' },
  { level: 1, kind: 'theme', theme: 'ember' },
  { level: 1, kind: 'frame', frame: 'plain' },
  { level: 1, kind: 'doneEffect', effect: 'flare' },
  { level: 2, kind: 'title', title: 'earlyBird' },
  { level: 3, kind: 'theme', theme: 'rose' },
  { level: 4, kind: 'title', title: 'flameKeeper' },
  { level: 5, kind: 'theme', theme: 'azure' },
  { level: 6, kind: 'title', title: 'routineMaster' },
  { level: 7, kind: 'frame', frame: 'embers' },
  { level: 8, kind: 'theme', theme: 'aurora' },
  { level: 9, kind: 'doneEffect', effect: 'sparks' },
  { level: 10, kind: 'title', title: 'habitSmith' },
  { level: 11, kind: 'frame', frame: 'halo' },
  { level: 12, kind: 'theme', theme: 'violet' },
  { level: 13, kind: 'doneEffect', effect: 'wave' },
  { level: 14, kind: 'frame', frame: 'corona' },
  { level: 15, kind: 'title', title: 'eternalFlame' },
];

/** Razina kao cijeli broj od 1; neispravno (NaN, ±∞, manje od 1) je 1. */
function safeLevel(level: number): number {
  return Number.isFinite(level) ? Math.max(1, Math.floor(level)) : 1;
}

/** Razina na kojoj se tema otključava. */
export function themeUnlockLevel(theme: ColorThemeId): number {
  const unlock = UNLOCKS.find((item) => item.kind === 'theme' && item.theme === theme);
  // Tema bez retka u tablici bila bi dostupna odmah; test jamči da svaka tema ima redak.
  return unlock?.level ?? 1;
}

export function isThemeUnlocked(theme: ColorThemeId, level: number): boolean {
  return themeUnlockLevel(theme) <= safeLevel(level);
}

/** Teme dostupne na razini, redom iz `COLOR_THEMES`. */
export function unlockedThemes(level: number): ColorThemeId[] {
  return COLOR_THEMES.filter((theme) => isThemeUnlocked(theme, level));
}

/** Odabrana tema ako je otključana, inače zadana (npr. nakon brisanja podataka). */
export function usableTheme(selected: ColorThemeId, level: number): ColorThemeId {
  return isThemeUnlocked(selected, level) ? selected : DEFAULT_COLOR_THEME;
}

/** Razina na kojoj se okvir avatara otključava (bez retka u tablici: odmah; test jamči redak). */
export function frameUnlockLevel(frame: AvatarFrameId): number {
  return UNLOCKS.find((item) => item.kind === 'frame' && item.frame === frame)?.level ?? 1;
}

export function isFrameUnlocked(frame: AvatarFrameId, level: number): boolean {
  return frameUnlockLevel(frame) <= safeLevel(level);
}

/** Odabrani okvir ako je otključan, inače početni. */
export function usableFrame(selected: AvatarFrameId, level: number): AvatarFrameId {
  return isFrameUnlocked(selected, level) ? selected : DEFAULT_AVATAR_FRAME;
}

/** Razina na kojoj se animacija „Gotovo“ otključava. */
export function doneEffectUnlockLevel(effect: DoneEffectId): number {
  return UNLOCKS.find((item) => item.kind === 'doneEffect' && item.effect === effect)?.level ?? 1;
}

export function isDoneEffectUnlocked(effect: DoneEffectId, level: number): boolean {
  return doneEffectUnlockLevel(effect) <= safeLevel(level);
}

/** Odabrana animacija ako je otključana, inače početna. */
export function usableDoneEffect(selected: DoneEffectId, level: number): DoneEffectId {
  return isDoneEffectUnlocked(selected, level) ? selected : DEFAULT_DONE_EFFECT;
}

/** Spremljeni zapis → okvir; nepoznat ili prazan je početni. */
export function avatarFrameOr(stored: string | null): AvatarFrameId {
  return AVATAR_FRAMES.find((frame) => frame === stored) ?? DEFAULT_AVATAR_FRAME;
}

/** Spremljeni zapis → animacija „Gotovo“; nepoznat ili prazan je početna. */
export function doneEffectOr(stored: string | null): DoneEffectId {
  return DONE_EFFECTS.find((effect) => effect === stored) ?? DEFAULT_DONE_EFFECT;
}

/** Naslov koji vrijedi na razini: zadnji osvojeni. */
export function titleAt(level: number): TitleId {
  const reached = safeLevel(level);
  let title: TitleId = TITLES[0];
  for (const unlock of UNLOCKS) {
    if (unlock.kind === 'title' && unlock.level <= reached) title = unlock.title;
  }
  return title;
}

/** Otključavanja za razine iznad `from` do uključivo `to` (ono što donosi prijelaz `from` → `to`). */
export function unlocksBetween(from: number, to: number): Unlock[] {
  const low = safeLevel(from);
  const high = safeLevel(to);
  return UNLOCKS.filter((unlock) => unlock.level > low && unlock.level <= high);
}

/** Prva sljedeća razina koja nešto otključava i što; `null` kad je sve otključano. */
export function nextUnlocks(level: number): { level: number; unlocks: Unlock[] } | null {
  const reached = safeLevel(level);
  const next = UNLOCKS.find((unlock) => unlock.level > reached);
  if (next === undefined) return null;
  return { level: next.level, unlocks: UNLOCKS.filter((unlock) => unlock.level === next.level) };
}

export type LevelUp = {
  /** Zadnja razina koju je korisnik vidio. */
  from: number;
  /** Nova razina. */
  to: number;
  /** Sve što su preskočene i nova razina otključale. */
  unlocks: Unlock[];
};

/**
 * Treba li proslaviti novu razinu (korak 35). `lastSeen` je zadnja razina koju je korisnik vidio na
 * ovom uređaju; `null` znači da još nijedna nije zabilježena (prvo pokretanje, postojeći korisnik
 * nakon nadogradnje, novi uređaj) — tada se ne slavi, razina se samo zabilježi. Slavi se jednom i
 * kad je razina narasla dok je app bio zatvoren (Gotovo na obavijesti) ili za više razina odjednom.
 * Pad razine (obrisani podaci) se ne slavi.
 */
export function levelUp(lastSeen: number | null, current: number): LevelUp | null {
  if (lastSeen === null || !Number.isFinite(lastSeen)) return null;
  const from = safeLevel(lastSeen);
  const to = safeLevel(current);
  if (to <= from) return null;
  return { from, to, unlocks: unlocksBetween(from, to) };
}

/** Spremljena zadnja viđena razina (tekst) → broj ili `null` ako je nema ili je neispravna. */
export function parseSeenLevel(stored: string | null): number | null {
  if (stored === null || !/^\d{1,6}$/.test(stored)) return null;
  const level = Number(stored);
  return level >= 1 ? level : null;
}
