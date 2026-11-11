/**
 * @jest-environment node
 */
import { describe, expect, it } from '@jest/globals';
import { sql } from 'drizzle-orm';

import type { Row, SyncTable } from '@/core/sync';

import type { RitamDb } from './db';
import {
  createBlock,
  deleteBlock,
  getBlock,
  getReport,
  getSettings,
  markReportSeen,
  saveSettings,
  updateBlock,
  type SettingsInput,
} from './repos';
import { AccountMismatchError, PULL_PAGE, queueSize, readQueue, syncOnce, type PullCursor, type RemoteStore, type Tombstone } from './sync';
import { checkins, reports } from './schema';
import { createTestDb, testDeps } from './testing/test-db';

const LOCAL = 'local-user';
const UID = '11111111-1111-1111-1111-111111111111';
const ids = { localUserId: LOCAL, remoteUserId: UID };

const settingsInput: SettingsInput = {
  language: 'hr',
  wakeTime: '06:30',
  weekendWakeTime: null,
  sleepHours: 7.5,
  morningNotifTime: '06:45',
  eveningNotifTime: '21:00',
  windDownMinutes: 45,
  morningNotifEnabled: true,
  eveningNotifEnabled: true,
  windDownNotifEnabled: true,
  blockRemindersEnabled: true,
  theme: 'system',
  googleCalendarConnected: false,
  scorePlan: true,
  scoreRules: false,
  scoreSleep: false,
};

const blockInput = {
  date: '2026-11-11',
  title: 'Duboki rad',
  start: '09:00',
  end: '10:00',
  taskId: null,
  kind: 'task' as const,
  source: 'user' as const,
  status: 'planned' as const,
};

/** Lažni Supabase: `synced_at` iz brojača (kao poslužiteljsko vrijeme), tombstoni pri brisanju. */
class FakeRemote implements RemoteStore {
  tables = new Map<SyncTable, Map<string, Row>>();
  tombstones: Tombstone[] = [];
  private clock = Date.parse('2026-11-11T00:00:00Z');
  calls = { upsert: 0, remove: 0 };

  private table(name: SyncTable): Map<string, Row> {
    let table = this.tables.get(name);
    if (!table) {
      table = new Map();
      this.tables.set(name, table);
    }
    return table;
  }

  private tick(): string {
    this.clock += 1000;
    return new Date(this.clock).toISOString().replace('Z', '+00:00');
  }

  /** Upis s "drugog uređaja". */
  put(name: SyncTable, row: Row): void {
    this.table(name).set(String(row.id), { ...row, synced_at: this.tick() });
  }

  rows(name: SyncTable): Row[] {
    return [...this.table(name).values()];
  }

  async fetchChanged(name: SyncTable, after: PullCursor | null, limit: number): Promise<Row[]> {
    const key = (row: Row) => `${String(row.synced_at)}|${String(row.id)}`;
    return this.rows(name)
      .filter((row) => after === null || key(row) > `${after.at}|${after.id}`)
      .sort((a, b) => (key(a) < key(b) ? -1 : 1))
      .slice(0, limit);
  }

  async fetchTombstones(afterId: number, limit: number): Promise<Tombstone[]> {
    return this.tombstones.filter((t) => t.id > afterId).slice(0, limit);
  }

  async upsert(name: SyncTable, rows: Row[]): Promise<void> {
    this.calls.upsert += 1;
    const at = this.tick();
    for (const row of rows) this.table(name).set(String(row.id), { ...row, synced_at: at });
  }

  async remove(name: SyncTable, rowIds: string[]): Promise<void> {
    this.calls.remove += 1;
    for (const id of rowIds) {
      if (this.table(name).delete(id)) {
        this.tombstones.push({ id: this.tombstones.length + 1, tableName: name, rowId: id, deletedAt: this.tick() });
      }
    }
  }

  /** Brisanje s "drugog uređaja". */
  removeFromOtherDevice(name: SyncTable, id: string, deletedAt: string): void {
    this.table(name).delete(id);
    this.tombstones.push({ id: this.tombstones.length + 1, tableName: name, rowId: id, deletedAt });
  }
}

async function setup() {
  const { db } = await createTestDb();
  return { db, remote: new FakeRemote() };
}

