import { z } from 'zod';

import { parseClock } from '../time/clock';
import { baseEntityShape, clockTimeSchema, idSchema, localDateSchema, noteSchema } from './common';

export const BLOCK_KINDS = ['task', 'fixed', 'calendar', 'sleep', 'unexpected'] as const;
export type BlockKind = (typeof BLOCK_KINDS)[number];

export const BLOCK_SOURCES = ['user', 'llm', 'calendar'] as const;
export type BlockSource = (typeof BLOCK_SOURCES)[number];

export const BLOCK_STATUSES = ['planned', 'done', 'partial', 'skipped', 'moved'] as const;
export type BlockStatus = (typeof BLOCK_STATUSES)[number];

/** Blok na timelineu dana. `start`/`end` su "HH:MM" na dan `date`. */
export const scheduleBlockSchema = z
  .object({
    ...baseEntityShape,
    date: localDateSchema,
    /** Naziv za prikaz (blok bez zadatka — npr. fiksna obaveza ili san — inače nema imena). */
    title: z.string().trim().min(1).max(200),
    start: clockTimeSchema,
    end: clockTimeSchema,
    taskId: idSchema.nullable(),
    kind: z.enum(BLOCK_KINDS),
    source: z.enum(BLOCK_SOURCES),
    status: z.enum(BLOCK_STATUSES),
    /** Komentar (= bilješka) na aktivnosti — samo trenutna i prošle (korak 17c). */
    note: noteSchema.nullable().default(null),
  })
  .superRefine((block, ctx) => {
    const start = parseClock(block.start);
    const end = parseClock(block.end);
    if (start === null || end === null) return; // već prijavljeno na poljima
    // San smije prijeći ponoć (23:00–07:00); ostali blokovi moraju završiti nakon početka.
    const ok = block.kind === 'sleep' ? end !== start : end > start;
    if (!ok) {
      ctx.addIssue({
        code: 'custom',
        path: ['end'],
        message: 'Block must end after it starts',
      });
    }
  });

export type ScheduleBlock = z.infer<typeof scheduleBlockSchema>;
