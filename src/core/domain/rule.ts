import { z } from 'zod';

import {
  baseEntityShape,
  clockTimeSchema,
  idSchema,
  localDateSchema,
  noteSchema,
  weekdaySchema,
} from './common';

export const RULE_WEIGHTS = [1, 2, 3] as const;
export type RuleWeight = (typeof RULE_WEIGHTS)[number];

/** Interval sati kad zabrana vrijedi; smije prijeći ponoć (npr. 22:00–02:00). */
export const activeHoursSchema = z
  .object({ start: clockTimeSchema, end: clockTimeSchema })
  .refine((hours) => hours.start !== hours.end, {
    message: 'Active hours must not be empty',
    path: ['end'],
  });

export type ActiveHours = z.infer<typeof activeHoursSchema>;

/** Zabrana ("rule"): naziv, kad vrijedi, razlog, težina 1–3. */
export const ruleSchema = z.object({
  ...baseEntityShape,
  title: z.string().trim().min(1).max(120),
  /** Ime ikone (iz skupa ikona appa); `null` = zadana. */
  icon: z.string().trim().min(1).max(64).nullable(),
  /** Dani kad vrijedi (0 = nedjelja … 6 = subota), barem jedan, bez ponavljanja. */
  activeDays: z
    .array(weekdaySchema)
    .min(1)
    .refine((days) => new Set(days).size === days.length, { message: 'Duplicate weekday' }),
  /** `null` = cijeli dan. */
  activeHours: activeHoursSchema.nullable(),
  /** Zašto — korisnik to vidi kad je u iskušenju. */
  why: noteSchema,
  weight: z.literal(RULE_WEIGHTS),
});

export type Rule = z.infer<typeof ruleSchema>;

/** Dnevni zapis zabrane iz večernjeg upita: "Držao sam se" / "Prekršio sam" (+ okidač). Izvor streakova po zabrani. */
export const ruleLogSchema = z
  .object({
    ...baseEntityShape,
    ruleId: idSchema,
    date: localDateSchema,
    kept: z.boolean(),
    /** Okidač prekršaja; samo kad `kept` = false. */
    trigger: noteSchema.nullable(),
    checkinId: idSchema.nullable(),
  })
  .refine((log) => !(log.kept && log.trigger !== null), {
    message: 'Trigger is only recorded for a broken rule',
    path: ['trigger'],
  });

export type RuleLog = z.infer<typeof ruleLogSchema>;
