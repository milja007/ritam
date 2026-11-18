import { and, asc, eq, gte, lte } from 'drizzle-orm';

import { trackerEntrySchema, type TrackerEntry, type TrackerKind } from '@/core/domain';

import type { RitamDb } from '../db';
import { trackerEntries } from '../schema';
import { defaultRepoDeps, type RepoDeps } from './deps';

export type TrackerEntryInput = { date: string; kind: TrackerKind; amount: number; note: string };

/** Unosi trackera korisnika za dane `from`–`to` (uključivo), redom dana pa unosa. */
export function listTrackerEntries(db: RitamDb, userId: string, from: string, to: string): TrackerEntry[] {
  return db
    .select()
    .from(trackerEntries)
    .where(and(eq(trackerEntries.userId, userId), gte(trackerEntries.date, from), lte(trackerEntries.date, to)))
    .orderBy(asc(trackerEntries.date), asc(trackerEntries.createdAt), asc(trackerEntries.id))
    .all()
    .map((row) => trackerEntrySchema.parse(row));
}

/**
 * Novi unos (obrok/kcal ili potrošnja s bilješkom). Neispravan ulaz (iznos 0 ili prevelik,
 * predugačka bilješka, krivi datum) baca `ZodError` i ništa se ne zapisuje.
 */
export function addTrackerEntry(
  db: RitamDb,
  userId: string,
  input: TrackerEntryInput,
  deps: RepoDeps = defaultRepoDeps,
): TrackerEntry {
  const now = deps.now().toISOString();
  const entry = trackerEntrySchema.parse({ ...input, id: deps.newId(), userId, createdAt: now, updatedAt: now });
  db.insert(trackerEntries).values(entry).run();
  return entry;
}

/** Ukloni vlastiti unos; vraća je li nešto uklonjeno. */
export function deleteTrackerEntry(db: RitamDb, userId: string, id: string): boolean {
  const result = db
    .delete(trackerEntries)
    .where(and(eq(trackerEntries.id, id), eq(trackerEntries.userId, userId)))
    .run();
  return result.changes > 0;
}
