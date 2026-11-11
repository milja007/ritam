/** E-mail za magic link: obrezan i malim slovima. */
export function normalizeEmail(input: string): string {
  return input.trim().toLowerCase();
}

/** Namjerno jednostavna provjera — pravu provjeru radi poslani link. */
export function isValidEmail(input: string): boolean {
  const email = normalizeEmail(input);
  if (email.length > 254) return false;
  return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email);
}

/** Kod s maila (Supabase OTP): samo znamenke, razmaci/crtice se uklanjaju. */
export function normalizeEmailCode(input: string): string {
  return input.replace(/[\s-]/g, '');
}

/** Supabase šalje 6–10 znamenki (zadano 6). */
export function isValidEmailCode(input: string): boolean {
  return /^\d{6,10}$/.test(normalizeEmailCode(input));
}
