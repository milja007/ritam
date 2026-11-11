import type { SupabaseClient } from '@supabase/supabase-js';

import type { Row, SyncTable } from '@/core/sync';
import type { PullCursor, RemoteStore, Tombstone } from '@/db/sync';

/** Vrijednost za PostgREST `or(...)` filter (navodnici: vrijeme sadrži `:` i `+`). */
function quote(value: string): string {
  return `"${value.replace(/\\/g, '\\\\').replace(/"/g, '\\"')}"`;
}

/** `RemoteStore` nad Supabaseom (RLS: korisnik vidi i mijenja samo svoje retke). */
export function createSupabaseRemote(client: SupabaseClient): RemoteStore {
  return {
    async fetchChanged(table: SyncTable, after: PullCursor | null, limit: number): Promise<Row[]> {
      let query = client.from(table).select('*');
      if (after !== null) {
        const at = quote(after.at);
        query = query.or(`synced_at.gt.${at},and(synced_at.eq.${at},id.gt.${quote(after.id)})`);
      }
      const { data, error } = await query
        .order('synced_at', { ascending: true })
        .order('id', { ascending: true })
        .limit(limit);
      if (error) throw new Error(`pull ${table}: ${error.message}`);
      return (data ?? []) as Row[];
    },

    async fetchTombstones(afterId: number, limit: number): Promise<Tombstone[]> {
      const { data, error } = await client
        .from('sync_tombstones')
        .select('id, table_name, row_id, deleted_at')
        .gt('id', afterId)
        .order('id', { ascending: true })
        .limit(limit);
      if (error) throw new Error(`pull tombstones: ${error.message}`);
      return ((data ?? []) as { id: number | string; table_name: string; row_id: string; deleted_at: string }[]).map(
        (row) => ({ id: Number(row.id), tableName: row.table_name, rowId: row.row_id, deletedAt: row.deleted_at }),
      );
    },

    async upsert(table: SyncTable, rows: Row[]): Promise<void> {
      const { error } = await client.from(table).upsert(rows, { onConflict: 'id' });
      if (error) throw new Error(`push ${table}: ${error.message}`);
    },

    async remove(table: SyncTable, ids: string[]): Promise<void> {
      const { error } = await client.from(table).delete().in('id', ids);
      if (error) throw new Error(`delete ${table}: ${error.message}`);
    },
  };
}
