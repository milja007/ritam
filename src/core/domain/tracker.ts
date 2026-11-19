import { z } from 'zod';

import { baseEntityShape, localDateSchema } from './common';
import { MONEY_MAX_CENTS } from './settings';

/** Vrsta unosa trackera: kalorije i potrošnja (korak 31b), prihod (korak 31f). */
export const TRACKER_KINDS = ['calories', 'money', 'income'] as const;
export type TrackerKind = (typeof TRACKER_KINDS)[number];

/** Najviše kcal u jednom unosu (obrok ili zbroj dana). */
export const CALORIE_ENTRY_MAX = 10_000;
export const TRACKER_NOTE_MAX = 200;

/**
 * Jedan unos trackera: obrok ili zbroj kalorija (kcal), potrošnja ili prihod (iznos u centima,
 * uvijek pozitivan) s bilješkom. Dan je dan na koji se unos računa.
 */
export const trackerEntrySchema = z
  .object({
    ...baseEntityShape,
    date: localDateSchema,
    kind: z.enum(TRACKER_KINDS),
    amount: z.number().int().min(1),
    note: z.string().trim().max(TRACKER_NOTE_MAX),
  })
  .superRefine((entry, ctx) => {
    const max = entry.kind === 'calories' ? CALORIE_ENTRY_MAX : MONEY_MAX_CENTS;
    if (entry.amount > max) {
      ctx.addIssue({ code: 'custom', path: ['amount'], message: `amount must be at most ${max}` });
    }
  });

export type TrackerEntry = z.infer<typeof trackerEntrySchema>;
