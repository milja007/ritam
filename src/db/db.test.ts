/**
 * @jest-environment node
 */
import { describe, expect, it } from '@jest/globals';
import { migrate } from 'drizzle-orm/expo-sqlite/migrator';
import { ZodError } from 'zod';

import migrations from './migrations/migrations';

import {
  createBlock,
  deleteBlock,
  deleteSettings,
  getBlock,
  getSettings,
  listBlocksForDate,
  saveSettings,
  updateBlock,
  type ScheduleBlockInput,
  type SettingsInput,
} from './repos';
import { createTestDb, testDeps } from './testing/test-db';

const USER = 'user-1';
const OTHER = 'user-2';

const settingsInput: SettingsInput = {
  language: 'hr',
  wakeTime: '06:30',
  sleepHours: 7.5,
  morningNotifTime: '06:45',
  eveningNotifTime: '21:00',
  windDownMinutes: 45,
  theme: 'system',
  googleCalendarConnected: false,
};

const block = (overrides: Partial<ScheduleBlockInput> = {}): ScheduleBlockInput => ({
  date: '2026-11-08',
  title: 'Duboki rad',
  start: '09:00',
  end: '10:30',
  taskId: null,
  kind: 'task',
  source: 'user',
  status: 'planned',
  ...overrides,
});

describe('migracije', () => {
  it('stvaraju svih 7 tablica', async () => {
    const { raw } = await createTestDb();
    const tables = raw
      .prepare("SELECT name FROM sqlite_master WHERE type = 'table' AND name NOT LIKE '\\_%' ESCAPE '\\' AND name NOT LIKE 'sqlite_%' ORDER BY name")
      .all()
      .map((row) => row.name);
    expect(tables).toEqual([
      'checkin_items',
      'checkins',
      'rule_logs',
      'rules',
      'schedule_blocks',
      'settings',
      'xp_events',
    ]);
  });

  it('su idempotentne (drugo pokretanje ne pada)', async () => {
    const { db } = await createTestDb();
    await expect(migrate(db, migrations)).resolves.toBeUndefined();
  });

  it('uključuju strane ključeve', async () => {
    const { raw } = await createTestDb();
    expect(raw.prepare('PRAGMA foreign_keys').get()).toEqual({ foreign_keys: 1 });
    expect(() =>
      raw
        .prepare(
          "INSERT INTO checkin_items (id, user_id, created_at, updated_at, checkin_id, kind, ok) VALUES ('x', 'u', 't', 't', 'nema', 'task', 1)",
        )
        .run(),
    ).toThrow(/FOREIGN KEY/);
  });
});

describe('settings repo', () => {
  it('vraća null prije spremanja', async () => {
    const { db } = await createTestDb();
    expect(await getSettings(db, USER)).toBeNull();
  });

  it('sprema i čita postavke (round-trip, uključujući boolean i decimalne sate)', async () => {
    const { db } = await createTestDb();
    const saved = await saveSettings(db, USER, settingsInput, testDeps());
    expect(saved).toMatchObject({ ...settingsInput, id: 'id-1', userId: USER });
    expect(await getSettings(db, USER)).toEqual(saved);
  });

  it('drugo spremanje ažurira isti red: id i createdAt ostaju, updatedAt se mijenja', async () => {
    const { db, raw } = await createTestDb();
    const deps = testDeps();
    const first = await saveSettings(db, USER, settingsInput, deps);
    const second = await saveSettings(db, USER, { ...settingsInput, language: 'en' }, deps);
    expect(second.id).toBe(first.id);
    expect(second.createdAt).toBe(first.createdAt);
    expect(second.updatedAt > first.updatedAt).toBe(true);
    expect((await getSettings(db, USER))?.language).toBe('en');
    expect(raw.prepare('SELECT COUNT(*) AS n FROM settings').get()).toEqual({ n: 1 });
  });

  it('postavke su po korisniku', async () => {
    const { db } = await createTestDb();
    const deps = testDeps();
    await saveSettings(db, USER, settingsInput, deps);
    expect(await getSettings(db, OTHER)).toBeNull();
    await saveSettings(db, OTHER, { ...settingsInput, theme: 'dark' }, deps);
    expect((await getSettings(db, USER))?.theme).toBe('system');
    expect((await getSettings(db, OTHER))?.theme).toBe('dark');
  });

  it('neispravan ulaz baca ZodError i ništa ne zapisuje', async () => {
    const { db } = await createTestDb();
    await expect(
      saveSettings(db, USER, { ...settingsInput, wakeTime: '25:00' }, testDeps()),
    ).rejects.toBeInstanceOf(ZodError);
    await expect(
      saveSettings(db, USER, { ...settingsInput, sleepHours: 7.3 }, testDeps()),
    ).rejects.toBeInstanceOf(ZodError);
    expect(await getSettings(db, USER)).toBeNull();
  });

  it('neispravno ažuriranje ne mijenja postojeće postavke', async () => {
    const { db } = await createTestDb();
    const deps = testDeps();
    const saved = await saveSettings(db, USER, settingsInput, deps);
    await expect(
      saveSettings(db, USER, { ...settingsInput, windDownMinutes: -5 }, deps),
    ).rejects.toBeInstanceOf(ZodError);
    expect(await getSettings(db, USER)).toEqual(saved);
  });

  it('briše postavke', async () => {
    const { db } = await createTestDb();
    await saveSettings(db, USER, settingsInput, testDeps());
    expect(await deleteSettings(db, USER)).toBe(true);
    expect(await getSettings(db, USER)).toBeNull();
    expect(await deleteSettings(db, USER)).toBe(false);
  });
});

