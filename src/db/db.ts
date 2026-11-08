/**
 * Stvaranje Drizzle instance nad expo-sqlite klijentom. Bez otvaranja datoteke — to radi `open.ts`,
 * pa se ovaj modul (i repoi) mogu testirati u Nodeu s drugim klijentom.
 */
import { drizzle, type ExpoSQLiteDatabase } from 'drizzle-orm/expo-sqlite';
import type { SQLiteDatabase } from 'expo-sqlite';

import * as schema from './schema';

export type RitamDb = ExpoSQLiteDatabase<typeof schema>;

export function createDb(client: SQLiteDatabase): RitamDb {
  // Strani ključevi u SQLite-u su po konekciji isključeni — uključiti pri svakom otvaranju.
  client.execSync('PRAGMA foreign_keys = ON;');
  return drizzle(client, { schema });
}
