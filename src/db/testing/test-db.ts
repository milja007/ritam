import { migrate } from 'drizzle-orm/expo-sqlite/migrator';

import { createDb, type RitamDb } from '../db';
import migrations from '../migrations/migrations';
import type { RepoDeps } from '../repos/deps';
import { createNodeSqliteClient } from './node-sqlite-client';

/** Svježa baza u memoriji s primijenjenim migracijama appa. */
export async function createTestDb() {
  const { client, raw } = createNodeSqliteClient();
  const db: RitamDb = createDb(client);
  await migrate(db, migrations);
  return { db, raw };
}

/** Deterministički id-evi i sat koji se pomiče po minutu pri svakom pozivu. */
export function testDeps(start = '2026-11-08T06:00:00.000Z'): RepoDeps {
  let counter = 0;
  let time = new Date(start).getTime();
  return {
    newId: () => `id-${++counter}`,
    now: () => {
      const current = new Date(time);
      time += 60_000;
      return current;
    },
  };
}
