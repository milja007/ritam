import { z } from 'zod';

import { SUPPORTED_LANGUAGES } from '../i18n/language';
import { baseEntityShape, clockTimeSchema, localDateSchema } from './common';

/** Razdoblje limita potrošnje (koncept: „najviše 100 € ovaj tjedan“). */
export const MONEY_PERIODS = ['day', 'week', 'month'] as const;
export type MoneyPeriod = (typeof MONEY_PERIODS)[number];
/** Granice cilja kalorija: šire od razumnog, da upozorenje (ne zabrana) radi posao. */
export const CALORIE_GOAL_MIN = 500;
export const CALORIE_GOAL_MAX = 10_000;
/** Najveći iznos (limit, stanje, unos) u centima: 1 000 000 €. */
export const MONEY_MAX_CENTS = 100_000_000;

/** Jezik appa: 'system' prati jezik uređaja, inače ručni odabir. */
export const LANGUAGE_PREFERENCES = ['system', ...SUPPORTED_LANGUAGES] as const;

export const THEME_PREFERENCES = ['system', 'dark', 'light'] as const;
export type ThemePreference = (typeof THEME_PREFERENCES)[number];

/**
 * Područja dnevnog rezultata (odluka P39, dorađena 2026-11-10): plan je uvijek uključen i nosi
 * najviše, zabrane i san su opcionalni (zadano isključeni).
 */
export const SCORE_AREAS = ['plan', 'rules', 'sleep'] as const;
export type ScoreArea = (typeof SCORE_AREAS)[number];

/** Popis područja (npr. snimka uz večernji upit): bez ponavljanja, plan uvijek uključen. */
export const scoreAreasSchema = z
  .array(z.enum(SCORE_AREAS))
  .refine((areas) => areas.includes('plan') && new Set(areas).size === areas.length, {
    message: 'Score areas must include plan, without duplicates',
  });

/** Korisničke postavke (jedan red po korisniku). */
export const settingsSchema = z.object({
  ...baseEntityShape,
  language: z.enum(LANGUAGE_PREFERENCES),
  /** Ciljano vrijeme buđenja (radni dan). */
  wakeTime: clockTimeSchema,
  /** Vrijeme buđenja vikendom (subota i nedjelja); `null` = isto kao radnim danom. */
  weekendWakeTime: clockTimeSchema.nullable(),
  /** Ciljani sati sna (koraci od 15 min). */
  sleepHours: z
    .number()
    .min(4)
    .max(12)
    .refine((hours) => Number.isInteger(hours * 4), {
      message: 'Expected 15-minute steps',
    }),
  morningNotifTime: clockTimeSchema,
  eveningNotifTime: clockTimeSchema,
  /** Koliko minuta prije kreveta stiže wind-down obavijest. */
  windDownMinutes: z.number().int().min(0).max(180),
  /** Prekidači dnevnih obavijesti (svaka se može isključiti u Profilu). */
  morningNotifEnabled: z.boolean(),
  eveningNotifEnabled: z.boolean(),
  windDownNotifEnabled: z.boolean(),
  /** Podsjetnici na početku blokova (odluka P28: zadano uključeni, mogu se isključiti u Profilu). */
  blockRemindersEnabled: z.boolean(),
  theme: z.enum(THEME_PREFERENCES),
  /**
   * Tema boja plamena (korak 38), sinkronizirana s računom (odluka 81). `null` = još nije birana
   * na računu. Namjerno običan tekst, ne popis tema: nepoznatu temu (novija verzija appa na drugom
   * uređaju) app čita kao zadanu, a sync je ne odbija.
   */
  colorTheme: z.string().min(1).max(32).nullable().default(null),
  googleCalendarConnected: z.boolean(),
  /** Područja dnevnog rezultata: plan uvijek (`true`), zabrane i san opcionalni. */
  scorePlan: z.literal(true),
  scoreRules: z.boolean(),
  scoreSleep: z.boolean(),
  /**
   * Opcionalni trackeri (korak 31b, koncept: isključeni po defaultu, uključuju se u Profilu).
   * Kalorije: dnevni cilj u kcal (`null` dok ga korisnik ne postavi).
   */
  trackCalories: z.boolean().default(false),
  calorieGoal: z.number().int().min(CALORIE_GOAL_MIN).max(CALORIE_GOAL_MAX).nullable().default(null),
  /** Novac: limit potrošnje (u centima) za dan, tjedan ili mjesec; po želji trenutno stanje. */
  trackMoney: z.boolean().default(false),
  moneyLimitCents: z.number().int().min(1).max(MONEY_MAX_CENTS).nullable().default(null),
  moneyPeriod: z.enum(MONEY_PERIODS).nullable().default(null),
  /** Stanje na dan `moneyBalanceOn`; potrošnja od tog dana (uključivo) se oduzima. */
  moneyBalanceCents: z.number().int().min(-MONEY_MAX_CENTS).max(MONEY_MAX_CENTS).nullable().default(null),
  moneyBalanceOn: localDateSchema.nullable().default(null),
});

export type Settings = z.infer<typeof settingsSchema>;

/** Zadani trackeri (korak 31b): isključeni, bez cilja, limita i stanja. */
export const DEFAULT_TRACKERS = {
  trackCalories: false,
  calorieGoal: null,
  trackMoney: false,
  moneyLimitCents: null,
  moneyPeriod: null,
  moneyBalanceCents: null,
  moneyBalanceOn: null,
} as const satisfies Partial<Settings>;

/** Zadana područja rezultata: samo plan. */
export const DEFAULT_SCORE_AREAS = {
  scorePlan: true,
  scoreRules: false,
  scoreSleep: false,
} as const;

/** Odabrana područja rezultata iz postavki, redom `SCORE_AREAS`. */
export function selectedScoreAreas(
  settings: Pick<Settings, 'scorePlan' | 'scoreRules' | 'scoreSleep'>,
): ScoreArea[] {
  const flags: Record<ScoreArea, boolean> = {
    plan: settings.scorePlan,
    rules: settings.scoreRules,
    sleep: settings.scoreSleep,
  };
  return SCORE_AREAS.filter((area) => flags[area]);
}
