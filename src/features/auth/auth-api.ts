import * as Linking from 'expo-linking';

import { AUTH_CALLBACK_PATH, normalizeEmail, parseAuthCallback } from '@/core/auth';

import { getSupabase } from './supabase';

export type AuthResult = { ok: true } | { ok: false; message: string };

function disabled(): AuthResult {
  return { ok: false, message: 'Cloud auth is disabled' };
}

/** Povratni link za magic link (`ritam://auth/callback`; u Expo Go `exp://…/--/auth/callback`). */
export function authRedirectUrl(): string {
  return Linking.createURL(AUTH_CALLBACK_PATH);
}

/** Pošalji magic link na e-mail. Novi korisnik se stvara automatski. */
export async function sendMagicLink(email: string): Promise<AuthResult> {
  const supabase = getSupabase();
  if (!supabase) return disabled();
  const { error } = await supabase.auth.signInWithOtp({
    email: normalizeEmail(email),
    options: { emailRedirectTo: authRedirectUrl(), shouldCreateUser: true },
  });
  return error ? { ok: false, message: error.message } : { ok: true };
}

/**
 * Obradi povratni link: postavi sesiju (implicit tokeni) ili zamijeni PKCE kod.
 * `null` znači da URL nije povratni link prijave.
 */
export async function completeSignInFromUrl(url: string): Promise<AuthResult | null> {
  const parsed = parseAuthCallback(url);
  if (parsed.kind === 'none') return null;
  if (parsed.kind === 'error') return { ok: false, message: parsed.message };

  const supabase = getSupabase();
  if (!supabase) return disabled();

  const { error } =
    parsed.kind === 'tokens'
      ? await supabase.auth.setSession({
          access_token: parsed.accessToken,
          refresh_token: parsed.refreshToken,
        })
      : await supabase.auth.exchangeCodeForSession(parsed.code);
  return error ? { ok: false, message: error.message } : { ok: true };
}

export async function signOut(): Promise<AuthResult> {
  const supabase = getSupabase();
  if (!supabase) return disabled();
  const { error } = await supabase.auth.signOut();
  return error ? { ok: false, message: error.message } : { ok: true };
}
