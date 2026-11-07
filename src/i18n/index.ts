import { getLocales } from 'expo-localization';
import { createInstance } from 'i18next';
import { initReactI18next } from 'react-i18next';

import {
  FALLBACK_LANGUAGE,
  type Language,
  type LanguagePreference,
  resolveLanguage,
  SUPPORTED_LANGUAGES,
} from '@/core/i18n/language';

import en from './en.json';
import hr from './hr.json';

export const resources = {
  hr: { translation: hr },
  en: { translation: en },
} as const;

// Preferencija živi samo u memoriji dok ne postoji settings tablica (korak 6/8).
let preference: LanguagePreference = 'system';

function deviceLanguageTags(): string[] {
  return getLocales().map((locale) => locale.languageTag);
}

// Vlastita instanca (ne globalni default); initReactI18next je veže za useTranslation.
const i18n = createInstance();

void i18n.use(initReactI18next).init({
  resources,
  lng: resolveLanguage(preference, deviceLanguageTags()),
  fallbackLng: FALLBACK_LANGUAGE,
  supportedLngs: SUPPORTED_LANGUAGES,
  // Resursi su lokalni, pa init može biti sinkron — nema treptaja bez prijevoda.
  initAsync: false,
  interpolation: { escapeValue: false }, // React već escapea
  returnNull: false,
});

export function getLanguagePreference(): LanguagePreference {
  return preference;
}

/** Postavlja preferenciju i primjenjuje jezik. Vraća jezik koji je aktivan. */
export function setLanguagePreference(next: LanguagePreference): Language {
  preference = next;
  const language = resolveLanguage(next, deviceLanguageTags());
  if (i18n.language !== language) void i18n.changeLanguage(language);
  return language;
}

export default i18n;
