import { and, eq } from 'drizzle-orm';

import { MAX_TASKS_PER_WEEK, taskSchema, type Task, type TaskInput } from '@/core/domain';

import type { RitamDb } from '../db';
import { scheduleBlocks, tasks } from '../schema';
import type { RitamTx } from './block-xp';
import { defaultRepoDeps, type RepoDeps } from './deps';

/** Tjedan već ima `MAX_TASKS_PER_WEEK` zadataka — UI to javlja korisniku. */
export class TaskLimitError extends Error {
  constructor() {
    super('Too many tasks in this week');
    this.name = 'TaskLimitError';
  }
}

function readWeek(tx: RitamTx | RitamDb, userId: string, weekStart: string): Task[] {
  return tx
    .select()
    .from(tasks)
    .where(and(eq(tasks.userId, userId), eq(tasks.weekStart, weekStart)))
    .all()
    .map((row) => taskSchema.parse(row));
}

/** Zadaci tjedna redom unosa (`createdAt`, pa `id`). */
export function listTasks(db: RitamDb, userId: string, weekStart: string): Task[] {
  return readWeek(db, userId, weekStart).sort(
    (a, b) => a.createdAt.localeCompare(b.createdAt) || a.id.localeCompare(b.id),
  );
}

/**
 * Novi tjedni zadatak. Najviše `MAX_TASKS_PER_WEEK` → `TaskLimitError`; neispravan ulaz (prazan
 * naslov, rok izvan tjedna, tjedan ne počinje ponedjeljkom) baca `ZodError`. Ništa se ne zapisuje
 * kad baci.
 */
export function createTask(db: RitamDb, userId: string, input: TaskInput, deps: RepoDeps = defaultRepoDeps): Task {
  return db.transaction((tx) => {
    if (readWeek(tx, userId, input.weekStart).length >= MAX_TASKS_PER_WEEK) throw new TaskLimitError();
    const now = deps.now().toISOString();
    const task = taskSchema.parse({
      ...input,
      id: deps.newId(),
      userId,
      createdAt: now,
      updatedAt: now,
    });
    tx.insert(tasks).values(task).run();
    return task;
  });
}

type TaskPatch = Partial<Omit<TaskInput, 'weekStart'>>;

/**
 * Promijeni odgovore zadatka (tjedan ostaje); `null` ako ga nema. Bez stvarne promjene ne piše
 * ništa (bez praznog synca). Već smješteni blokovi ostaju kakvi jesu.
 */
export function updateTask(
  db: RitamDb,
  userId: string,
  id: string,
  patch: TaskPatch,
  deps: RepoDeps = defaultRepoDeps,
): Task | null {
  return db.transaction((tx) => {
    const row = tx
      .select()
      .from(tasks)
      .where(and(eq(tasks.userId, userId), eq(tasks.id, id)))
      .get();
    if (!row) return null;
    const previous = taskSchema.parse(row);
    const candidate = taskSchema.parse({
      ...previous,
      ...patch,
      updatedAt: previous.updatedAt,
    });
    const keys = Object.keys(patch) as (keyof TaskPatch)[];
    if (keys.every((key) => candidate[key] === previous[key])) return previous;
    const next = { ...candidate, updatedAt: deps.now().toISOString() };
    tx.update(tasks)
      .set({
        title: next.title,
        durationMinutes: next.durationMinutes,
        timesPerWeek: next.timesPerWeek,
        deadline: next.deadline,
        partOfDay: next.partOfDay,
        energy: next.energy,
        needs: next.needs,
        updatedAt: next.updatedAt,
      })
      .where(and(eq(tasks.userId, userId), eq(tasks.id, id)))
      .run();
    return next;
  });
}

/**
 * Obriši zadatak; `false` ako ga nema. Smješteni blokovi ostaju na timelineu (korisnik ih je
 * odobrio, možda su već odrađeni i nose XP) — samo izgube vezu (`task_id = null`).
 */
export function deleteTask(db: RitamDb, userId: string, id: string, deps: RepoDeps = defaultRepoDeps): boolean {
  return db.transaction((tx) => {
    const result = tx
      .delete(tasks)
      .where(and(eq(tasks.userId, userId), eq(tasks.id, id)))
      .run();
    if (result.changes === 0) return false;
    tx.update(scheduleBlocks)
      .set({ taskId: null, updatedAt: deps.now().toISOString() })
      .where(and(eq(scheduleBlocks.userId, userId), eq(scheduleBlocks.taskId, id)))
      .run();
    return true;
  });
}
