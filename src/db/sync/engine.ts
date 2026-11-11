/**
 * Sync lokalne baze sa Supabaseom (korak 19): pull pa push.
 *
 * - Red promjena (`sync_queue`) pune SQLite okidači pri svakom upisu u 8 tablica.
 * - Pull: retci promijenjeni na poslužitelju nakon kursora (`synced_at` postavlja poslužitelj),
 *   primjenjuju se samo kad su noviji od lokalnih (zadnji `updatedAt` pobjeđuje), zatim tombstoni.
 * - Push: brisanja (dijete → roditelj), pa upserti (roditelj → dijete); unos se uklanja iz reda
 *   samo ako se nije mijenjao tijekom slanja.
 */
import { eq, getTableColumns, inArray } from 'drizzle-orm';
import type { SQLiteTable } from 'drizzle-orm/sqlite-core';

import {
  NATURAL_KEYS,
  SYNC_TABLES,
  chunk,
  isRemoteNewer,
  isSyncTable,
  naturalKeyOf,
  planPush,
  toLocalRow,
  toRemoteRow,
  type Row,
  type SyncTable,
} from '@/core/sync';

import type { RitamDb } from '../db';
import * as schema from '../schema';
import type { PullCursor, RemoteStore } from './remote';
import {
  APPLYING_REMOTE,
  LAST_SYNC,
  REMOTE_USER,
  TOMBSTONE_CURSOR,
  ackQueued,
  cursorKey,
  deleteState,
  dropQueued,
  enqueue,
  enqueueAll,
  getState,
  queuedOp,
  readQueue,
  setState,
} from './state';

export const PULL_PAGE = 500;
const PUSH_CHUNK = 100;

type Tx = Parameters<Parameters<RitamDb['transaction']>[0]>[0];

const TABLES: Record<SyncTable, SQLiteTable> = {
  settings: schema.settings,
  rules: schema.rules,
  checkins: schema.checkins,
  schedule_blocks: schema.scheduleBlocks,
  checkin_items: schema.checkinItems,
  rule_logs: schema.ruleLogs,
  xp_events: schema.xpEvents,
  reports: schema.reports,
};

type IdColumns = { id: ReturnType<typeof getTableColumns>[string]; userId: ReturnType<typeof getTableColumns>[string] };

function columnsOf(table: SyncTable) {
  return getTableColumns(TABLES[table]);
}

function idColumns(table: SyncTable): IdColumns {
  const columns = columnsOf(table);
  return { id: columns.id, userId: columns.userId };
}

function selectById(db: Tx | RitamDb, table: SyncTable, id: string): Row | undefined {
  return db.select().from(TABLES[table]).where(eq(idColumns(table).id, id)).get() as Row | undefined;
}

function selectUserRows(db: Tx | RitamDb, table: SyncTable, userId: string): Row[] {
  return db.select().from(TABLES[table]).where(eq(idColumns(table).userId, userId)).all() as Row[];
}

function deleteById(db: Tx, table: SyncTable, id: string): void {
  db.delete(TABLES[table]).where(eq(idColumns(table).id, id)).run();
}

function isConstraintError(error: unknown): boolean {
  // Ne `instanceof Error`: greške nativnog drivera mogu doći iz drugog realma.
  const message = typeof error === 'object' && error !== null && 'message' in error ? String(error.message) : '';
  return /constraint/i.test(message);
}

export type ApplyResult = { applied: number; skipped: number };

/**
 * Primjenjuje retke s poslužitelja na lokalnu bazu (okidači reda utišani).
 * Pravila: lokalno brisanje na čekanju pobjeđuje; inače zadnji `updatedAt` pobjeđuje. Sudar
 * prirodnog ključa (drugi id, npr. isti dan na dva uređaja) — noviji ostaje; ako ostaje lokalni,
 * remote redak ide u red za brisanje.
 */
export function applyRemoteRows(db: RitamDb, table: SyncTable, remoteRows: readonly Row[], localUserId: string): ApplyResult {
  const columns = Object.keys(columnsOf(table));
  const naturalKey = NATURAL_KEYS[table];
  let applied = 0;
  let skipped = 0;

  db.transaction((tx) => {
    setState(tx, APPLYING_REMOTE, '1');
    try {
      for (const remote of remoteRows) {
        const row = toLocalRow(remote, { localUserId, columns });
        const id = String(row.id);
        const updatedAt = String(row.updatedAt);
        const existing = selectById(tx, table, id);

        if (existing) {
          if (!isRemoteNewer(String(existing.updatedAt), updatedAt)) {
            skipped += 1;
            continue;
          }
          tx.update(TABLES[table]).set(row as never).where(eq(idColumns(table).id, id)).run();
          dropQueued(tx, table, id);
          applied += 1;
          continue;
        }

        if (queuedOp(tx, table, id) === 'delete') {
          skipped += 1;
          continue;
        }

        if (naturalKey !== null) {
          const key = naturalKeyOf(row, naturalKey);
          const clash = selectUserRows(tx, table, localUserId).find(
            (local) => local.id !== id && naturalKeyOf(local, naturalKey) === key,
          );
          if (clash) {
            if (isRemoteNewer(String(clash.updatedAt), updatedAt)) {
              deleteById(tx, table, String(clash.id));
              // Lokalni redak nikad ne smije stići na poslužitelj (tamo je noviji).
              dropQueued(tx, table, String(clash.id));
            } else {
              enqueue(tx, table, id, 'delete');
              skipped += 1;
              continue;
            }
          }
        }

        try {
          tx.insert(TABLES[table]).values(row as never).run();
          applied += 1;
        } catch (error) {
          // Npr. stavka checkina čiji roditelj lokalno nije prihvaćen (pobijedio je lokalni dan).
          if (!isConstraintError(error)) throw error;
          skipped += 1;
        }
      }
    } finally {
      deleteState(tx, APPLYING_REMOTE);
    }
  });
  return { applied, skipped };
}

