/**
 * @jest-environment node
 */
import { describe, expect, it } from '@jest/globals';

import { mainStreak } from '@/core/gamification';

import {
  getMorningCheckin,
  InvalidMorningCheckinError,
  listXpEvents,
  saveMorningCheckin,
} from './repos';
import { checkins } from './schema';
import { createTestDb, testDeps } from './testing/test-db';

const USER = 'user-1';
const DATE = '2026-11-10'; // utorak
const settings = { wakeTime: '07:00', weekendWakeTime: null, sleepHours: 8 };

describe('morning check-in repo', () => {
  it('returns null before anything is saved', async () => {
    const { db } = await createTestDb();
    expect(await getMorningCheckin(db, USER, DATE)).toBeNull();
  });

  it('saves sleep times and awards the on-time bedtime bonus', async () => {
    const { db } = await createTestDb();
    const deps = testDeps('2026-11-10T06:00:00.000Z');
    const result = saveMorningCheckin(
      db,
      USER,
      settings,
      { date: DATE, sleepStart: '23:15', wakeTime: '07:00' },
      deps,
    );
    expect(result.xpEarned).toBe(20);
    const saved = await getMorningCheckin(db, USER, DATE);
    expect(saved).toMatchObject({
      kind: 'morning',
      date: DATE,
      sleepStart: '23:15',
      wakeTime: '07:00',
      mood: null,
      dayRating: null,
    });
    const xp = await listXpEvents(db, USER);
    expect(xp).toEqual([
      expect.objectContaining({ source: 'sleep', amount: 20, sourceId: saved?.id, date: DATE }),
    ]);
  });

  it('updates the same row on re-save and replaces its XP', async () => {
    const { db } = await createTestDb();
    const deps = testDeps('2026-11-10T06:00:00.000Z');
    const first = saveMorningCheckin(
      db,
      USER,
      settings,
      { date: DATE, sleepStart: '23:00', wakeTime: '07:00' },
      deps,
    );
    const second = saveMorningCheckin(
      db,
      USER,
      settings,
      { date: DATE, sleepStart: '01:00', wakeTime: '07:30' },
      deps,
    );
    expect(second.checkin.id).toBe(first.checkin.id);
    expect(second.xpEarned).toBe(0);
    const rows = await db.select().from(checkins).all();
    expect(rows).toHaveLength(1);
    expect(await listXpEvents(db, USER)).toEqual([]);

    saveMorningCheckin(db, USER, settings, { date: DATE, sleepStart: '22:45', wakeTime: '07:00' }, deps);
    expect((await listXpEvents(db, USER)).map((e) => e.amount)).toEqual([20]);
  });

  it('rejects an invalid draft without writing', async () => {
    const { db } = await createTestDb();
    expect(() =>
      saveMorningCheckin(db, USER, settings, { date: DATE, sleepStart: '07:00', wakeTime: '07:00' }),
    ).toThrow(InvalidMorningCheckinError);
    expect(await db.select().from(checkins).all()).toEqual([]);
  });

  it('does not count towards the main streak', async () => {
    const { db } = await createTestDb();
    saveMorningCheckin(
      db,
      USER,
      settings,
      { date: DATE, sleepStart: '23:00', wakeTime: '07:00' },
      testDeps(),
    );
    const rows = await db.select().from(checkins).all();
    expect(mainStreak(rows, DATE).current).toBe(0);
  });
});
