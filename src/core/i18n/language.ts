// Čista logika odabira jezika — bez React/Expo importa, da se može testirati.

export const SUPPORTED_LANGUAGES = ['hr', 'en'] as const;

export type Language = (typeof SUPPORTED_LANGUAGES)[number];

/** 'system' = prati jezik uređaja; inače ručni odabir korisnika. */
export type LanguagePreference = 'system' | Language;

export const FALLBACK_LANGUAGE: Language = 'en';

export function isLanguage(value: string): value is Language {
  return (SUPPORTED_LANGUAGES as readonly string[]).includes(value);
}

/**
 * Iz oznake jezika uređaja ("hr", "hr-HR", "en_US", "HR") izvlači podržani jezik
 * ili `null` ako jezik nije podržan.
 */
export function toSupportedLanguage(tag: string | null | undefined): Language | null {
  if (!tag) return null;
  const base = tag.trim().toLowerCase().split(/[-_]/)[0] ?? '';
  return isLanguage(base) ? base : null;
}

/**
 * Konačni jezik appa: ručna preferencija pobjeđuje; za 'system' uzima prvi
 * podržani jezik s popisa uređaja (redoslijed = prioritet korisnika), inače fallback.
 */
export function resolveLanguage(
  preference: LanguagePreference,
  deviceLanguageTags: readonly (string | null | undefined)[],
): Language {
  if (preference !== 'system') return preference;
  for (const tag of deviceLanguageTags) {
    const language = toSupportedLanguage(tag);
    if (language) return language;
  }
  return FALLBACK_LANGUAGE;
}