function remoteBlock(id: string, overrides: Row = {}): Row {
  return {
    id,
    user_id: UID,
    created_at: '2026-11-11T08:00:00+00:00',
    updated_at: '2026-11-11T08:00:00+00:00',
    date: '2026-11-11',
    title: 'S drugog uređaja',
    start: '11:00',
    end: '12:00',
    task_id: null,
    kind: 'task',
    source: 'user',
    status: 'planned',
    note: null,
    ...overrides,
  };
}

const countQueue = (db: RitamDb) => queueSize(db);

describe('red promjena (okidači)', () => {
  it('upis, izmjena i brisanje bilježe zadnju operaciju po retku', async () => {
    const { db } = await setup();
    const deps = testDeps();
    const created = await createBlock(db, LOCAL, blockInput, deps);
    expect(readQueue(db)).toEqual([{ tableName: 'schedule_blocks', rowId: created.id, op: 'upsert', version: 1 }]);
    await updateBlock(db, LOCAL, created.id, { title: 'Novo' }, deps);
    expect(readQueue(db)[0]).toMatchObject({ op: 'upsert', version: 2 });
    deleteBlock(db, LOCAL, created.id);
    expect(readQueue(db)[0]).toMatchObject({ op: 'delete', version: 3 });
  });
});

describe('syncOnce', () => {
  it('prva prijava šalje sve postojeće lokalne podatke pod računom', async () => {
    const { db, remote } = await setup();
    const deps = testDeps();
    await saveSettings(db, LOCAL, settingsInput, deps);
    const block = await createBlock(db, LOCAL, blockInput, deps);
    // Kao da su podaci nastali prije koraka 19 (bez reda).
    db.run(sql`DELETE FROM sync_queue`);

    const result = await syncOnce(db, remote, ids);
    expect(result.seeded).toBe(true);
    expect(remote.rows('schedule_blocks')).toEqual([
      expect.objectContaining({ id: block.id, user_id: UID, title: 'Duboki rad', start: '09:00' }),
    ]);
    expect(remote.rows('settings')[0]).toMatchObject({ user_id: UID, sleep_hours: 7.5, morning_notif_enabled: true });
    expect(countQueue(db)).toBe(0);

    // Drugi prolaz bez promjena ništa ne šalje.
    const again = await syncOnce(db, remote, ids);
    expect(again.seeded).toBe(false);
    expect(again.upserted).toBe(0);
  });

  it('pull donosi nove retke s drugog uređaja i ne vraća ih u red', async () => {
    const { db, remote } = await setup();
    await syncOnce(db, remote, ids);
    remote.put('schedule_blocks', remoteBlock('b-remote'));

    const result = await syncOnce(db, remote, ids);
    expect(result.applied).toBe(1);
    const local = await getBlock(db, LOCAL, 'b-remote');
    expect(local).toMatchObject({ userId: LOCAL, title: 'S drugog uređaja', updatedAt: '2026-11-11T08:00:00.000Z' });
    expect(countQueue(db)).toBe(0);
  });

  it('konflikt: noviji remote prepisuje lokalni i briše lokalnu izmjenu iz reda', async () => {
    const { db, remote } = await setup();
    const block = await createBlock(db, LOCAL, blockInput, testDeps('2026-11-11T07:00:00.000Z'));
    await syncOnce(db, remote, ids);
    await updateBlock(db, LOCAL, block.id, { title: 'Lokalno' }, testDeps('2026-11-11T08:00:00.000Z'));
    remote.put('schedule_blocks', remoteBlock(block.id, { title: 'Remote', updated_at: '2026-11-11T09:00:00+00:00' }));

    await syncOnce(db, remote, ids);
    expect((await getBlock(db, LOCAL, block.id))?.title).toBe('Remote');
    expect(remote.rows('schedule_blocks')[0].title).toBe('Remote');
  });

  it('konflikt: noviji lokalni pobjeđuje i šalje se', async () => {
    const { db, remote } = await setup();
    const block = await createBlock(db, LOCAL, blockInput, testDeps('2026-11-11T07:00:00.000Z'));
    await syncOnce(db, remote, ids);
    remote.put('schedule_blocks', remoteBlock(block.id, { title: 'Remote', updated_at: '2026-11-11T08:00:00+00:00' }));
    await updateBlock(db, LOCAL, block.id, { title: 'Lokalno' }, testDeps('2026-11-11T09:00:00.000Z'));

    await syncOnce(db, remote, ids);
    expect((await getBlock(db, LOCAL, block.id))?.title).toBe('Lokalno');
    expect(remote.rows('schedule_blocks')[0].title).toBe('Lokalno');
  });

  it('kursor ne ovisi o satu uređaja: stara offline izmjena s drugog uređaja ipak stiže', async () => {
    const { db, remote } = await setup();
    await syncOnce(db, remote, ids);
    remote.put('schedule_blocks', remoteBlock('b-new', { updated_at: '2026-11-11T10:00:00+00:00' }));
    await syncOnce(db, remote, ids);
    // Drugi uređaj tek sada šalje izmjenu napravljenu jučer.
    remote.put('schedule_blocks', remoteBlock('b-old', { updated_at: '2026-11-10T10:00:00+00:00' }));
    await syncOnce(db, remote, ids);
    expect(await getBlock(db, LOCAL, 'b-old')).not.toBeNull();
  });

  it('pull ide po stranicama', async () => {
    const { db, remote } = await setup();
    await syncOnce(db, remote, ids);
    for (let index = 0; index < PULL_PAGE + 3; index += 1) {
      remote.put('xp_events', {
        id: `x-${String(index).padStart(4, '0')}`,
        user_id: UID,
        created_at: '2026-11-11T08:00:00+00:00',
        updated_at: '2026-11-11T08:00:00+00:00',
        date: '2026-11-11',
        source: 'task',
        source_id: null,
        amount: 10,
      });
    }
    const result = await syncOnce(db, remote, ids);
    expect(result.applied).toBe(PULL_PAGE + 3);
  });

  it('lokalno brisanje briše i na poslužitelju', async () => {
    const { db, remote } = await setup();
    const block = await createBlock(db, LOCAL, blockInput, testDeps());
    await syncOnce(db, remote, ids);
    deleteBlock(db, LOCAL, block.id);
    const result = await syncOnce(db, remote, ids);
    expect(result.deleted).toBe(1);
    expect(remote.rows('schedule_blocks')).toEqual([]);
    expect(countQueue(db)).toBe(0);
  });

  it('brisanje s drugog uređaja (tombstone) briše lokalno, osim ako je lokalna izmjena novija', async () => {
    const { db, remote } = await setup();
    const deps = testDeps('2026-11-11T07:00:00.000Z');
    const gone = await createBlock(db, LOCAL, blockInput, deps);
    const kept = await createBlock(db, LOCAL, { ...blockInput, title: 'Ostaje' }, deps);
    await syncOnce(db, remote, ids);

    remote.removeFromOtherDevice('schedule_blocks', gone.id, '2026-11-11T08:00:00+00:00');
    remote.removeFromOtherDevice('schedule_blocks', kept.id, '2026-11-11T08:00:00+00:00');
    await updateBlock(db, LOCAL, kept.id, { title: 'Ostaje (novije)' }, testDeps('2026-11-11T09:00:00.000Z'));

    const result = await syncOnce(db, remote, ids);
    expect(result.removedLocally).toBe(1);
    expect(await getBlock(db, LOCAL, gone.id)).toBeNull();
    expect((await getBlock(db, LOCAL, kept.id))?.title).toBe('Ostaje (novije)');
    expect(remote.rows('schedule_blocks').map((row) => row.id)).toEqual([kept.id]);
  });

  it('postavke s dva uređaja (drugi id): novije ostaju, na poslužitelju samo jedan red', async () => {
    const { db, remote } = await setup();
    await saveSettings(db, LOCAL, { ...settingsInput, theme: 'light' }, testDeps('2026-11-11T07:00:00.000Z'));
    remote.put('settings', {
      id: 'settings-remote',
      user_id: UID,
      created_at: '2026-11-11T06:00:00+00:00',
      updated_at: '2026-11-11T08:00:00+00:00',
      language: 'en',
      wake_time: '07:00',
      weekend_wake_time: null,
      sleep_hours: 8,
      morning_notif_time: '07:15',
      evening_notif_time: '22:00',
      wind_down_minutes: 30,
      morning_notif_enabled: true,
      evening_notif_enabled: true,
      wind_down_notif_enabled: true,
      block_reminders_enabled: true,
      theme: 'dark',
      google_calendar_connected: false,
      score_plan: true,
      score_rules: false,
      score_sleep: false,
    });

    await syncOnce(db, remote, ids);
    expect(await getSettings(db, LOCAL)).toMatchObject({ id: 'settings-remote', theme: 'dark', language: 'en' });
    expect(remote.rows('settings').map((row) => row.id)).toEqual(['settings-remote']);
  });

  it('postavke: noviji lokalni red zamjenjuje remote red (stari se briše)', async () => {
    const { db, remote } = await setup();
    remote.put('settings', {
      id: 'settings-remote',
      user_id: UID,
      created_at: '2026-11-11T06:00:00+00:00',
      updated_at: '2026-11-11T06:00:00+00:00',
      language: 'en',
      wake_time: '07:00',
      weekend_wake_time: null,
      sleep_hours: 8,
      morning_notif_time: '07:15',
      evening_notif_time: '22:00',
      wind_down_minutes: 30,
      morning_notif_enabled: true,
      evening_notif_enabled: true,
      wind_down_notif_enabled: true,
      block_reminders_enabled: true,
      theme: 'dark',
      google_calendar_connected: false,
      score_plan: true,
      score_rules: false,
      score_sleep: false,
    });
    const local = await saveSettings(db, LOCAL, { ...settingsInput, theme: 'light' }, testDeps('2026-11-11T07:00:00.000Z'));

    await syncOnce(db, remote, ids);
    expect((await getSettings(db, LOCAL))?.theme).toBe('light');
    expect(remote.rows('settings').map((row) => row.id)).toEqual([local.id]);
  });

  it('greška poslužitelja ostavlja red netaknut za sljedeći pokušaj', async () => {
    const { db, remote } = await setup();
    await syncOnce(db, remote, ids);
    await createBlock(db, LOCAL, blockInput, testDeps());
    const failing: RemoteStore = {
      fetchChanged: remote.fetchChanged.bind(remote),
      fetchTombstones: remote.fetchTombstones.bind(remote),
      remove: remote.remove.bind(remote),
      upsert: async () => {
        throw new Error('network');
      },
    };
    await expect(syncOnce(db, failing, ids)).rejects.toThrow('network');
    expect(countQueue(db)).toBe(1);
    await syncOnce(db, remote, ids);
    expect(countQueue(db)).toBe(0);
    expect(remote.rows('schedule_blocks')).toHaveLength(1);
  });

  describe('P1 audita: promjena računa na istom uređaju', () => {
    const UID_B = '22222222-2222-2222-2222-222222222222';
    const idsB = { localUserId: LOCAL, remoteUserId: UID_B };

    it('A → odjava → B: ništa se ne šalje u B ni ne povlači iz B; → A nastavlja normalno', async () => {
      const { db, remote: remoteA } = await setup();
      const remoteB = new FakeRemote();
      const deps = testDeps();
      const blockA = await createBlock(db, LOCAL, blockInput, deps);
      await syncOnce(db, remoteA, ids);
      expect(remoteA.rows('schedule_blocks').map((row) => row.id)).toEqual([blockA.id]);

      // Račun B ima svoje podatke na poslužitelju; lokalno nastaje još jedna izmjena.
      remoteB.put('schedule_blocks', remoteBlock('b-of-B', { user_id: UID_B }));
      const blockLater = await createBlock(db, LOCAL, { ...blockInput, title: 'Kasnije' }, deps);
      const queueBefore = readQueue(db);

      await expect(syncOnce(db, remoteB, idsB)).rejects.toBeInstanceOf(AccountMismatchError);
      expect(remoteB.rows('schedule_blocks').map((row) => row.id)).toEqual(['b-of-B']);
      expect(remoteB.calls).toEqual({ upsert: 0, remove: 0 });
      expect(await getBlock(db, LOCAL, 'b-of-B')).toBeNull();
      expect(readQueue(db)).toEqual(queueBefore);

      // Povratak na A: izmjena iz vremena B ide u A, bez ičega iz B.
      const back = await syncOnce(db, remoteA, ids);
      expect(back.seeded).toBe(false);
      expect(remoteA.rows('schedule_blocks').map((row) => row.id).sort()).toEqual([blockA.id, blockLater.id].sort());
      expect(remoteA.rows('schedule_blocks').every((row) => row.user_id === UID)).toBe(true);
      expect(countQueue(db)).toBe(0);
    });

    it('greška nosi oba računa (za poruku u Računu)', async () => {
      const { db, remote } = await setup();
      await syncOnce(db, remote, ids);
      const error = await syncOnce(db, new FakeRemote(), idsB).catch((caught: unknown) => caught);
      expect(error).toBeInstanceOf(AccountMismatchError);
      expect(error).toMatchObject({ boundRemoteUserId: UID, signedInRemoteUserId: UID_B });
    });
  });

  it('P2 audita: oznaka "viđeno" dijagnoze stiže na drugi uređaj', async () => {
    const remote = new FakeRemote();
    const { db: phone } = await createTestDb();
    const { db: tablet } = await createTestDb();
    phone
      .insert(reports)
      .values({
        id: 'r-1',
        userId: LOCAL,
        createdAt: '2026-11-11T20:00:00.000Z',
        updatedAt: '2026-11-11T20:00:00.000Z',
        period: 'day',
        periodStart: '2026-11-11',
        sections: {},
        stats: {},
        promptVersion: 'v1',
        seenAt: null,
      })
      .run();
    await syncOnce(phone, remote, ids);
    await syncOnce(tablet, remote, ids);
    expect((await getReport(tablet, LOCAL, 'day', '2026-11-11'))?.seenAt).toBeNull();

    expect(markReportSeen(phone, LOCAL, 'day', '2026-11-11', testDeps('2026-11-12T07:00:00.000Z'))).toBe(true);
    await syncOnce(phone, remote, ids);
    await syncOnce(tablet, remote, ids);
    expect((await getReport(tablet, LOCAL, 'day', '2026-11-11'))?.seenAt).toBe('2026-11-12T07:00:00.000Z');
  });

  describe('isti dan na dva uređaja (prirodni ključ checkina)', () => {
    const localCheckin = (updatedAt: string) => ({
      id: 'c-local',
      userId: LOCAL,
      createdAt: updatedAt,
      updatedAt,
      date: '2026-11-11',
      kind: 'evening' as const,
      sleepStart: null,
      wakeTime: null,
      mood: null,
      dayRating: 4,
      note: null,
      scoreAreas: null,
      gaveUp: false,
      gaveUpNote: null,
    });
    const remoteCheckin = (updatedAt: string): Row => ({
      id: 'c-remote',
      user_id: UID,
      created_at: updatedAt,
      updated_at: updatedAt,
      date: '2026-11-11',
      kind: 'evening',
      sleep_start: null,
      wake_time: null,
      mood: null,
      day_rating: 2,
      note: null,
      score_areas: null,
      gave_up: false,
      gave_up_note: null,
    });
    const remoteItem: Row = {
      id: 'i-remote',
      user_id: UID,
      created_at: '2026-11-11T20:00:00+00:00',
      updated_at: '2026-11-11T20:00:00+00:00',
      checkin_id: 'c-remote',
      kind: 'open-question',
      ref_id: null,
      ok: true,
      outcome: 'ok',
      comment: null,
      later_date: null,
      moved_block_id: null,
    };

    it('noviji remote zamjenjuje lokalni checkin (sa stavkama)', async () => {
      const { db, remote } = await setup();
      db.insert(checkins).values(localCheckin('2026-11-11T19:00:00.000Z')).run();
      remote.put('checkins', remoteCheckin('2026-11-11T20:00:00+00:00'));
      remote.put('checkin_items', remoteItem);

      await syncOnce(db, remote, ids);
      const rows = db.select().from(checkins).all();
      expect(rows.map((row) => [row.id, row.dayRating])).toEqual([['c-remote', 2]]);
      expect(remote.rows('checkins').map((row) => row.id)).toEqual(['c-remote']);
    });

    it('noviji lokalni ostaje, remote dan se briše, njegove stavke se ne primjenjuju', async () => {
      const { db, remote } = await setup();
      db.insert(checkins).values(localCheckin('2026-11-11T21:00:00.000Z')).run();
      remote.put('checkins', remoteCheckin('2026-11-11T20:00:00+00:00'));
      remote.put('checkin_items', remoteItem);

      const result = await syncOnce(db, remote, ids);
      expect(result.skipped).toBe(2);
      expect(db.select().from(checkins).all().map((row) => row.id)).toEqual(['c-local']);
      expect(remote.rows('checkins').map((row) => row.id)).toEqual(['c-local']);
    });
  });
});
