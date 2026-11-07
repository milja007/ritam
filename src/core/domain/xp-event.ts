import { z } from 'zod';

import { baseEntityShape, idSchema, localDateSchema } from './common';

export const XP_SOURCES = ['task', 'rule', 'sleep', 'quest', 'checkin'] as const;
export type XpSource = (typeof XP_SOURCES)[number];

/** Dodjela XP-a. Koncept: XP po akcijama, bez kazni — iznos je uvijek pozitivan. */
export const xpEventSchema = z.object({
  ...baseEntityShape,
  date: localDateSchema,
  source: z.enum(XP_SOURCES),
  sourceId: idSchema.nullable(),
  amount: z.number().int().positive().max(10_000),
});

export type XpEvent = z.infer<typeof xpEventSchema>;
