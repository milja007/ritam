import { CALORIE_ENTRY_MAX, MONEY_MAX_CENTS } from '@/core/domain';

const locale = (language: string) => (language.startsWith('en') ? 'en-IE' : 'hr-HR');

/** Iznos u centima kao euri na jeziku appa („12,50 €“ / „€12.50“). */
export function formatEuro(cents: number, language: string): string {
  return new Intl.NumberFormat(locale(language), { style: 'currency', currency: 'EUR' }).format(cents / 100);
}

/** Kalorije s razmakom tisućica na jeziku appa („2 200“). */
export function formatKcal(kcal: number, language: string): string {
  return new Intl.NumberFormat(locale(language), { maximumFractionDigits: 0 }).format(kcal);
}

/**
 * Upisani iznos u eurima → centi. Prihvaća „12“, „12,5“, „12.50“, „1 250,00“; najviše dvije
 * decimale, pozitivan i ne veći od granice. Inače `null`.
 */
export function parseEuroCents(text: string): number | null {
  const compact = text.replace(/[\s€]/g, '');
  const match = /^(\d+)(?:[.,](\d{1,2}))?$/.exec(compact);
  if (!match) return null;
  const cents = Number(match[1]) * 100 + Number((match[2] ?? '0').padEnd(2, '0'));
  return cents >= 1 && cents <= MONEY_MAX_CENTS ? cents : null;
}

/** Upisane kalorije → cijeli broj 1–10 000 („650“, „1 200“), inače `null`. */
export function parseKcal(text: string, max: number = CALORIE_ENTRY_MAX): number | null {
  const compact = text.replace(/[\s.]/g, '');
  if (!/^\d+$/.test(compact)) return null;
  const kcal = Number(compact);
  return kcal >= 1 && kcal <= max ? kcal : null;
}