function readCursor(db: RitamDb, table: SyncTable): PullCursor | null {
  const value = getState(db, cursorKey(table));
  if (value === null) return null;
  try {
    const parsed = JSON.parse(value) as Partial<PullCursor>;
    return typeof parsed.at === 'string' && typeof parsed.id === 'string' ? { at: parsed.at, id: parsed.id } : null;
  } catch {
    return null;
  }
}

export type PullResult = { applied: number; skipped: number; removedLocally: number };

export async function pull(db: RitamDb, remote: RemoteStore, localUserId: string): Promise<PullResult> {
  const result: PullResult = { applied: 0, skipped: 0, removedLocally: 0 };

  for (const table of SYNC_TABLES) {
    let cursor = readCursor(db, table);
    for (;;) {
      const rows = await remote.fetchChanged(table, cursor, PULL_PAGE);
      if (rows.length === 0) break;
      const { applied, skipped } = applyRemoteRows(db, table, rows, localUserId);
      result.applied += applied;
      result.skipped += skipped;
      const last = rows[rows.length - 1];
      cursor = { at: String(last.synced_at), id: String(last.id) };
      setState(db, cursorKey(table), JSON.stringify(cursor));
      if (rows.length < PULL_PAGE) break;
    }
  }

  let afterId = Number(getState(db, TOMBSTONE_CURSOR) ?? '0');
  for (;;) {
    const tombstones = await remote.fetchTombstones(afterId, PULL_PAGE);
    if (tombstones.length === 0) break;
    db.transaction((tx) => {
      setState(tx, APPLYING_REMOTE, '1');
      try {
        for (const tombstone of tombstones) {
          if (!isSyncTable(tombstone.tableName)) continue;
          const local = selectById(tx, tombstone.tableName, tombstone.rowId);
          if (!local) {
            dropQueued(tx, tombstone.tableName, tombstone.rowId);
            continue;
          }
          // Lokalna izmjena nakon brisanja na drugom uređaju pobjeđuje (vratit će redak).
          if (isRemoteNewer(String(local.updatedAt), tombstone.deletedAt)) {
            deleteById(tx, tombstone.tableName, tombstone.rowId);
            dropQueued(tx, tombstone.tableName, tombstone.rowId);
            result.removedLocally += 1;
          }
        }
      } finally {
        deleteState(tx, APPLYING_REMOTE);
      }
    });
    afterId = tombstones[tombstones.length - 1].id;
    setState(db, TOMBSTONE_CURSOR, String(afterId));
    if (tombstones.length < PULL_PAGE) break;
  }
  return result;
}

export type PushResult = { upserted: number; deleted: number };

export async function push(db: RitamDb, remote: RemoteStore, remoteUserId: string): Promise<PushResult> {
  const plan = planPush(readQueue(db));
  const result: PushResult = { upserted: 0, deleted: 0 };

  for (const entry of plan.unknown) ackQueued(db, entry);

  for (const group of plan.deletes) {
    for (const part of chunk(group.entries, PUSH_CHUNK)) {
      await remote.remove(
        group.table,
        part.map((entry) => entry.rowId),
      );
      for (const entry of part) ackQueued(db, entry);
      result.deleted += part.length;
    }
  }

  for (const group of plan.upserts) {
    for (const part of chunk(group.entries, PUSH_CHUNK)) {
      const ids = part.map((entry) => entry.rowId);
      const rows = db
        .select()
        .from(TABLES[group.table])
        .where(inArray(idColumns(group.table).id, ids))
        .all() as Row[];
      const found = new Set(rows.map((row) => String(row.id)));
      // Redak je u međuvremenu nestao bez okidača (npr. zamijenjen pri pullu) → obriši i na poslužitelju.
      const missing = ids.filter((id) => !found.has(id));
      if (missing.length > 0) await remote.remove(group.table, missing);
      if (rows.length > 0) {
        await remote.upsert(
          group.table,
          rows.map((row) => toRemoteRow(row, { remoteUserId })),
        );
      }
      for (const entry of part) ackQueued(db, entry);
      result.upserted += rows.length;
      result.deleted += missing.length;
    }
  }
  return result;
}

export type SyncResult = PullResult & PushResult & { seeded: boolean; finishedAt: string };

/**
 * Jedan prolaz: (prva prijava → svi lokalni retci u red, kursori ispočetka) → pull → push.
 * Lokalni podaci ostaju pod `localUserId`; na poslužitelju su pod računom `remoteUserId`.
 */
export async function syncOnce(
  db: RitamDb,
  remote: RemoteStore,
  ids: { localUserId: string; remoteUserId: string },
  now: () => Date = () => new Date(),
): Promise<SyncResult> {
  let seeded = false;
  if (getState(db, REMOTE_USER) !== ids.remoteUserId) {
    db.transaction((tx) => {
      enqueueAll(tx, ids.localUserId);
      for (const table of SYNC_TABLES) deleteState(tx, cursorKey(table));
      deleteState(tx, TOMBSTONE_CURSOR);
      setState(tx, REMOTE_USER, ids.remoteUserId);
    });
    seeded = true;
  }
  const pulled = await pull(db, remote, ids.localUserId);
  const pushed = await push(db, remote, ids.remoteUserId);
  const finishedAt = now().toISOString();
  setState(db, LAST_SYNC, finishedAt);
  return { ...pulled, ...pushed, seeded, finishedAt };
}

export function lastSyncAt(db: RitamDb): string | null {
  return getState(db, LAST_SYNC);
}
