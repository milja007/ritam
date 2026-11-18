/**
 * @jest-environment node
 */
import { describe, expect, it } from '@jest/globals';
import { ZodError } from 'zod';

import { MAX_GOALS_PER_PERIOD } from '@/core/domain';

import { GoalLimitError, createGoal, deleteGoal, listGoals, renameGoal, setGoalDone } from './repos';
import { readQueue } from './sync';
import { createTestDb, testDeps } from './testing/test-db';

const USER = 'user-1';
const WEEK = { period: 'week' as const, periodStart: '2026-11-16' };

async function setup() {
  const { db } = await createTestDb();
  return { db, deps: testDeps('2026-11-18T10:00:00.000Z') };
}

describe('ciljevi razdoblja (repo)', () => {
  it('stvara ciljeve redom, odvojeno po razdoblju i korisniku, i bilježi ih za sync', async () => {
    const { db, deps } = await setup();
    const first = createGoal(db, USER, { ...WEEK, title: ' Tri treninga ' }, deps);
    const second = createGoal(db, USER, { ...WEEK, title: 'Pročitati 50 stranica' }, deps);
    createGoal(db, USER, { period: 'month', periodStart: '2026-11-01', title: 'Mjesečni' }, deps);
    createGoal(db, 'user-2', { ...WEEK, title: 'Tuđi' }, deps);
    createGoal(db, USER, { period: 'week', periodStart: '2026-11-23', title: 'Sljedeći tjedan' }, deps);

    expect(first).toMatchObject({ title: 'Tri treninga', position: 0, doneOn: null });
    expect(second.position).toBe(1);
    expect(listGoals(db, USER, 'week', '2026-11-16').map((goal) => goal.title)).toEqual([
      'Tri treninga',
      'Pročitati 50 stranica',
    ]);
    expect(listGoals(db, USER, 'month', '2026-11-01')).toHaveLength(1);
    expect(readQueue(db).filter((entry) => entry.tableName === 'goals')).toHaveLength(5);
  });

  it('neispravan ulaz i prekoračenje ne zapisuju ništa', async () => {
    const { db, deps } = await setup();
    expect(() => createGoal(db, USER, { ...WEEK, title: '   ' }, deps)).toThrow(ZodError);
    expect(() => createGoal(db, USER, { period: 'week', periodStart: '2026-11-17', title: 'X' }, deps)).toThrow(
      ZodError,
    );
    for (let index = 0; index < MAX_GOALS_PER_PERIOD; index += 1) {
      createGoal(db, USER, { ...WEEK, title: `Cilj ${index}` }, deps);
    }
    expect(() => createGoal(db, USER, { ...WEEK, title: 'Previše' }, deps)).toThrow(GoalLimitError);
    expect(listGoals(db, USER, 'week', '2026-11-16')).toHaveLength(MAX_GOALS_PER_PERIOD);
  });

  it('označi / vrati: prvi dan ostvarenja ostaje, ponavljanje ne piše ništa', async () => {
    const { db, deps } = await setup();
    const goal = createGoal(db, USER, { ...WEEK, title: 'Tri treninga' }, deps);
    expect(setGoalDone(db, USER, goal.id, '2026-11-18', deps)?.doneOn).toBe('2026-11-18');
    const before = readQueue(db).find((entry) => entry.rowId === goal.id)?.version;
    expect(setGoalDone(db, USER, goal.id, '2026-11-19', deps)?.doneOn).toBe('2026-11-18');
    expect(readQueue(db).find((entry) => entry.rowId === goal.id)?.version).toBe(before);
    expect(setGoalDone(db, USER, goal.id, null, deps)?.doneOn).toBeNull();
    expect(setGoalDone(db, USER, 'nema', '2026-11-18', deps)).toBeNull();
    expect(setGoalDone(db, 'user-2', goal.id, '2026-11-18', deps)).toBeNull();
  });

  it('preimenovanje i brisanje samo vlastitog cilja', async () => {
    const { db, deps } = await setup();
    const goal = createGoal(db, USER, { ...WEEK, title: 'Tri treninga' }, deps);
    expect(renameGoal(db, USER, goal.id, ' Četiri treninga ', deps)?.title).toBe('Četiri treninga');
    expect(() => renameGoal(db, USER, goal.id, ' ', deps)).toThrow(ZodError);
    expect(listGoals(db, USER, 'week', '2026-11-16')[0]?.title).toBe('Četiri treninga');
    expect(deleteGoal(db, 'user-2', goal.id)).toBe(false);
    expect(deleteGoal(db, USER, goal.id)).toBe(true);
    expect(listGoals(db, USER, 'week', '2026-11-16')).toEqual([]);
    expect(readQueue(db)).toEqual([expect.objectContaining({ tableName: 'goals', rowId: goal.id, op: 'delete' })]);
  });
});
