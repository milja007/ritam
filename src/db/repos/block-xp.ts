import { and, eq } from 'drizzle-orm';

import { taskXpForBlock } from '@/core/checkin';
import { xpEventSchema, type ScheduleBlock, type XpEvent } from '@/core/domain';

import type { RitamDb } from '../db';
import { xpEvents } from '../schema';
import type { RepoDeps } from './deps';

/** Transakcija nad bazom appa (isti query builder kao `RitamDb`, sinkroni driver). */
export type RitamTx = Parameters<Parameters<RitamDb['transaction']>[0]>[0];

/**
 * Uskladi XP zadatka jednog bloka s njegovim statusom: obriše postojeći XP zadatka tog bloka
 * i upiše ispravan (`taskXpForBlock`). Zove se unutar transakcije pri svakoj promjeni statusa
 * (kvačica na timelineu, večernji upit), pa je XP za blok uvijek točno jedan — nikad dupliciran.
 * Napomena: `source = 'task'` + `sourceId = blok` je rezerviran za XP izvršenja bloka.
 */
export function syncBlockTaskXp(
  tx: RitamTx,
  block: Pick<ScheduleBlock, 'id' | 'userId' | 'date' | 'kind' | 'status'>,
  deps: RepoDeps,
): XpEvent | null {
  tx.delete(xpEvents)
    .where(
      and(eq(xpEvents.userId, block.userId), eq(xpEvents.source, 'task'), eq(xpEvents.sourceId, block.id)),
    )
    .run();
  const award = taskXpForBlock(block);
  if (!award) return null;
  const now = deps.now().toISOString();
  const event = xpEventSchema.parse({
    id: deps.newId(),
    userId: block.userId,
    createdAt: now,
    updatedAt: now,
    date: block.date,
    source: award.source,
    sourceId: block.id,
    amount: award.amount,
  });
  tx.insert(xpEvents).values(event).run();
  return event;
}

/** Briše XP zadatka bloka (npr. kad se blok obriše). */
export function deleteBlockTaskXp(tx: RitamTx, userId: string, blockId: string): void {
  tx.delete(xpEvents)
    .where(and(eq(xpEvents.userId, userId), eq(xpEvents.source, 'task'), eq(xpEvents.sourceId, blockId)))
    .run();
}
