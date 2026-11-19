import { useSyncExternalStore } from 'react';

import {
  avatarFrameOr,
  type AvatarFrameId,
  DEFAULT_AVATAR_FRAME,
  DEFAULT_DONE_EFFECT,
  doneEffectOr,
  type DoneEffectId,
} from '@/core/gamification';

import { readDevicePref, writeDevicePref } from './device-prefs';

/**
 * Odabrani okvir avatara i animacija „Gotovo“ (korak 32b). Kao tema boja: pamti se samo na ovom
 * uređaju (`device-prefs`), vrijedi odmah, ne sinkronizira se. Je li odabir otključan provjerava
 * pozivatelj (`usableFrame` / `usableDoneEffect`), pa zaključan odabir nakon brisanja podataka
 * samo padne na početni.
 */
function devicePrefStore<T extends string>(key: string, parse: (stored: string | null) => T, fallback: T) {
  let current: T | null = null;
  const listeners = new Set<() => void>();
  const get = (): T => {
    current ??= parse(readDevicePref(key));
    return current;
  };
  const subscribe = (listener: () => void) => {
    listeners.add(listener);
    return () => {
      listeners.delete(listener);
    };
  };
  return {
    get,
    set(next: T) {
      if (get() === next) return;
      current = next;
      writeDevicePref(key, next);
      for (const listener of listeners) listener();
    },
    use(): T {
      return useSyncExternalStore(subscribe, get, () => fallback);
    },
    resetForTests() {
      current = null;
    },
  };
}

const frameStore = devicePrefStore<AvatarFrameId>('ritam.avatarFrame', avatarFrameOr, DEFAULT_AVATAR_FRAME);
const doneEffectStore = devicePrefStore<DoneEffectId>('ritam.doneEffect', doneEffectOr, DEFAULT_DONE_EFFECT);

export const getAvatarFrame = frameStore.get;
export const setAvatarFrame = frameStore.set;
export const useAvatarFrame = frameStore.use;

export const getDoneEffect = doneEffectStore.get;
export const setDoneEffect = doneEffectStore.set;
export const useDoneEffect = doneEffectStore.use;

/** Samo za testove. */
export function resetRewardPrefsForTests(): void {
  frameStore.resetForTests();
  doneEffectStore.resetForTests();
}
