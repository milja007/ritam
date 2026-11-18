/**
 * @jest-environment node
 */
import { describe, expect, it } from '@jest/globals';
import { ZodError } from 'zod';

import { MAX_TASKS_PER_WEEK, type TaskInput } from '@/core/domain';

import { TaskLimitError, createBlocks, createTask, deleteTask, getBlock, listTasks, updateTask } from './repos';
import { readQueue } from './sync';
import { createTestDb, testDeps } from './testing/test-db';

const USER = 'user-1';
const input: TaskInput = {
  weekStart: '2026-11-16',
  title: ' Trening ',
  durationMinutes: 60,
  timesPerWeek: 3,
  deadline: null,
  partOfDay: 'evening',
  energy: 'high',
  needs: '',
};

async function setup() {
  const { db } = await createTestDb();
  return { db, deps: testDeps('2026-11-18T10:00:00.000Z') };
}

describe('tjedni zadaci (repo)', () => {
  it('stvara zadatke redom unosa, odvojeno po tjednu i korisniku, i bilježi ih za sync', async () => {
    const { db, deps } = await setup();
    const first = createTask(db, USER, input, deps);
    createTask(
      db,
      USER,
      {
        ...input,
        title: 'Kemija',
        deadline: '2026-11-20',
        partOfDay: 'any',
        energy: 'medium',
      },
      deps,
    );
    createTask(db, USER, { ...input, weekStart: '2026-11-23', title: 'Sljedeći' }, deps);
    createTask(db, 'user-2', { ...input, title: 'Tuđi' }, deps);

    expect(first).toMatchObject({
      title: 'Trening',
      timesPerWeek: 3,
      needs: '',
    });
    expect(listTasks(db, USER, '2026-11-16').map((task) => task.title)).toEqual(['Trening', 'Kemija']);
    expect(listTasks(db, USER, '2026-11-23')).toHaveLength(1);
    expect(readQueue(db).filter((entry) => entry.tableName === 'tasks')).toHaveLength(4);
  });

  it('neispravan ulaz i prekoračenje ne zapisuju ništa', async () => {
    const { db, deps } = await setup();
    expect(() => createTask(db, USER, { ...input, title: ' ' }, deps)).toThrow(ZodError);
    expect(() => createTask(db, USER, { ...input, weekStart: '2026-11-17' }, deps)).toThrow(ZodError);
    expect(() => createTask(db, USER, { ...input, deadline: '2026-11-23' }, deps)).toThrow(ZodError);
    for (let index = 0; index < MAX_TASKS_PER_WEEK; index += 1) {
      createTask(db, USER, { ...input, title: `Zadatak ${index}` }, deps);
    }
    expect(() => createTask(db, USER, { ...input, title: 'Previše' }, deps)).toThrow(TaskLimitError);
    expect(listTasks(db, USER, '2026-11-16')).toHaveLength(MAX_TASKS_PER_WEEK);
  });

  it('izmjena: samo vlastiti, ista vrijednost ne piše, neispravno baca', async () => {
    const { db, deps } = await setup();
    const task = createTask(db, USER, input, deps);
    const updated = updateTask(
      db,
      USER,
      task.id,
      { timesPerWeek: 2, deadline: '2026-11-21', needs: ' Tenisice ' },
      deps,
    );
    expect(updated).toMatchObject({
      timesPerWeek: 2,
      deadline: '2026-11-21',
      needs: 'Tenisice',
    });
    const version = readQueue(db).find((entry) => entry.rowId === task.id)?.version;
    expect(updateTask(db, USER, task.id, { timesPerWeek: 2 }, deps)).toEqual(updated);
    expect(readQueue(db).find((entry) => entry.rowId === task.id)?.version).toBe(version);
    expect(() => updateTask(db, USER, task.id, { durationMinutes: 1 }, deps)).toThrow(ZodError);
    expect(updateTask(db, 'user-2', task.id, { title: 'hack' }, deps)).toBeNull();
    expect(listTasks(db, USER, '2026-11-16')[0]).toMatchObject({
      title: 'Trening',
      timesPerWeek: 2,
    });
  });

  it('brisanje zadatka ostavlja smještene blokove, samo bez veze', async () => {
    const { db, deps } = await setup();
    const task = createTask(db, USER, input, deps);
    const [block] = createBlocks(
      db,
      USER,
      [
        {
          date: '2026-11-19',
          title: 'Trening',
          start: '18:00',
          end: '19:00',
          taskId: task.id,
          kind: 'task',
          source: 'user',
          status: 'done',
        },
      ],
      deps,
    );
    expect(deleteTask(db, 'user-2', task.id, deps)).toBe(false);
    expect(deleteTask(db, USER, task.id, deps)).toBe(true);
    expect(listTasks(db, USER, '2026-11-16')).toEqual([]);
    expect(await getBlock(db, USER, block!.id)).toMatchObject({
      taskId: null,
      status: 'done',
      title: 'Trening',
    });
    expect(deleteTask(db, USER, task.id, deps)).toBe(false);
  });
});
