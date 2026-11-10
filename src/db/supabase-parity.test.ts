/**
 * @jest-environment node
 *
 * Čuvar pariteta: svaka lokalna tablica i svaki njezin stupac (Drizzle shema) mora postojati
 * u Supabase migracijama (`supabase/migrations`). Kad lokalna migracija doda stupac,
 * ovaj test pada dok se ne doda i Supabase migracija (sync, korak 19, šalje retke 1:1).
 */
import { describe, expect, it } from '@jest/globals';
import { getTableConfig } from 'drizzle-orm/sqlite-core';
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

import * as schema from './schema';

const MIGRATIONS_DIR = join(__dirname, '..', '..', 'supabase', 'migrations');

function readMigrations(): string {
  return readdirSync(MIGRATIONS_DIR)
    .filter((name) => name.endsWith('.sql'))
    .sort()
    .map((name) => readFileSync(join(MIGRATIONS_DIR, name), 'utf8'))
    .join('\n');
}

/** Stupci po tablici iz `create table public.x (...)` i `alter table public.x add column y`. */
function supabaseColumns(sql: string): Map<string, Set<string>> {
  const tables = new Map<string, Set<string>>();
  const withoutComments = sql.replace(/--[^\n]*/g, '');

  for (const match of withoutComments.matchAll(/create table public\.(\w+)\s*\(([\s\S]*?)\n\);/gi)) {
    const columns = new Set<string>();
    for (const line of match[2].split('\n')) {
      const column = /^\s*"?(\w+)"?\s+(uuid|text|date|timestamptz|boolean|integer|smallint|numeric|jsonb)\b/i.exec(line);
      if (column) columns.add(column[1]);
    }
    tables.set(match[1], columns);
  }

  for (const match of withoutComments.matchAll(
    /alter table public\.(\w+)\s+add column (?:if not exists )?"?(\w+)"?/gi,
  )) {
    tables.get(match[1])?.add(match[2]);
  }
  return tables;
}

// `schema.ts` izvozi samo tablice.
const localTables = Object.values(schema).map((table) => getTableConfig(table));

describe('Supabase shema prati lokalnu', () => {
  const remote = supabaseColumns(readMigrations());

  it('pronalazi lokalne tablice', () => {
    expect(localTables.map((table) => table.name).sort()).toEqual([
      'checkin_items',
      'checkins',
      'reports',
      'rule_logs',
      'rules',
      'schedule_blocks',
      'settings',
      'xp_events',
    ]);
  });

  it.each(localTables.map((table) => [table.name, table] as const))('%s ima sve stupce', (name, table) => {
    const remoteColumns = remote.get(name);
    expect(remoteColumns).toBeDefined();
    const missing = table.columns.map((column) => column.name).filter((column) => !remoteColumns?.has(column));
    expect(missing).toEqual([]);
  });

  it('ima i llm_calls (Edge Functions, korak 20)', () => {
    expect([...(remote.get('llm_calls') ?? [])]).toEqual(
      expect.arrayContaining(['function', 'provider', 'model', 'input_tokens', 'output_tokens', 'ms', 'ok']),
    );
  });
});
