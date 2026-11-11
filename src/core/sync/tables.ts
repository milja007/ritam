/**
 * Tablice koje se sinkroniziraju sa Supabaseom (korak 19) i njihov redoslijed.
 *
 * Upserti idu od roditelja prema djeci (strani ključevi na poslužitelju), brisanja obrnuto.
 * Prirodni ključ = jedinstveno ograničenje osim `id` (uz korisnika); dva uređaja ga mogu
 * stvoriti offline s različitim id-jem, pa sync tada bira noviji redak (vidi `conflict.ts`).
 */

export const SYNC_TABLES = [
  'settings',
  'rules',
  'checkins',
  'schedule_blocks',
  'checkin_items',
  'rule_logs',
  'xp_events',
  'reports',
] as const;

export type SyncTable = (typeof SYNC_TABLES)[number];

/** Polja prirodnog ključa (camelCase, lokalna imena), bez `userId` koji je uvijek dio ključa. */
export const NATURAL_KEYS: Readonly<Record<SyncTable, readonly string[] | null>> = {
  // Jedan red postavki po korisniku: prazan ključ = singleton.
  settings: [],
  rules: null,
  checkins: ['date', 'kind'],
  schedule_blocks: null,
  checkin_items: null,
  rule_logs: ['ruleId', 'date'],
  xp_events: null,
  reports: ['period', 'periodStart'],
};

export function isSyncTable(name: string): name is SyncTable {
  return (SYNC_TABLES as readonly string[]).includes(name);
}

/** Redoslijed za upserte (roditelj → dijete). */
export function upsertOrder(): readonly SyncTable[] {
  return SYNC_TABLES;
}

/** Redoslijed za brisanja (dijete → roditelj). */
export function deleteOrder(): readonly SyncTable[] {
  return [...SYNC_TABLES].reverse();
}
