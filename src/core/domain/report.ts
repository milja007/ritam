import { z } from 'zod';

import { baseEntityShape, localDateSchema, noteSchema, timestampSchema } from './common';

export const REPORT_PERIODS = ['day', 'week', 'month', 'year'] as const;
/** Razdoblje dijagnoze: svaki dan dan; nedjeljom i tjedan; kraj mjeseca i mjesec; 31. 12. i godina. */
export type ReportPeriod = (typeof REPORT_PERIODS)[number];

/**
 * Dijagnoza razdoblja (koncept: `reports`). `sections` i `stats` su JSON — struktura ovisi o
 * verziji (`promptVersion`: lokalna pravila ili verzija LLM prompta), pa ih ovdje ne ograničavamo.
 * `suggestion` je ideja za napredak ponuđena u dijagnozi; povratna informacija Pomoglo / Nije
 * pomoglo (`helpful`, `feedbackComment`) dolazi s LLM dijagnozom.
 */
export const reportSchema = z.object({
  ...baseEntityShape,
  period: z.enum(REPORT_PERIODS),
  periodStart: localDateSchema,
  sections: z.unknown(),
  stats: z.unknown(),
  promptVersion: z.string().trim().min(1).max(64),
  suggestion: z.string().trim().min(1).max(200).nullable(),
  suggestionAccepted: z.boolean().nullable(),
  helpful: z.boolean().nullable(),
  feedbackComment: noteSchema.nullable(),
  /** Kad je dijagnoza pokupljena (otvorena na Dan); `null` = još nije viđena (korak 17d). */
  seenAt: timestampSchema.nullable().default(null),
});

export type Report = z.infer<typeof reportSchema>;
