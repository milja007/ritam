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
