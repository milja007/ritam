import { openDatabaseSync } from 'expo-sqlite';

import { createDb, type RitamDb } from './db';

export const DATABASE_NAME = 'ritam.db';

let instance: RitamDb | null = null;

/** Jedna dijeljena konekcija na lokalnu bazu appa. */
export function getDb(): RitamDb {
  if (instance === null) {
    const client = openDatabaseSync(DATABASE_NAME);
    client.execSync('PRAGMA journal_mode = WAL;');
    instance = createDb(client);
  }
  return instance;
}
