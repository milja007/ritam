import { eq } from 'drizzle-orm';

import { settingsSchema, type Settings } from '@/core/domain';

import type { RitamDb } from '../db';
import { settings } from '../schema';
import { defaultRepoDeps, type RepoDeps } from './deps';

/** Polja postavki koja korisnik zadaje (bez id-a i vremena). */
export type SettingsInput = Omit<Settings, 'id' | 'userId' | 'createdAt' | 'updatedAt'>;

/** Postavke korisnika ili `null` ako još nisu spremljene (prije onboardinga). */
export async function getSettings(db: RitamDb, userId: string): Promise<Settings | null> {
  const row = await db.select().from(settings).where(eq(settings.userId, userId)).get();
  return row ? settingsSchema.parse(row) : null;
}

/**
 * Sprema postavke (prvi put stvara red, kasnije ga ažurira). Ulaz se validira Zodom prije pisanja —
 * neispravan ulaz baca `ZodError` i ništa se ne zapisuje.
 */
export async function saveSettings(
  db: RitamDb,
  userId: string,
  input: SettingsInput,
  deps: RepoDeps = defaultRepoDeps,
): Promise<Settings> {
  const now = deps.now().toISOString();
  const existing = await getSettings(db, userId);
  const next = settingsSchema.parse({
    ...input,
    id: existing?.id ?? deps.newId(),
    userId,
    createdAt: existing?.createdAt ?? now,
    updatedAt: now,
  });
  if (existing) {
    const { id, userId: _owner, createdAt, ...changes } = next;
    await db.update(settings).set(changes).where(eq(settings.id, id)).run();
  } else {
    await db.insert(settings).values(next).run();
  }
  return next;
}

/** Briše postavke korisnika. Vraća je li nešto obrisano. */
export async function deleteSettings(db: RitamDb, userId: string): Promise<boolean> {
  const result = await db.delete(settings).where(eq(settings.userId, userId)).run();
  return result.changes > 0;
}
