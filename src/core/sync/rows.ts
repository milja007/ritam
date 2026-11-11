/**
 * Mapiranje redaka lokalno (camelCase, `local-user`) ↔ Supabase (snake_case, `auth.uid()`).
 * Vrijednosti su već JS tipovi (Drizzle i PostgREST): boolean, broj, JSON objekt, tekst.
 */

export type Row = Record<string, unknown>;

/** Stupci koje postavlja samo poslužitelj — ne šalju se i ne spremaju lokalno. */
export const SERVER_ONLY_COLUMNS: readonly string[] = ['synced_at'];

const TIMESTAMP_KEYS = new Set(['createdAt', 'updatedAt']);

export function camelToSnake(key: string): string {
  return key.replace(/[A-Z]/g, (letter) => `_${letter.toLowerCase()}`);
}

export function snakeToCamel(key: string): string {
  return key.replace(/_([a-z0-9])/g, (_, letter: string) => letter.toUpperCase());
}

/** ISO s milisekundama i `Z` (lokalni format); nevaljano ostaje kako jest. */
export function normalizeTimestamp(value: string): string {
  const ms = Date.parse(value);
  return Number.isNaN(ms) ? value : new Date(ms).toISOString();
}

export type ToRemoteOptions = {
  remoteUserId: string;
  /** Polja koja se ne šalju (npr. `id` za singleton postavke). */
  omit?: readonly string[];
};

export function toRemoteRow(local: Row, { remoteUserId, omit = [] }: ToRemoteOptions): Row {
  const remote: Row = {};
  for (const [key, value] of Object.entries(local)) {
    if (omit.includes(key)) continue;
    remote[camelToSnake(key)] = key === 'userId' ? remoteUserId : value;
  }
  if (!('userId' in local)) remote.user_id = remoteUserId;
  return remote;
}

export type ToLocalOptions = {
  localUserId: string;
  /** Lokalni stupci (camelCase); sve ostalo s poslužitelja se ignorira. */
  columns: readonly string[];
};

export function toLocalRow(remote: Row, { localUserId, columns }: ToLocalOptions): Row {
  const local: Row = {};
  for (const [key, value] of Object.entries(remote)) {
    if (SERVER_ONLY_COLUMNS.includes(key)) continue;
    const camel = snakeToCamel(key);
    if (!columns.includes(camel)) continue;
    if (camel === 'userId') {
      local.userId = localUserId;
    } else if (TIMESTAMP_KEYS.has(camel) && typeof value === 'string') {
      local[camel] = normalizeTimestamp(value);
    } else {
      local[camel] = value;
    }
  }
  if (columns.includes('userId')) local.userId = localUserId;
  return local;
}

/** Vrijednosti prirodnog ključa retka (lokalna imena) ili `null` kad tablica nema ključ. */
export function naturalKeyOf(row: Row, keys: readonly string[] | null): string | null {
  if (keys === null) return null;
  return JSON.stringify(keys.map((key) => row[key] ?? null));
}
