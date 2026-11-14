import { useEffect, useSyncExternalStore } from 'react';

import { levelUp, type LevelUp, parseSeenLevel, usableTheme } from '@/core/gamification';
import { readDevicePref, writeDevicePref } from '@/ui/device-prefs';
import { getColorTheme, setColorTheme } from '@/ui/theme';

const KEY = 'ritam.seenLevel';

/**
 * Zadnja razina koju je korisnik **vidio** na ovom uređaju (korak 35). Pamti se na uređaju, a mijenja
 * tek kad se slavlje zatvori — zato level-up koji se dogodio dok je app bio zatvoren (Gotovo na
 * obavijesti) ili dok je bio otvoren drugi ekran ne propadne, nego pričeka. `undefined` = još nije
 * pročitana iz spremišta.
 */
let seen: number | null | undefined;
const listeners = new Set<() => void>();

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

function getSeen(): number | null {
  if (seen === undefined) seen = parseSeenLevel(readDevicePref(KEY));
  return seen;
}

function setSeen(level: number): void {
  if (getSeen() === level) return;
  seen = level;
  writeDevicePref(KEY, String(level));
  for (const listener of listeners) listener();
}

/**
 * Uskladi spremljeno stanje s trenutnom razinom: prvo bilježenje (bez slavlja) i pad razine nakon
 * brisanja podataka. Usput vrati zadanu temu ako odabrana više nije otključana.
 */
function syncLevel(level: number): void {
  const current = getSeen();
  if (current === null || level < current) setSeen(level);
  const theme = getColorTheme();
  const usable = usableTheme(theme, level);
  if (usable !== theme) setColorTheme(usable);
}

/** Korisnik je vidio slavlje za ovu razinu — više se ne prikazuje. */
export function acknowledgeLevel(level: number): void {
  setSeen(level);
}

/**
 * Level-up koji čeka slavlje, ili `null`. `level` je trenutna razina (`null` dok se napredak
 * učitava). Izvedeno iz zadnje viđene i trenutne razine, pa vrijedi i nakon ponovnog pokretanja.
 */
export function useLevelUp(level: number | null): LevelUp | null {
  const lastSeen = useSyncExternalStore(subscribe, getSeen, () => null);
  useEffect(() => {
    if (level !== null) syncLevel(level);
  }, [level]);
  return level === null ? null : levelUp(lastSeen, level);
}
