/**
 * @jest-environment node
 */
import { beforeEach, describe, expect, it, jest } from '@jest/globals';

import { LOCAL_USER_ID } from '@/core/user/local-user';
import type { RitamDb } from '@/db/db';
import { createBlocks, createGoal, createRule, createTask } from '@/db/repos';
import { createTestDb, testDeps } from '@/db/testing/test-db';

let mockDb: RitamDb | null = null;
jest.mock('@/db/open', () => ({
  getDb: () => {
    if (mockDb === null) throw new Error('no db');
    return mockDb;
  },
}));

// eslint-disable-next-line import/first -- modul se uvozi nakon mocka
import { loadPlanContext } from './plan-context';

describe('loadPlanContext (korak 26)', () => {
  beforeEach(() => {
    mockDb = null;
  });

  it('čita ciljeve, zadatke tjedna i zabrane za dan', async () => {
    const { db } = await createTestDb();
    mockDb = db;
    const deps = testDeps('2026-11-18T10:00:00.000Z');
    createGoal(db, LOCAL_USER_ID, { period: 'week', periodStart: '2026-11-16', title: 'Tri treninga' }, deps);
    createGoal(db, LOCAL_USER_ID, { period: 'month', periodStart: '2026-11-01', title: 'Seminar' }, deps);
    const task = createTask(
      db,
      LOCAL_USER_ID,
      {
        weekStart: '2026-11-16',
        title: 'Trening',
        durationMinutes: 60,
        timesPerWeek: 2,
        deadline: null,
        partOfDay: 'evening',
        energy: 'high',
        needs: '',
      },
      deps,
    );
    createBlocks(
      db,
      LOCAL_USER_ID,
      [
        {
          date: '2026-11-17',
          title: 'Trening',
          note: null,
          start: '18:00',
          end: '19:00',
          kind: 'task',
          taskId: task.id,
          source: 'user',
          status: 'done',
        },
      ],
      deps,
    );
    await createRule(
      db,
      LOCAL_USER_ID,
      {
        title: 'Bez slatkiša',
        icon: null,
        activeDays: [4],
        activeHours: null,
        why: 'Zdravlje',
        weight: 2,
        period: 'week',
        periodStart: '2026-11-16',
      },
      deps,
    );

    const loaded = await loadPlanContext('2026-11-19');
    expect(loaded.context.goals.map((goal) => goal.title)).toEqual(['Tri treninga', 'Seminar']);
    expect(loaded.context.tasks).toEqual([
      { title: 'Trening', durationMinutes: 60, timesLeft: 1, partOfDay: 'evening', energy: 'high', deadline: null, needs: '' },
    ]);
    expect(loaded.context.rules).toEqual([{ title: 'Bez slatkiša', why: 'Zdravlje' }]);
    expect(loaded.tasks).toEqual([{ id: task.id, title: 'Trening' }]);
    // Petak: zabrana vrijedi samo četvrtkom.
    expect((await loadPlanContext('2026-11-20')).context.rules).toEqual([]);
  });

  it('greška čitanja → prazan kontekst, slaganje ide dalje', async () => {
    const warn = jest.spyOn(console, 'warn').mockImplementation(() => undefined);
    expect(await loadPlanContext('2026-11-19')).toEqual({ context: { goals: [], tasks: [], rules: [] }, tasks: [] });
    warn.mockRestore();
  });
});
