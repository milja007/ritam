/**
 * Glasovni unos (korak 30) — čista logika, bez Reacta i bez native modula.
 *
 * Diktirani tekst se samo upisuje u polje: korisnik ga vidi, može ispraviti i tek onda
 * potvrđuje (npr. „Dodaj“ u planu → `parse-input` ili lokalno dijeljenje stavki).
 */

export type DictationLocale = 'hr-HR' | 'en-US';

/** Jezik appa (i18next, npr. `hr`, `en`, `en-GB`) → jezik prepoznavanja govora. */
export function recognitionLocale(appLanguage: string): DictationLocale {
  return appLanguage.toLowerCase().startsWith('en') ? 'en-US' : 'hr-HR';
}

/**
 * Tekst polja dok se diktira: ono što je bilo napisano prije početka + izgovoreno.
 * Izgovoreno ide u novu rečenicu (veliko slovo) ako polje završava točkom ili je prazno,
 * inače se nastavlja iza razmaka. Rezultat poštuje `maxLength` (reže na zadnjoj cijeloj riječi).
 */
export function appendDictation(base: string, transcript: string, maxLength?: number): string {
  const spoken = transcript.replace(/\s+/g, ' ').trim();
  if (spoken.length === 0) return clip(base, maxLength);
  const before = base.replace(/\s+$/, '');
  const newSentence = before.length === 0 || /[.!?]$/.test(before);
  const piece = newSentence ? capitalize(spoken) : spoken;
  const joined = before.length === 0 ? piece : `${before} ${piece}`;
  return clip(joined, maxLength);
}

function capitalize(text: string): string {
  return text.charAt(0).toLocaleUpperCase() + text.slice(1);
}

function clip(text: string, maxLength?: number): string {
  if (maxLength === undefined || text.length <= maxLength) return text;
  const cut = text.slice(0, maxLength);
  const lastSpace = cut.lastIndexOf(' ');
  // Bez razmaka (jedna duga riječ) reže se točno na granici.
  return (lastSpace > 0 ? cut.slice(0, lastSpace) : cut).trimEnd();
}

/** Što korisniku reći kad diktiranje ne uspije; `null` = ništa (korisnik je sam prekinuo). */
export type DictationProblem = 'permission' | 'unavailable' | 'noSpeech' | 'failed';

/** Kod greške prepoznavanja (Web Speech API + dodatni kodovi paketa) → poruka. */
export function dictationProblem(code: string): DictationProblem | null {
  switch (code) {
    case 'aborted':
      return null;
    case 'not-allowed':
    case 'service-not-allowed':
      return 'permission';
    case 'language-not-supported':
    case 'audio-capture':
      return 'unavailable';
    case 'no-speech':
    case 'speech-timeout':
    case 'nomatch':
      return 'noSpeech';
    default:
      return 'failed';
  }
}

/** Raspon glasnoće koji paket javlja (`volumechange`, otprilike −2 … 10). */
const VOLUME_MIN = -2;
const VOLUME_MAX = 10;

/** Glasnoća → 0–1 za sjaj mikrofona dok korisnik govori; izvan raspona ili NaN se ograniči. */
export function voiceLevel(volume: number): number {
  if (!Number.isFinite(volume)) return 0;
  const level = (volume - VOLUME_MIN) / (VOLUME_MAX - VOLUME_MIN);
  return Math.min(1, Math.max(0, level));
}