describe('schedule_blocks repo', () => {
  it('stvara i čita blok', async () => {
    const { db } = await createTestDb();
    const created = await createBlock(db, USER, block(), testDeps());
    expect(created).toMatchObject({ ...block(), id: 'id-1', userId: USER });
    expect(created.createdAt).toBe(created.updatedAt);
    expect(await getBlock(db, USER, created.id)).toEqual(created);
  });

  it('čuva null taskId i san preko ponoći', async () => {
    const { db } = await createTestDb();
    const sleep = await createBlock(
      db,
      USER,
      block({ title: 'San', start: '23:00', end: '06:30', kind: 'sleep' }),
      testDeps(),
    );
    expect(await getBlock(db, USER, sleep.id)).toEqual(sleep);
  });

  it('odbija neispravan blok (kraj prije početka, loš datum) bez zapisa', async () => {
    const { db } = await createTestDb();
    const deps = testDeps();
    await expect(createBlock(db, USER, block({ end: '08:00' }), deps)).rejects.toBeInstanceOf(
      ZodError,
    );
    await expect(
      createBlock(db, USER, block({ date: '2026-02-30' }), deps),
    ).rejects.toBeInstanceOf(ZodError);
    await expect(createBlock(db, USER, block({ title: '  ' }), deps)).rejects.toBeInstanceOf(
      ZodError,
    );
    expect(await listBlocksForDate(db, USER, '2026-11-08')).toEqual([]);
  });

  it('lista dana: samo taj dan i korisnik, poredano po početku', async () => {
    const { db } = await createTestDb();
    const deps = testDeps();
    await createBlock(db, USER, block({ title: 'Teretana', start: '18:00', end: '19:00' }), deps);
    await createBlock(db, USER, block({ title: 'Doručak', start: '07:00', end: '07:30' }), deps);
    await createBlock(db, USER, block({ title: 'Sutra', date: '2026-11-09' }), deps);
    await createBlock(db, OTHER, block({ title: 'Tuđi' }), deps);
    await createBlock(db, USER, block({ title: 'Rad', start: '09:00', end: '12:00' }), deps);
    const titles = (await listBlocksForDate(db, USER, '2026-11-08')).map((b) => b.title);
    expect(titles).toEqual(['Doručak', 'Rad', 'Teretana']);
  });

  it('ažurira dio polja i osvježava updatedAt', async () => {
    const { db } = await createTestDb();
    const deps = testDeps();
    const created = await createBlock(db, USER, block(), deps);
    const updated = await updateBlock(db, USER, created.id, { status: 'done', end: '11:00' }, deps);
    expect(updated).toMatchObject({ status: 'done', end: '11:00', title: 'Duboki rad' });
    expect(updated?.createdAt).toBe(created.createdAt);
    expect(updated && updated.updatedAt > created.updatedAt).toBe(true);
    expect(await getBlock(db, USER, created.id)).toEqual(updated);
  });

  it('ignorira undefined u patchu', async () => {
    const { db } = await createTestDb();
    const deps = testDeps();
    const created = await createBlock(db, USER, block(), deps);
    const updated = await updateBlock(db, USER, created.id, { title: undefined }, deps);
    expect(updated?.title).toBe('Duboki rad');
  });

  it('neispravan patch ne mijenja blok', async () => {
    const { db } = await createTestDb();
    const deps = testDeps();
    const created = await createBlock(db, USER, block(), deps);
    await expect(
      updateBlock(db, USER, created.id, { start: '11:00' }, deps),
    ).rejects.toBeInstanceOf(ZodError);
    expect(await getBlock(db, USER, created.id)).toEqual(created);
  });

  it('ne vidi, ne mijenja i ne briše tuđe ili nepostojeće blokove', async () => {
    const { db } = await createTestDb();
    const deps = testDeps();
    const created = await createBlock(db, USER, block(), deps);
    expect(await getBlock(db, OTHER, created.id)).toBeNull();
    expect(await updateBlock(db, OTHER, created.id, { status: 'done' }, deps)).toBeNull();
    expect(await updateBlock(db, USER, 'nema', { status: 'done' }, deps)).toBeNull();
    expect(await deleteBlock(db, OTHER, created.id)).toBe(false);
    expect((await getBlock(db, USER, created.id))?.status).toBe('planned');
  });

  it('briše blok', async () => {
    const { db } = await createTestDb();
    const created = await createBlock(db, USER, block(), testDeps());
    expect(await deleteBlock(db, USER, created.id)).toBe(true);
    expect(await getBlock(db, USER, created.id)).toBeNull();
    expect(await deleteBlock(db, USER, created.id)).toBe(false);
  });
});
