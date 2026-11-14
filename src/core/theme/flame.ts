/**
 * Teme boja plamena (korak 38). Tema mijenja samo **ton plamena**: akcent, žarove, traku dana i
 * orb. Pozadine, tekst, statusne boje i gradijenti doba dana ostaju isti u svakoj temi.
 *
 * Svaka tema ima istih 11 boja kao zadani „Žar“, iste percipirane svjetline (OKLCH), samo drugog
 * tona — zato kontrast i poredak svjetline žarova vrijede u svakoj temi (provjeravaju testovi).
 * Čisti podaci, bez React/React Native importa.
 */

export type FlamePalette = {
  /** Svijetli plamen: odrađena točka, iskre, naglasci na tamnoj pozadini. */
  flame300: string;
  /** Glavni akcent na tamnoj shemi. */
  flame400: string;
  flame600: string;
  /** Glavni akcent na svijetloj shemi. */
  flame700: string;
  /** Žar od najsvjetlijeg (žarište) do najtamnijeg (tinjanje). */
  ember50: string;
  ember100: string;
  ember200: string;
  ember400: string;
  ember600: string;
  ember800: string;
  ember900: string;
};

/** Teme redom kojim se otključavaju; prva je zadana i uvijek dostupna. */
export const COLOR_THEMES = ['ember', 'rose', 'azure', 'aurora', 'violet'] as const;
export type ColorThemeId = (typeof COLOR_THEMES)[number];

export const DEFAULT_COLOR_THEME: ColorThemeId = 'ember';

export const flamePalettes: Readonly<Record<ColorThemeId, FlamePalette>> = {
  // Žar — topla narančasta (zadana).
  ember: {
    flame300: '#FFB86B',
    flame400: '#FF9F43',
    flame600: '#C25E00',
    flame700: '#9A4A00',
    ember50: '#FFF1DC',
    ember100: '#FFE2BD',
    ember200: '#FFC27A',
    ember400: '#E88A2E',
    ember600: '#A85A14',
    ember800: '#6B3A12',
    ember900: '#4A2A10',
  },
  // Zora — ružičasta.
  rose: {
    flame300: '#FFAEC0',
    flame400: '#FF92B7',
    flame600: '#B24F83',
    flame700: '#95426D',
    ember50: '#FFEEEF',
    ember100: '#FFDEE0',
    ember200: '#FFB9C5',
    ember400: '#EA7BA4',
    ember600: '#A65077',
    ember800: '#6A344C',
    ember900: '#4A2634',
  },
  // Modri plamen — plava.
  azure: {
    flame300: '#A0CDFF',
    flame400: '#77C0FF',
    flame600: '#0588C0',
    flame700: '#016B9A',
    ember50: '#EEF3FE',
    ember100: '#DAE8FE',
    ember200: '#B0D2FE',
    ember400: '#3FACFC',
    ember600: '#0079B4',
    ember800: '#0D4D72',
    ember900: '#11364F',
  },
  // Polarna svjetlost — zeleno-tirkizna.
  aurora: {
    flame300: '#6FE1C4',
    flame400: '#43D5A9',
    flame600: '#049662',
    flame700: '#04764E',
    ember50: '#DFFAF6',
    ember100: '#C2F3E9',
    ember200: '#7FE5CF',
    ember400: '#2ABF93',
    ember600: '#0F865F',
    ember800: '#12553C',
    ember900: '#113C2C',
  },
  // Sumrak — ljubičasta.
  violet: {
    flame300: '#D8B8FF',
    flame400: '#C4A7FF',
    flame600: '#7F6AD1',
    flame700: '#6554A6',
    ember50: '#FAEEFF',
    ember100: '#F2DFFF',
    ember200: '#E0BFFF',
    ember400: '#B08DF6',
    ember600: '#7661B4',
    ember800: '#4B3E72',
    ember900: '#352C4F',
  },
};

export function isColorThemeId(value: unknown): value is ColorThemeId {
  return typeof value === 'string' && (COLOR_THEMES as readonly string[]).includes(value);
}

/** Spremljena vrijednost → tema; nepoznato ili prazno je zadana tema. */
export function colorThemeOr(value: unknown): ColorThemeId {
  return isColorThemeId(value) ? value : DEFAULT_COLOR_THEME;
}
