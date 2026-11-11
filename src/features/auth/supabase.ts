import 'expo-sqlite/localStorage/install';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { AppState } from 'react-native';

import { cloudConfig } from './cloud-config';

let client: SupabaseClient | null = null;

/**
 * Supabase klijent — stvara se lijeno i samo kad je auth uključen (feature flag + URL + ključ).
 * Bez toga vraća `null` i app radi čisto lokalno. Sesija se čuva u `expo-sqlite` localStorageu
 * (Expo vodič za SDK 58), pa prijava preživi ponovno pokretanje.
 */
export function getSupabase(): SupabaseClient | null {
  if (!cloudConfig.enabled) return null;
  if (client) return client;

  const created = createClient(cloudConfig.url, cloudConfig.key, {
    auth: {
      storage: globalThis.localStorage,
      autoRefreshToken: true,
      persistSession: true,
      detectSessionInUrl: false,
      flowType: 'pkce',
    },
  });

  // Osvježavanje tokena samo dok je app u prvom planu (preporuka Supabase / Expo).
  AppState.addEventListener('change', (state) => {
    if (state === 'active') void created.auth.startAutoRefresh();
    else void created.auth.stopAutoRefresh();
  });
  if (AppState.currentState === 'active') void created.auth.startAutoRefresh();

  client = created;
  return created;
}
