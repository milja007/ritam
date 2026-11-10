import { z } from 'zod';

import {
  baseEntityShape,
  clockTimeSchema,
  idSchema,
  localDateSchema,
  noteSchema,
  rating1to5Schema,
} from './common';
import { scoreAreasSchema } from './settings';

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
  /**
   * Večernji upit: područja rezultata koja su vrijedila kad je dan zaključen (odluka P48 — prošli
   * dani zadrže staro bodovanje). `null` = jutarnja prijava ili upit prije koraka 16c.
   */
  scoreAreas: scoreAreasSchema.nullable().default(null),
});

export type Checkin = z.infer<typeof checkinSchema>;

export const CHECKIN_ITEM_KINDS = ['task', 'habit', 'rule', 'open-question'] as const;
export type CheckinItemKind = (typeof CHECKIN_ITEM_KINDS)[number];

export const CHECKIN_OUTCOMES = ['ok', 'partial', 'not'] as const;
/** Odgovor na stavku checkliste: U redu / Djelomično / Nije. */
export type CheckinOutcome = (typeof CHECKIN_OUTCOMES)[number];

/**
 * Jedna stavka checkliste večernjeg upita: "U redu", "Djelomično" ili "Nije" + komentar
 * i "kad kasnije?" (premještanje na drugi dan). `ok` je `true` samo za "U redu".
 */
export const checkinItemSchema = z
  .object({
    ...baseEntityShape,
    checkinId: idSchema,
    kind: z.enum(CHECKIN_ITEM_KINDS),
    /** Na što se stavka odnosi (blok, zabrana…); `null` za slobodno pitanje. */
    refId: idSchema.nullable(),
    ok: z.boolean(),
    outcome: z.enum(CHECKIN_OUTCOMES),
    comment: noteSchema.nullable(),
    /** Dan na koji je ostatak premješten ("kad kasnije?"); `null` = nije premješteno / preskoči. */
    laterDate: localDateSchema.nullable(),
    /** Blok stvoren premještanjem (da ga ponovno spremanje upita ne duplicira). */
    movedBlockId: idSchema.nullable(),
  })
  .refine((item) => item.ok === (item.outcome === 'ok'), {
    path: ['ok'],
    message: '`ok` must match `outcome`',
  })
  .refine((item) => item.outcome !== 'ok' || item.laterDate === null, {
    path: ['laterDate'],
    message: 'Only partial or missed items can be moved',
  });

export type CheckinItem = z.infer<typeof checkinItemSchema>;
