/**
 * Red promjena: jedan unos po `(tablica, id)` s posljednjom operacijom i verzijom.
 * Push šalje sve unose; nakon uspjeha uklanja samo one čija se verzija nije promijenila
 * u međuvremenu (promjena tijekom slanja ostaje za sljedeći prolaz).
 */
import { deleteOrder, isSyncTable, upsertOrder, type SyncTable } from './tables';

export type QueueOp = 'upsert' | 'delete';

export type QueueEntry = {
  tableName: string;
  rowId: string;
  op: QueueOp;
  version: number;
};

export type PushPlan = {
  /** Brisanja po tablici, redom dijete → roditelj. */
  deletes: { table: SyncTable; entries: QueueEntry[] }[];
  /** Upserti po tablici, redom roditelj → dijete. */
  upserts: { table: SyncTable; entries: QueueEntry[] }[];
  /** Unosi za nepoznate tablice (stara verzija appa) — samo se uklanjaju. */
  unknown: QueueEntry[];
};

export function planPush(entries: readonly QueueEntry[]): PushPlan {
  const byTable = new Map<SyncTable, { deletes: QueueEntry[]; upserts: QueueEntry[] }>();
  const unknown: QueueEntry[] = [];
  for (const entry of entries) {
    if (!isSyncTable(entry.tableName)) {
      unknown.push(entry);
      continue;
    }
    const bucket = byTable.get(entry.tableName) ?? { deletes: [], upserts: [] };
    (entry.op === 'delete' ? bucket.deletes : bucket.upserts).push(entry);
    byTable.set(entry.tableName, bucket);
  }
  const deletes = deleteOrder()
    .map((table) => ({ table, entries: byTable.get(table)?.deletes ?? [] }))
    .filter((group) => group.entries.length > 0);
  const upserts = upsertOrder()
    .map((table) => ({ table, entries: byTable.get(table)?.upserts ?? [] }))
    .filter((group) => group.entries.length > 0);
  return { deletes, upserts, unknown };
}

/** Dijeli popis na komade (PostgREST: ograničena duljina upita za `in (...)`). */
export function chunk<T>(items: readonly T[], size: number): T[][] {
  if (size < 1) throw new Error('size must be >= 1');
  const result: T[][] = [];
  for (let index = 0; index < items.length; index += size) result.push(items.slice(index, index + size));
  return result;
}
