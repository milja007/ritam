import { describe, expect, it } from '@jest/globals';

import {
  NATURAL_KEYS,
  SYNC_TABLES,
  camelToSnake,
  chunk,
  deleteOrder,
  isRemoteNewer,
  naturalKeyOf,
  nextCursor,
  normalizeTimestamp,
  planPush,
  snakeToCamel,
  toLocalRow,
  toRemoteRow,
  upsertOrder,
  type QueueEntry,
} from './index';

describe('tablice', () => {
  it('roditelji prije djece za upserte, obrnuto za brisanja', () => {
    const order = upsertOrder();
    expect(order.indexOf('checkins')).toBeLessThan(order.indexOf('checkin_items'));
    expect(order.indexOf('rules')).toBeLessThan(order.indexOf('rule_logs'));
    expect(order.indexOf('checkins')).toBeLessThan(order.indexOf('rule_logs'));
    expect(deleteOrder()).toEqual([...order].reverse());
  });

  it('svaka tablica ima definiran prirodni ključ (ili null)', () => {
    for (const table of SYNC_TABLES) expect(NATURAL_KEYS[table]).not.toBeUndefined();
  });
});

describe('isRemoteNewer', () => {
  it('nema lokalnog retka → remote', () => {
    expect(isRemoteNewer(undefined, '2026-11-11T10:00:00Z')).toBe(true);
    expect(isRemoteNewer(null, '2026-11-11T10:00:00Z')).toBe(true);
  });

  it('zadnji updatedAt pobjeđuje, i s različitim formatima zone', () => {
    expect(isRemoteNewer('2026-11-11T10:00:00.000Z', '2026-11-11T10:00:01+00:00')).toBe(true);
    expect(isRemoteNewer('2026-11-11T10:00:01.000Z', '2026-11-11T11:00:00+01:00')).toBe(false);
  });

  it('jednako vrijeme → lokalni ostaje', () => {
    expect(isRemoteNewer('2026-11-11T10:00:00.000Z', '2026-11-11T10:00:00+00:00')).toBe(false);
  });
});

describe('nextCursor', () => {
  it('uzima najveće vrijeme', () => {
    expect(nextCursor(null, [])).toBeNull();
    expect(nextCursor('2026-11-11T10:00:00Z', ['2026-11-11T09:00:00Z'])).toBe('2026-11-11T10:00:00Z');
    expect(nextCursor(null, ['2026-11-11T09:00:00+00:00', '2026-11-11T10:30:00.123456+00:00'])).toBe(
      '2026-11-11T10:30:00.123456+00:00',
    );
  });
});

describe('mapiranje redaka', () => {
  it('camel ↔ snake', () => {
    expect(camelToSnake('periodStart')).toBe('period_start');
    expect(camelToSnake('blockRemindersEnabled')).toBe('block_reminders_enabled');
    expect(snakeToCamel('wind_down_notif_enabled')).toBe('windDownNotifEnabled');
    expect(snakeToCamel('id')).toBe('id');
  });

  it('lokalni redak → remote s korisnikom računa', () => {
    const remote = toRemoteRow(
      { id: 'a', userId: 'local-user', periodStart: '2026-11-11', helpful: true, sections: { a: 1 } },
      { remoteUserId: 'uid-1' },
    );
    expect(remote).toEqual({
      id: 'a',
      user_id: 'uid-1',
      period_start: '2026-11-11',
      helpful: true,
      sections: { a: 1 },
    });
  });

  it('omit izbacuje polja (singleton postavke bez id-ja)', () => {
    expect(toRemoteRow({ id: 's', userId: 'local-user', theme: 'dark' }, { remoteUserId: 'u', omit: ['id'] })).toEqual({
      user_id: 'u',
      theme: 'dark',
    });
  });

  it('remote → lokalno: korisnik lokalni, nepoznati i poslužiteljski stupci ignorirani, vrijeme u ISO', () => {
    const local = toLocalRow(
      {
        id: 'a',
        user_id: 'uid-1',
        created_at: '2026-11-11T10:00:00.123+00:00',
        updated_at: '2026-11-11T11:00:00+01:00',
        synced_at: '2026-11-11T10:05:00+00:00',
        future_column: 1,
        gave_up: false,
      },
      { localUserId: 'local-user', columns: ['id', 'userId', 'createdAt', 'updatedAt', 'gaveUp'] },
    );
    expect(local).toEqual({
      id: 'a',
      userId: 'local-user',
      createdAt: '2026-11-11T10:00:00.123Z',
      updatedAt: '2026-11-11T10:00:00.000Z',
      gaveUp: false,
    });
  });

  it('normalizeTimestamp ne dira nevaljano', () => {
    expect(normalizeTimestamp('x')).toBe('x');
  });

  it('prirodni ključ', () => {
    expect(naturalKeyOf({ date: '2026-11-11', kind: 'evening' }, ['date', 'kind'])).toBe('["2026-11-11","evening"]');
    expect(naturalKeyOf({ theme: 'dark' }, [])).toBe('[]');
    expect(naturalKeyOf({ id: 'x' }, null)).toBeNull();
  });
});

describe('planPush', () => {
  const entry = (tableName: string, rowId: string, op: 'upsert' | 'delete'): QueueEntry => ({
    tableName,
    rowId,
    op,
    version: 1,
  });

  it('grupira po tablici i slaže redoslijed', () => {
    const plan = planPush([
      entry('checkin_items', 'i1', 'upsert'),
      entry('checkins', 'c1', 'upsert'),
      entry('checkins', 'c0', 'delete'),
      entry('checkin_items', 'i0', 'delete'),
      entry('legacy', 'x', 'upsert'),
    ]);
    expect(plan.upserts.map((group) => group.table)).toEqual(['checkins', 'checkin_items']);
    expect(plan.deletes.map((group) => group.table)).toEqual(['checkin_items', 'checkins']);
    expect(plan.unknown.map((e) => e.rowId)).toEqual(['x']);
  });

  it('prazan red → prazan plan', () => {
    expect(planPush([])).toEqual({ deletes: [], upserts: [], unknown: [] });
  });
});

describe('chunk', () => {
  it('dijeli na komade', () => {
    expect(chunk([1, 2, 3, 4, 5], 2)).toEqual([[1, 2], [3, 4], [5]]);
    expect(chunk([], 3)).toEqual([]);
    expect(() => chunk([1], 0)).toThrow();
  });
});
