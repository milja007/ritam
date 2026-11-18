import { and, eq } from 'drizzle-orm';

import { goalSchema, MAX_GOALS_PER_PERIOD, type Goal, type GoalPeriod } from '@/core/domain';
import { nextGoalPosition, sortGoals } from '@/core/plans';

import type { RitamDb } from '../db';
import { goals } from '../schema';
import type { RitamTx } from './block-xp';
import { defaultRepoDeps, type RepoDeps } from './deps';

/** Razdoblje već ima `MAX_GOALS_PER_PERIOD` ciljeva — UI to javlja korisniku. */
export class GoalLimitError extends Error {
  constructor() {
    super('Too many goals in this period');
    this.name = 'GoalLimitError';
  }
}

function readPeriod(tx: RitamTx | RitamDb, userId: string, period: GoalPeriod, periodStart: string): Goal[] {
  return tx
    .select()
    .from(goals)
    .where(and(eq(goals.userId, userId), eq(goals.period, period), eq(goals.periodStart, periodStart)))
    .all()
    .map((row) => goalSchema.parse(row));
}

/** Ciljevi jednog razdoblja redom za prikaz (`sortGoals`). */
export function listGoals(db: RitamDb, userId: string, period: GoalPeriod, periodStart: string): Goal[] {
  return sortGoals(readPeriod(db, userId, period, periodStart));
}

/**
 * Novi cilj na kraju popisa razdoblja. Najviše `MAX_GOALS_PER_PERIOD` → `GoalLimitError`;
 * neispravan ulaz (prazan naslov, krivi početak razdoblja) baca `ZodError`. Ništa se ne zapisuje
 * kad baci.
 */
export function createGoal(
  db: RitamDb,
  userId: string,
  input: { period: GoalPeriod; periodStart: string; title: string },
  deps: RepoDeps = defaultRepoDeps,
): Goal {
  return db.transaction((tx) => {
    const existing = readPeriod(tx, userId, input.period, input.periodStart);
    if (existing.length >= MAX_GOALS_PER_PERIOD) throw new GoalLimitError();
    const now = deps.now().toISOString();
    const goal = goalSchema.parse({
      id: deps.newId(),
      userId,
      createdAt: now,
      updatedAt: now,
      period: input.period,
      periodStart: input.periodStart,
      title: input.title,
      position: nextGoalPosition(existing),
      doneOn: null,
    });
    tx.insert(goals).values(goal).run();
    return goal;
  });
}

function change(
  db: RitamDb,
  userId: string,
  id: string,
  deps: RepoDeps,
  apply: (goal: Goal) => Partial<Pick<Goal, 'title' | 'doneOn'>>,
): Goal | null {
  return db.transaction((tx) => {
    const row = tx
      .select()
      .from(goals)
      .where(and(eq(goals.userId, userId), eq(goals.id, id)))
      .get();
    if (!row) return null;
    const previous = goalSchema.parse(row);
    const patch = apply(previous);
    if (Object.entries(patch).every(([key, value]) => previous[key as keyof Goal] === value)) return previous;
    const next = goalSchema.parse({ ...previous, ...patch, updatedAt: deps.now().toISOString() });
    tx.update(goals)
      .set({ title: next.title, doneOn: next.doneOn, updatedAt: next.updatedAt })
      .where(and(eq(goals.userId, userId), eq(goals.id, id)))
      .run();
    return next;
  });
}

/** Preimenuj cilj; `null` ako ga nema. Isti naslov ne piše ništa (bez nepotrebnog synca). */
export function renameGoal(
  db: RitamDb,
  userId: string,
  id: string,
  title: string,
  deps: RepoDeps = defaultRepoDeps,
): Goal | null {
  return change(db, userId, id, deps, () => ({ title: title.trim() }));
}

/**
 * Označi cilj ostvarenim na dan `on` ili ga vrati (`on = null`). Već ostvaren cilj zadržava svoj
 * prvi dan; ponovno označavanje ne piše ništa.
 */
export function setGoalDone(
  db: RitamDb,
  userId: string,
  id: string,
  on: string | null,
  deps: RepoDeps = defaultRepoDeps,
): Goal | null {
  return change(db, userId, id, deps, (goal) => ({ doneOn: on === null ? null : (goal.doneOn ?? on) }));
}

/** Obriši cilj; `false` ako ga nema. */
export function deleteGoal(db: RitamDb, userId: string, id: string): boolean {
  const result = db
    .delete(goals)
    .where(and(eq(goals.userId, userId), eq(goals.id, id)))
    .run();
  return result.changes > 0;
}
