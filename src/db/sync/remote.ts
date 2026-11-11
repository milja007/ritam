/**
 * Sučelje prema poslužitelju (Supabase). Implementacija je u `src/features/sync`;
 * testovi koriste lažni remote u memoriji.
 */
import type { Row, SyncTable } from '@/core/sync';

/** Kursor pulla: vrijeme poslužitelja (`synced_at`) + id za retke s istim vremenom. */
export type PullCursor = { at: string; id: string };

export type Tombstone = { id: number; tableName: string; rowId: string; deletedAt: string };

export interface RemoteStore {
  /** Retci promijenjeni nakon kursora, poredani po (`synced_at`, `id`), najviše `limit`. */
  fetchChanged(table: SyncTable, after: PullCursor | null, limit: number): Promise<Row[]>;
  /** Obrisani retci (tombstoni) s id-jem većim od `afterId`, poredani po id-ju. */
  fetchTombstones(afterId: number, limit: number): Promise<Tombstone[]>;
  upsert(table: SyncTable, rows: Row[]): Promise<void>;
  remove(table: SyncTable, ids: string[]): Promise<void>;
}
