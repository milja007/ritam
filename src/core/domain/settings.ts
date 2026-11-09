import { z } from 'zod';

import { SUPPORTED_LANGUAGES } from '../i18n/language';
import { baseEntityShape, clockTimeSchema } from './common';

/** Jezik appa: 'system' prati jezik uređaja, inače ručni odabir. */
export const LANGUAGE_PREFERENCES = ['system', ...SUPPORTED_LANGUAGES] as const;

export const THEME_PREFERENCES = ['system', 'dark', 'light'] as const;
export type ThemePreference = (typeof THEME_PREFERENCES)[number];

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
    .refine((hours) => Number.isInteger(hours * 4), { message: 'Expected 15-minute steps' }),
  morningNotifTime: clockTimeSchema,
  eveningNotifTime: clockTimeSchema,
  /** Koliko minuta prije kreveta stiže wind-down obavijest. */
  windDownMinutes: z.number().int().min(0).max(180),
  /** Prekidači dnevnih obavijesti (svaka se može isključiti u Profilu). */
  morningNotifEnabled: z.boolean(),
  eveningNotifEnabled: z.boolean(),
  windDownNotifEnabled: z.boolean(),
  theme: z.enum(THEME_PREFERENCES),
  googleCalendarConnected: z.boolean(),
});

export type Settings = z.infer<typeof settingsSchema>;
