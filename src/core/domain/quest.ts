import { z } from 'zod';

import { baseEntityShape, idSchema, localDateSchema, noteSchema } from './common';

/** Stanje epskog questa: u tijeku, ostvaren ili spremljen sa strane (arhiva). */
export const QUEST_STATUSES = ['active', 'done', 'archived'] as const;
export type QuestStatus = (typeof QUEST_STATUSES)[number];

/** Najviše koraka (etapa) po questu — quest je dugoročan, ali pregledan. */
export const MAX_QUEST_MILESTONES = 12;

/** Etapa epskog questa: naslov i dan kad je ostvarena (`null` = još nije). */
export const questMilestoneSchema = z.object({
  id: idSchema,
  title: z.string().trim().min(1).max(120),
  doneOn: localDateSchema.nullable(),
});

export type QuestMilestone = z.infer<typeof questMilestoneSchema>;

/**
 * Epski quest (korak 34): dugoročni cilj koji korisnik sam postavi u Profilu (koncept: samo epski,
 * bez dnevnih/tjednih). Etape su u retku (JSON), da se quest sinkronizira kao cjelina.
 */
export const questSchema = z
  .object({
    ...baseEntityShape,
    title: z.string().trim().min(1).max(120),
    /** Zašto je važan — korisnik to vidi uz quest. Prazno = bez razloga. */
    why: noteSchema,
    /** Okvirni rok; `null` = bez roka. */
    targetDate: localDateSchema.nullable(),
    milestones: z
      .array(questMilestoneSchema)
      .max(MAX_QUEST_MILESTONES)
      .refine((items) => new Set(items.map((item) => item.id)).size === items.length, {
        message: 'Duplicate milestone id',
      }),
    status: z.enum(QUEST_STATUSES),
    /** Dan kad je quest ostvaren: obavezan kad je `done`, nema ga u tijeku; arhiva ga čuva ako ga je imao. */
    doneOn: localDateSchema.nullable(),
  })
  .refine(
    (quest) =>
      (quest.status !== 'done' || quest.doneOn !== null) && (quest.status !== 'active' || quest.doneOn === null),
    { message: 'doneOn is required for a done quest and absent for an active one', path: ['doneOn'] },
  );

export type Quest = z.infer<typeof questSchema>;
