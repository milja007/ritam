import { z } from 'zod';

import {
  baseEntityShape,
  isValidLocalDate,
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

/** Razdoblje plana kojem zabrana pripada (koncept: zabrane se postavljaju unutar planova). */
export const RULE_PERIODS = ['week', 'month', 'year'] as const;
export type RulePeriod = (typeof RULE_PERIODS)[number];

/** Najviše zabrana po jednom razdoblju — manje je više (nije u konceptu, jedna konstanta). */
export const MAX_RULES_PER_PERIOD = 5;

/** Je li `start` prvi dan razdoblja (tjedan → ponedjeljak, mjesec → 1., godina → 1. 1.). */
export function isRulePeriodStart(period: RulePeriod, start: string): boolean {
  if (!isValidLocalDate(start)) return false;
  if (period === 'year') return start.endsWith('-01-01');
  if (period === 'month') return start.endsWith('-01');
  const [y, m, d] = start.split('-').map(Number);
  return new Date(Date.UTC(y ?? 0, (m ?? 1) - 1, d ?? 1)).getUTCDay() === 1;
}

/**
 * Zabrana ("rule"): naziv, kad vrijedi, razlog, težina 1–3. Pripada tjednom, mjesečnom ili
 * godišnjem planu (`period` + `periodStart`) ili je stalna (oba `null`, npr. iz onboardinga).
 */
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
  /** Razdoblje plana; `null` = stalna zabrana. */
  period: z.enum(RULE_PERIODS).nullable(),
  /** Prvi dan razdoblja ("YYYY-MM-DD"); `null` točno kad je `period` `null`. */
  periodStart: localDateSchema.nullable(),
}).refine(
  (rule) =>
    rule.period === null
      ? rule.periodStart === null
      : rule.periodStart !== null && isRulePeriodStart(rule.period, rule.periodStart),
  { message: 'periodStart must be the first day of its period (or both null)', path: ['periodStart'] },
);

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
