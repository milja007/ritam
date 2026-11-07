import { z } from 'zod';

import { SUPPORTED_LANGUAGES } from '../i18n/language';
import { baseEntityShape, clockTimeSchema } from './common';

export const THEME_PREFERENCES = ['system', 'dark', 'light'] as const;
export type ThemePreference = (typeof THEME_PREFERENCES)[number];

/** Korisničke postavke (jedan red po korisniku). */
export const settingsSchema = z.object({
  ...baseEntityShape,
  language: z.enum(SUPPORTED_LANGUAGES),
  /** Ciljano vrijeme buđenja. */
  wakeTime: clockTimeSchema,
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
  theme: z.enum(THEME_PREFERENCES),
  googleCalendarConnected: z.boolean(),
});

export type Settings = z.infer<typeof settingsSchema>;
