import * as Linking from 'expo-linking';

import { AUTH_CALLBACK_PATH, normalizeEmail, normalizeEmailCode, parseAuthCallback } from '@/core/auth';

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
 * Obradi povratni link: zamijeni PKCE kod za sesiju. Linkovi s gotovim tokenima se odbijaju
 * (nalaz P0 audita) — sesiju nikad ne postavljamo iz tokena koje je netko drugi mogao složiti.
 * `null` znači da URL nije naš povratni link prijave.
 */
export async function completeSignInFromUrl(url: string): Promise<AuthResult | null> {
  const parsed = parseAuthCallback(url, authRedirectUrl());
  if (parsed.kind === 'none') return null;
  if (parsed.kind === 'error') return { ok: false, message: parsed.message };
  if (parsed.kind === 'rejected') return { ok: false, message: `Sign-in link rejected (${parsed.reason})` };

  const supabase = getSupabase();
  if (!supabase) return disabled();

  const { error } = await supabase.auth.exchangeCodeForSession(parsed.code);
  return error ? { ok: false, message: error.message } : { ok: true };
}

/** Prijava kodom s maila (radi i kad je mail otvoren na drugom uređaju). */
export async function verifyEmailCode(email: string, code: string): Promise<AuthResult> {
  const supabase = getSupabase();
  if (!supabase) return disabled();
  const { error } = await supabase.auth.verifyOtp({
    email: normalizeEmail(email),
    token: normalizeEmailCode(code),
    type: 'email',
  });
  return error ? { ok: false, message: error.message } : { ok: true };
}

export async function signOut(): Promise<AuthResult> {
  const supabase = getSupabase();
  if (!supabase) return disabled();
  const { error } = await supabase.auth.signOut();
  return error ? { ok: false, message: error.message } : { ok: true };
}
