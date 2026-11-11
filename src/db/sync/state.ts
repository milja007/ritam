/** Lokalno stanje synca (`sync_state`) i red promjena (`sync_queue`) — sirovi SQL (tablice nisu u Drizzle shemi). */
import { sql } from 'drizzle-orm';

import { SYNC_TABLES, type QueueEntry, type QueueOp } from '@/core/sync';

import type { RitamDb } from '../db';

/** Ključ zastavice koja utišava okidače reda dok se primjenjuju retci s poslužitelja. */
export const APPLYING_REMOTE = 'applying_remote';
export const REMOTE_USER = 'remote_user';
export const TOMBSTONE_CURSOR = 'cursor:tombstones';
export const LAST_SYNC = 'last_sync';
export const cursorKey = (table: string) => `cursor:${table}`;

type Tx = Pick<RitamDb, 'run' | 'all' | 'get'>;

export function getState(db: Tx, key: string): string | null {
  const row = db.get<{ value: string | null }>(sql`SELECT value FROM sync_state WHERE key = ${key}`);
  return row?.value ?? null;
}

export function setState(db: Tx, key: string, value: string | null): void {
  db.run(
    sql`INSERT INTO sync_state (key, value) VALUES (${key}, ${value})
        ON CONFLICT (key) DO UPDATE SET value = excluded.value`,
  );
}

export function deleteState(db: Tx, key: string): void {
  db.run(sql`DELETE FROM sync_state WHERE key = ${key}`);
}

export function readQueue(db: Tx): QueueEntry[] {
  return db
    .all<{ table_name: string; row_id: string; op: QueueOp; version: number }>(
      sql`SELECT table_name, row_id, op, version FROM sync_queue ORDER BY table_name, row_id`,
    )
    .map((row) => ({ tableName: row.table_name, rowId: row.row_id, op: row.op, version: Number(row.version) }));
}

export function queuedOp(db: Tx, table: string, rowId: string): QueueOp | null {
  const row = db.get<{ op: QueueOp }>(
    sql`SELECT op FROM sync_queue WHERE table_name = ${table} AND row_id = ${rowId}`,
  );
  return row?.op ?? null;
}

export function enqueue(db: Tx, table: string, rowId: string, op: QueueOp): void {
  db.run(
    sql`INSERT INTO sync_queue (table_name, row_id, op) VALUES (${table}, ${rowId}, ${op})
        ON CONFLICT (table_name, row_id) DO UPDATE SET op = excluded.op, version = version + 1`,
  );
}

export function dropQueued(db: Tx, table: string, rowId: string): void {
  db.run(sql`DELETE FROM sync_queue WHERE table_name = ${table} AND row_id = ${rowId}`);
}

/** Uklanja unos samo ako se nije mijenjao od čitanja (ista verzija). */
export function ackQueued(db: Tx, entry: QueueEntry): void {
  db.run(
    sql`DELETE FROM sync_queue
        WHERE table_name = ${entry.tableName} AND row_id = ${entry.rowId} AND version = ${entry.version}`,
  );
}

/** Svi lokalni retci korisnika u red (prva prijava ili drugi račun). */
export function enqueueAll(db: Tx, userId: string): void {
  for (const table of SYNC_TABLES) {
    db.run(
      sql`INSERT INTO sync_queue (table_name, row_id, op)
          SELECT ${table}, id, 'upsert' FROM ${sql.identifier(table)} WHERE user_id = ${userId}
          ON CONFLICT (table_name, row_id) DO UPDATE SET op = 'upsert', version = version + 1`,
    );
  }
}

export function queueSize(db: Tx): number {
  return Number(db.get<{ n: number }>(sql`SELECT count(*) AS n FROM sync_queue`)?.n ?? 0);
}
