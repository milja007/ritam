/**
 * Dizajn tokeni Ritma. Čisti podaci — bez React/React Native importa,
 * da ih mogu koristiti i čista logika i testovi.
 *
 * Dark-first: tamna shema je primarna (i zadana kad sustav ne javi shemu),
 * svijetla je ravnopravna alternativa za uređaje u svijetlom načinu.
 * Paleta je početni prijedlog (topli akcent prati orb-plamen) — mijenja se samo ovdje.
 */

import { type ColorThemeId, DEFAULT_COLOR_THEME, type FlamePalette, flamePalettes } from './flame';

export type ColorScheme = 'dark' | 'light';

/** Doba dana za koje postoje gradijenti. */
export type DayPhase = 'dawn' | 'day' | 'evening';

export const DAY_PHASES: readonly DayPhase[] = ['dawn', 'day', 'evening'];

/** Sirova paleta — ne koristiti izravno u UI-ju, nego preko semantičkih boja. */
export const palette = {
  ink950: '#0B0B10',
  ink900: '#12121A',
  ink850: '#191923',
  ink800: '#22222E',
  ink700: '#2E2E3C',
  ink500: '#5C5C6E',
  ink400: '#8A8A9C',
  ink300: '#A6A6B6',
  ink100: '#E6E6EE',
  ink50: '#F5F5F9',
  white: '#FFFFFF',

  // Plamen i žar zadane teme „Žar“ (svjetlina dana od tinjanja do punog sjaja). Ostale teme su u
  // `flame.ts`; UI ih čita kroz `theme.flame`, ne odavde.
  ...flamePalettes.ember,

  mint400: '#4ADE9B',
  mint700: '#127A4C',
  coral400: '#FF6B6B',
  coral700: '#B42323',
  sky400: '#5AB4FF',
  sky700: '#1A6BB8',

  // Gradijenti po dobu dana.
  dawnDark: ['#2A1B3D', '#5E3A5C', '#94505A'],
  dawnLight: ['#FFE3D3', '#FFD0C2', '#F6B8C8'],
  dayDark: ['#0F1E33', '#163A5C', '#1F5F7A'],
  dayLight: ['#DDF1FF', '#C9E8FB', '#B9E3EE'],
  eveningDark: ['#0B0B10', '#1A1433', '#2C1E4A'],
  eveningLight: ['#ECE6FF', '#DCD3F7', '#CFC4EE'],
} as const;

export type SemanticColors = {
  /** Pozadina ekrana. */
  background: string;
  /** Kartice, liste, grupe. */
  surface: string;
  /** Istaknuta površina (odabrana stavka, pritisnuto stanje). */
  surfaceRaised: string;
  border: string;
  text: string;
  textMuted: string;
  /** Glavni akcent (XP, streak, primarne akcije). */
  accent: string;
  /** Tekst/ikona na `accent` pozadini. */
  onAccent: string;
  success: string;
  danger: string;
  info: string;
};

export type Gradient = {
  /** Boje od vrha prema dnu. */
  colors: readonly string[];
  /** Kut u stupnjevima (CSS: 180deg = odozgo prema dolje). */
  angle: number;
};

export type Theme = {
  scheme: ColorScheme;
  /** Odabrana tema boja plamena (korak 38). */
  colorTheme: ColorThemeId;
  /** Boje plamena i žara odabrane teme. */
  flame: FlamePalette;
  colors: SemanticColors;
  gradients: Record<DayPhase, Gradient>;
};

const darkColors: SemanticColors = {
  background: palette.ink950,
  surface: palette.ink900,
  surfaceRaised: palette.ink800,
  border: palette.ink700,
  text: palette.white,
  textMuted: palette.ink300,
  accent: palette.flame400,
  onAccent: palette.ink950,
  success: palette.mint400,
  danger: palette.coral400,
  info: palette.sky400,
};

const lightColors: SemanticColors = {
  background: palette.white,
  surface: palette.ink50,
  surfaceRaised: palette.ink100,
  border: palette.ink100,
  text: palette.ink950,
  textMuted: palette.ink500,
  accent: palette.flame700,
  onAccent: palette.white,
  success: palette.mint700,
  danger: palette.coral700,
  info: palette.sky700,
};

const VERTICAL = 180;

export const themes: Record<ColorScheme, Theme> = {
  dark: {
    scheme: 'dark',
    colorTheme: DEFAULT_COLOR_THEME,
    flame: flamePalettes[DEFAULT_COLOR_THEME],
    colors: darkColors,
    gradients: {
      dawn: { colors: palette.dawnDark, angle: VERTICAL },
      day: { colors: palette.dayDark, angle: VERTICAL },
      evening: { colors: palette.eveningDark, angle: VERTICAL },
    },
  },
  light: {
    scheme: 'light',
    colorTheme: DEFAULT_COLOR_THEME,
    flame: flamePalettes[DEFAULT_COLOR_THEME],
    colors: lightColors,
    gradients: {
      dawn: { colors: palette.dawnLight, angle: VERTICAL },
      day: { colors: palette.dayLight, angle: VERTICAL },
      evening: { colors: palette.eveningLight, angle: VERTICAL },
    },
  },
};

/** Akcent teme plamena: svijetli plamen na tamnoj pozadini, tamni na svijetloj. */
export function accentOf(flame: FlamePalette, scheme: ColorScheme): string {
  return scheme === 'dark' ? flame.flame400 : flame.flame700;
}

/**
 * Tema za shemu i temu boja plamena. Mijenja se samo plamen (akcent, žarovi, orb); pozadine, tekst,
 * statusne boje i gradijenti doba dana su isti u svakoj temi.
 */
export function themeFor(scheme: ColorScheme, colorTheme: ColorThemeId = DEFAULT_COLOR_THEME): Theme {
  const base = themes[scheme];
  if (colorTheme === base.colorTheme) return base;
  const flame = flamePalettes[colorTheme];
  return { ...base, colorTheme, flame, colors: { ...base.colors, accent: accentOf(flame, scheme) } };
}

/** Shema kad sustav ne javi svoju (dark-first). */
export const DEFAULT_SCHEME: ColorScheme = 'dark';

/** Razmaci na 4-pt skali. */
export const spacing = {
  none: 0,
  xxs: 2,
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  xxl: 32,
  xxxl: 48,
} as const;

export const radius = {
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  pill: 999,
} as const;

export type FontWeight = '400' | '500' | '600' | '700' | '800';

export type TextStyleToken = {
  fontSize: number;
  lineHeight: number;
  fontWeight: FontWeight;
  letterSpacing?: number;
  textTransform?: 'uppercase';
};

/**
 * Tipografija: sistemski font (SF Pro / Roboto) — bez učitavanja fontova.
 * Vlastiti font se može dodati kasnije preko `fontFamily` u ovim tokenima.
 */
export const typography = {
  display: { fontSize: 34, lineHeight: 41, fontWeight: '800' },
  title: { fontSize: 28, lineHeight: 34, fontWeight: '700' },
  heading: { fontSize: 20, lineHeight: 25, fontWeight: '600' },
  body: { fontSize: 16, lineHeight: 22, fontWeight: '400' },
  bodyStrong: { fontSize: 16, lineHeight: 22, fontWeight: '600' },
  caption: { fontSize: 13, lineHeight: 18, fontWeight: '400' },
  overline: {
    fontSize: 13,
    lineHeight: 18,
    fontWeight: '600',
    letterSpacing: 0.5,
    textTransform: 'uppercase',
  },
} as const satisfies Record<string, TextStyleToken>;

export type TypographyVariant = keyof typeof typography;
