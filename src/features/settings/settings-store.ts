import { useSyncExternalStore } from 'react';

import type { Settings } from '@/core/domain';
import { type ColorThemeId, resolveAccountColorTheme } from '@/core/theme';
import { LOCAL_USER_ID } from '@/core/user/local-user';
import { getDb } from '@/db/open';
import { getSettings, saveSettings, type SettingsInput } from '@/db/repos';
import { syncNotificationsNow } from '@/features/notifications';
import { setLanguagePreference } from '@/i18n';
import { getColorTheme, setColorTheme, setPhaseAnchor } from '@/ui/theme';

/**
 * Postavke korisnika u memoriji, zajedničke svim ekranima (Profil, onboarding gate, tema).
 * Svako učitavanje i spremanje primijeni jezik, granice doba dana i temu boja s računa (odluka 81);
 * spremanje ponovo zakaže obavijesti.
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
    const { apply } = resolveAccountColorTheme(next.settings.colorTheme, getColorTheme());
    if (apply !== null) setColorTheme(apply);
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
    if (settings !== null) {
      // Tema birana prije sinkronizacije teme (samo na uređaju) prelazi na račun.
      const { adopt } = resolveAccountColorTheme(settings.colorTheme, getColorTheme());
      if (adopt !== null) return await updateSettings({ colorTheme: adopt });
    }
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

/**
 * Korisnikov odabir teme boja (Profil, slavlje nove razine): vrijedi odmah na uređaju i sprema se
 * u postavke, pa ga sync nosi na druge uređaje (odluka 81). Prije onboardinga samo na uređaju.
 * Greška spremanja ne vraća odabir — tema ostaje na uređaju i spremi se pri sljedećem odabiru.
 */
export function chooseColorTheme(next: ColorThemeId): void {
  setColorTheme(next);
  if (state.settings === null || state.settings.colorTheme === next) return;
  updateSettings({ colorTheme: next }).catch((error: unknown) =>
    console.error('Saving color theme to settings failed', error),
  );
}
