/**
 * @jest-environment node
 */
import { describe, expect, it } from '@jest/globals';
import { ZodError } from 'zod';

import { createDefaultDraft, toSettingsInput } from '@/core/onboarding';

import { addTrackerEntry, deleteTrackerEntry, getSettings, listTrackerEntries, saveSettings } from './repos';
import { readQueue } from './sync';
import { createTestDb, testDeps } from './testing/test-db';

const USER = 'user-1';

async function setup() {
  const { db } = await createTestDb();
  return { db, deps: testDeps('2026-11-18T10:00:00.000Z') };
}

describe('trackeri (repo, korak 31b)', () => {
  it('sprema unose po danu i korisniku, redom, i bilježi ih za sync', async () => {
    const { db, deps } = await setup();
    addTrackerEntry(db, USER, { date: '2026-11-18', kind: 'calories', amount: 650, note: ' Ručak ' }, deps);
    addTrackerEntry(db, USER, { date: '2026-11-18', kind: 'money', amount: 1250, note: 'Kava' }, deps);
    addTrackerEntry(db, USER, { date: '2026-11-17', kind: 'money', amount: 500, note: '' }, deps);
    addTrackerEntry(db, 'user-2', { date: '2026-11-18', kind: 'money', amount: 999, note: '' }, deps);

    const today = listTrackerEntries(db, USER, '2026-11-18', '2026-11-18');
    expect(today.map((entry) => [entry.kind, entry.amount, entry.note])).toEqual([
      ['calories', 650, 'Ručak'],
      ['money', 1250, 'Kava'],
    ]);
    expect(listTrackerEntries(db, USER, '2026-11-16', '2026-11-22').map((entry) => entry.date)).toEqual([
      '2026-11-17',
      '2026-11-18',
      '2026-11-18',
    ]);
    expect(readQueue(db).filter((entry) => entry.tableName === 'tracker_entries')).toHaveLength(4);
  });

  it('neispravan unos se ne zapisuje', async () => {
    const { db, deps } = await setup();
    const bad = [
      { date: '2026-11-18', kind: 'money' as const, amount: 0, note: '' },
      { date: '2026-11-18', kind: 'calories' as const, amount: 10_001, note: '' },
      { date: '2026-11-18', kind: 'money' as const, amount: 1.5, note: '' },
      { date: '2026-11-18', kind: 'money' as const, amount: 100, note: 'x'.repeat(201) },
      { date: '18.11.2026', kind: 'money' as const, amount: 100, note: '' },
    ];
    for (const input of bad) expect(() => addTrackerEntry(db, USER, input, deps)).toThrow(ZodError);
    expect(listTrackerEntries(db, USER, '2000-01-01', '2100-01-01')).toHaveLength(0);
  });

  it('briše samo vlastiti unos', async () => {
    const { db, deps } = await setup();
    const entry = addTrackerEntry(db, USER, { date: '2026-11-18', kind: 'money', amount: 100, note: '' }, deps);
    expect(deleteTrackerEntry(db, 'user-2', entry.id)).toBe(false);
    expect(deleteTrackerEntry(db, USER, entry.id)).toBe(true);
    expect(deleteTrackerEntry(db, USER, entry.id)).toBe(false);
    expect(readQueue(db).find((row) => row.rowId === entry.id)?.op).toBe('delete');
  });

  it('postavke: trackeri su zadano isključeni, uključuju se s ciljem i limitom', async () => {
    const { db, deps } = await setup();
    const base = toSettingsInput(createDefaultDraft('hr'));
    await saveSettings(db, USER, base, deps);
    expect(await getSettings(db, USER)).toMatchObject({ trackCalories: false, calorieGoal: null, trackMoney: false });

    await saveSettings(
      db,
      USER,
      {
        ...base,
        trackCalories: true,
        calorieGoal: 2200,
        trackMoney: true,
        moneyLimitCents: 10_000,
        moneyPeriod: 'week',
        moneyBalanceCents: -2_500,
        moneyBalanceOn: '2026-11-16',
      },
      deps,
    );
    expect(await getSettings(db, USER)).toMatchObject({
      trackCalories: true,
      calorieGoal: 2200,
      moneyPeriod: 'week',
      moneyBalanceCents: -2_500,
    });
    await expect(saveSettings(db, USER, { ...base, calorieGoal: 100 }, deps)).rejects.toThrow(ZodError);
  });
});
