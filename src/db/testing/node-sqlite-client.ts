/// <reference types="node" />
/**
 * Samo za testove: minimalni adapter koji ugrađeni Node `node:sqlite` predstavlja kao expo-sqlite
 * `SQLiteDatabase` — točno onaj podskup koji koristi Drizzle `expo-sqlite` driver
 * (`execSync`, `prepareSync` → `executeSync` / `executeForRawResultSync`).
 * Tako testovi vrte pravi Drizzle driver, prave migracije i prave repoe nad stvarnim SQLite-om.
 */
import type { SQLiteDatabase } from 'expo-sqlite';
import { DatabaseSync, type SQLInputValue } from 'node:sqlite';

type Params = SQLInputValue[];

export function createNodeSqliteClient(): { client: SQLiteDatabase; raw: DatabaseSync } {
  const raw = new DatabaseSync(':memory:');
  const client = {
    execSync(source: string) {
      raw.exec(source);
    },
    prepareSync(source: string) {
      const statement = raw.prepare(source);
      return {
        executeSync(params: Params = []) {
          const { changes, lastInsertRowid } = statement.run(...params);
          return {
            changes: Number(changes),
            lastInsertRowId: Number(lastInsertRowid),
            getAllSync: () => statement.all(...params),
            getFirstSync: () => statement.get(...params) ?? null,
          };
        },
        executeForRawResultSync(params: Params = []) {
          return {
            getAllSync: () => {
              statement.setReturnArrays(true);
              try {
                return statement.all(...params);
              } finally {
                statement.setReturnArrays(false);
              }
            },
          };
        },
      };
    },
  };
  return { client: client as unknown as SQLiteDatabase, raw };
}
