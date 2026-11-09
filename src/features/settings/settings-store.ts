import { useSyncExternalStore } from 'react';

import type { Settings } from '@/core/domain';
import { LOCAL_USER_ID } from '@/core/user/local-user';
import { getDb } from '@/db/open';
import { getSettings, saveSettings, type SettingsInput } from '@/db/repos';
import { syncNotificationsNow } from '@/features/notifications';
import { setLanguagePreference } from '@/i18n';
import { setPhaseAnchor } from '@/ui/theme';

/**
 * Postavke korisnika u memoriji, zajedničke svim ekranima (Profil, onboarding gate, tema).
 * Svako učitavanje i spremanje primijeni jezik i granice doba dana; spremanje ponovo zakaže obavijesti.
 */
export type SettingsState =
  | { status: 'loading'; settings: null }
  | { status: 'ready'; settings: Settings | null }
  | { status: 'error'; settings: null };

let state: SettingsState = { status: 'loading', settings: null };
const listeners = new Set<() => void>();

function publish(next: SettingsState) {
  state = next;
  if (next.settings) {
    setLanguagePreference(next.settings.language);
    setPhaseAnchor(next.settings);
  }
  for (const listener of listeners) listener();
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

/** Učitaj postavke iz baze (`null` = još nema onboardinga). Greška ide pozivatelju. */
export async function loadSettings(): Promise<Settings | null> {
  try {
    const settings = await getSettings(getDb(), LOCAL_USER_ID);
    publish({ status: 'ready', settings });
    return settings;
  } catch (error) {
    publish({ status: 'error', settings: null });
    throw error;
  }
}

/** Spremi promjenu postavki (validira se Zodom) i primijeni je. Greška ide pozivatelju. */
export async function updateSettings(patch: Partial<SettingsInput>): Promise<Settings> {
  const current = state.settings ?? (await getSettings(getDb(), LOCAL_USER_ID));
  if (current === null) throw new Error('Settings do not exist yet');
  const { id: _id, userId: _userId, createdAt: _createdAt, updatedAt: _updatedAt, ...input } = current;
  const saved = await saveSettings(getDb(), LOCAL_USER_ID, { ...input, ...patch });
  publish({ status: 'ready', settings: saved });
  void syncNotificationsNow();
  return saved;
}

export function useSettings(): SettingsState {
  return useSyncExternalStore(subscribe, () => state, () => state);
}
