import { and, asc, eq } from 'drizzle-orm';

import { scheduleBlockSchema, type LocalDate, type ScheduleBlock } from '@/core/domain';

import type { RitamDb } from '../db';
import { scheduleBlocks } from '../schema';
import { defaultRepoDeps, type RepoDeps } from './deps';

/** Polja bloka koja zadaje korisnik/planer (bez id-a, vlasnika i vremena). */
export type ScheduleBlockInput = Omit<ScheduleBlock, 'id' | 'userId' | 'createdAt' | 'updatedAt'>;
export type ScheduleBlockPatch = Partial<ScheduleBlockInput>;

const ownBlock = (userId: string, id: string) =>
  and(eq(scheduleBlocks.userId, userId), eq(scheduleBlocks.id, id));

/** Stvara blok. Neispravan ulaz (npr. kraj prije početka) baca `ZodError` i ništa se ne zapisuje. */
export async function createBlock(
  db: RitamDb,
  userId: string,
  input: ScheduleBlockInput,
  deps: RepoDeps = defaultRepoDeps,
): Promise<ScheduleBlock> {
  const now = deps.now().toISOString();
  const block = scheduleBlockSchema.parse({
    ...input,
    id: deps.newId(),
    userId,
    createdAt: now,
    updatedAt: now,
  });
  await db.insert(scheduleBlocks).values(block).run();
  return block;
}

export async function getBlock(
  db: RitamDb,
  userId: string,
  id: string,
): Promise<ScheduleBlock | null> {
  const row = await db.select().from(scheduleBlocks).where(ownBlock(userId, id)).get();
  return row ? scheduleBlockSchema.parse(row) : null;
}

/** Blokovi jednog dana, poredani po početku (pa po kraju). */
export async function listBlocksForDate(
  db: RitamDb,
  userId: string,
  date: LocalDate,
): Promise<ScheduleBlock[]> {
  const rows = await db
    .select()
    .from(scheduleBlocks)
    .where(and(eq(scheduleBlocks.userId, userId), eq(scheduleBlocks.date, date)))
    .orderBy(asc(scheduleBlocks.start), asc(scheduleBlocks.end))
    .all();
  return rows.map((row) => scheduleBlockSchema.parse(row));
}

/**
 * Djelomično ažurira blok i osvježava `updatedAt`. Cijeli rezultat se validira (npr. novi `end`
 * prema starom `start`). Vraća `null` ako blok ne postoji.
 */
export async function updateBlock(
  db: RitamDb,
  userId: string,
  id: string,
  patch: ScheduleBlockPatch,
  deps: RepoDeps = defaultRepoDeps,
): Promise<ScheduleBlock | null> {
  const existing = await getBlock(db, userId, id);
  if (!existing) return null;
  const definedPatch = Object.fromEntries(
    Object.entries(patch).filter(([, value]) => value !== undefined),
  );
  const next = scheduleBlockSchema.parse({
    ...existing,
    ...definedPatch,
    id: existing.id,
    userId: existing.userId,
    createdAt: existing.createdAt,
    updatedAt: deps.now().toISOString(),
  });
  const { id: _id, userId: _owner, createdAt: _created, ...changes } = next;
  await db.update(scheduleBlocks).set(changes).where(ownBlock(userId, id)).run();
  return next;
}

/** Briše blok. Vraća je li nešto obrisano. */
export async function deleteBlock(db: RitamDb, userId: string, id: string): Promise<boolean> {
  const result = await db.delete(scheduleBlocks).where(ownBlock(userId, id)).run();
  return result.changes > 0;
}
