import { and, asc, eq } from "drizzle-orm";

import {
  scheduleBlockSchema,
  type BlockStatus,
  type LocalDate,
  type ScheduleBlock,
} from "@/core/domain";

import type { RitamDb } from "../db";
import { scheduleBlocks } from "../schema";
import { deleteBlockTaskXp, syncBlockTaskXp } from "./block-xp";
import { defaultRepoDeps, type RepoDeps } from "./deps";

/** Polja bloka koja zadaje korisnik/planer (bez id-a, vlasnika i vremena). */
export type ScheduleBlockInput = Omit<
  ScheduleBlock,
  "id" | "userId" | "createdAt" | "updatedAt"
>;
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

/**
 * Stvara više blokova odjednom (npr. sutrašnji plan iz večernjeg upita) u jednoj sinkronoj
 * transakciji: ako je ijedan ulaz neispravan, baca `ZodError` i ništa se ne zapisuje.
 */
export function createBlocks(
  db: RitamDb,
  userId: string,
  inputs: readonly ScheduleBlockInput[],
  deps: RepoDeps = defaultRepoDeps,
): ScheduleBlock[] {
  const now = deps.now().toISOString();
  const blocks = inputs.map((input) =>
    scheduleBlockSchema.parse({
      ...input,
      id: deps.newId(),
      userId,
      createdAt: now,
      updatedAt: now,
    }),
  );
  if (blocks.length === 0) return [];
  // Drizzle expo-sqlite driver je sinkron: callback transakcije mora biti sinkron.
  db.transaction((tx) => {
    for (const block of blocks) tx.insert(scheduleBlocks).values(block).run();
  });
  return blocks;
}

export async function getBlock(
  db: RitamDb,
  userId: string,
  id: string,
): Promise<ScheduleBlock | null> {
  const row = await db
    .select()
    .from(scheduleBlocks)
    .where(ownBlock(userId, id))
    .get();
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
    .where(
      and(eq(scheduleBlocks.userId, userId), eq(scheduleBlocks.date, date)),
    )
    .orderBy(asc(scheduleBlocks.start), asc(scheduleBlocks.end))
    .all();
  return rows.map((row) => scheduleBlockSchema.parse(row));
}

/**
 * Djelomično ažurira blok i osvježava `updatedAt`. Cijeli rezultat se validira (npr. novi `end`
 * prema starom `start`). Promjena statusa ili vrste usklađuje XP zadatka u istoj transakciji.
 * Vraća `null` ako blok ne postoji.
 */
export async function updateBlock(
  db: RitamDb,
  userId: string,
  id: string,
  patch: ScheduleBlockPatch,
  deps: RepoDeps = defaultRepoDeps,
): Promise<ScheduleBlock | null> {
  const definedPatch = Object.fromEntries(
    Object.entries(patch).filter(([, value]) => value !== undefined),
  );
  return db.transaction((tx) => {
    const row = tx
      .select()
      .from(scheduleBlocks)
      .where(ownBlock(userId, id))
      .get();
    if (!row) return null;
    const existing = scheduleBlockSchema.parse(row);
    const next = scheduleBlockSchema.parse({
      ...existing,
      ...definedPatch,
      id: existing.id,
      userId: existing.userId,
      createdAt: existing.createdAt,
      updatedAt: deps.now().toISOString(),
    });
    const { id: _id, userId: _owner, createdAt: _created, ...changes } = next;
    tx.update(scheduleBlocks).set(changes).where(ownBlock(userId, id)).run();
    if (
      next.status !== existing.status ||
      next.kind !== existing.kind ||
      next.date !== existing.date
    ) {
      syncBlockTaskXp(tx, next, deps);
    }
    return next;
  });
}

/**
 * Mijenja status bloka i u istoj transakciji usklađuje XP zadatka (kvačica Gotovo na timelineu
 * daje XP odmah; vraćanje kvačice ga uklanja). Vraća `null` ako blok ne postoji.
 */
export function setBlockStatus(
  db: RitamDb,
  userId: string,
  id: string,
  status: BlockStatus,
  deps: RepoDeps = defaultRepoDeps,
): ScheduleBlock | null {
  // Drizzle expo-sqlite driver je sinkron: callback transakcije mora biti sinkron.
  return db.transaction((tx) => {
    const row = tx
      .select()
      .from(scheduleBlocks)
      .where(ownBlock(userId, id))
      .get();
    if (!row) return null;
    const next = scheduleBlockSchema.parse({
      ...row,
      status,
      updatedAt: deps.now().toISOString(),
    });
    tx.update(scheduleBlocks)
      .set({ status: next.status, updatedAt: next.updatedAt })
      .where(ownBlock(userId, id))
      .run();
    syncBlockTaskXp(tx, next, deps);
    return next;
  });
}

/** Briše blok i XP njegova izvršenja. Vraća je li nešto obrisano. */
export function deleteBlock(db: RitamDb, userId: string, id: string): boolean {
  return db.transaction((tx) => {
    deleteBlockTaskXp(tx, userId, id);
    const result = tx.delete(scheduleBlocks).where(ownBlock(userId, id)).run();
    return result.changes > 0;
  });
}
