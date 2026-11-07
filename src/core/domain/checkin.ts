import { z } from 'zod';

import {
  baseEntityShape,
  clockTimeSchema,
  idSchema,
  localDateSchema,
  noteSchema,
  rating1to5Schema,
} from './common';

export const CHECKIN_KINDS = ['morning', 'evening'] as const;
export type CheckinKind = (typeof CHECKIN_KINDS)[number];

/** Jutarnja (san, raspoloženje) ili večernja (ocjena dana) prijava. Polja su opcionalna dok se ne ispune. */
export const checkinSchema = z.object({
  ...baseEntityShape,
  date: localDateSchema,
  kind: z.enum(CHECKIN_KINDS),
  sleepStart: clockTimeSchema.nullable(),
  wakeTime: clockTimeSchema.nullable(),
  mood: rating1to5Schema.nullable(),
  dayRating: rating1to5Schema.nullable(),
  note: noteSchema.nullable(),
});

export type Checkin = z.infer<typeof checkinSchema>;

export const CHECKIN_ITEM_KINDS = ['task', 'habit', 'rule', 'open-question'] as const;
export type CheckinItemKind = (typeof CHECKIN_ITEM_KINDS)[number];

/** Jedna stavka checkliste večernjeg upita: "U redu" (`ok`) ili "Nije" + komentar. */
export const checkinItemSchema = z.object({
  ...baseEntityShape,
  checkinId: idSchema,
  kind: z.enum(CHECKIN_ITEM_KINDS),
  /** Na što se stavka odnosi (blok, zabrana…); `null` za slobodno pitanje. */
  refId: idSchema.nullable(),
  ok: z.boolean(),
  comment: noteSchema.nullable(),
});

export type CheckinItem = z.infer<typeof checkinItemSchema>;
