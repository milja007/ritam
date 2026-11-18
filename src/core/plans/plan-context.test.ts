import { describe, expect, it } from '@jest/globals';

import type { Goal, Rule, Task } from '../domain';
import { contextTaskRefs, isPlanContextEmpty, planDayContext } from './plan-context';

const base = { userId: 'u', createdAt: '2026-11-16T08:00:00.000Z', updatedAt: '2026-11-16T08:00:00.000Z' };
const goal = (id: string, period: Goal['period'], periodStart: string, doneOn: string | null = null): Goal => ({
  ...base,
  id,
  period,
  periodStart,
  title: id,
  position: 0,
  doneOn,
});
const task = (id: string, patch: Partial<Task> = {}): Task => ({
  ...base,
  id,
  weekStart: '2026-11-16',
  title: id,
  durationMinutes: 60,
  timesPerWeek: 2,
  deadline: null,
  partOfDay: 'evening',
  energy: 'high',
  needs: '',
  ...patch,
});
const rule = (id: string, patch: Partial<Rule> = {}): Rule => ({
  ...base,
  id,
  title: id,
  icon: null,
  activeDays: [0, 1, 2, 3, 4, 5, 6],
  activeHours: null,
  why: 'zašto',
  weight: 2,
  period: null,
  periodStart: null,
  ...patch,
});
const block = (taskId: string, date: string, status: 'planned' | 'done' | 'skipped' | 'moved' = 'planned') => ({
  date,
  start: '18:00',
  end: '19:00',
  kind: 'task' as const,
  status,
  taskId,
});

const DATE = '2026-11-19'; // četvrtak

describe('planDayContext (korak 26)', () => {
  it('ciljevi razdoblja koja sadrže dan: neostvareni prvi, tjedan → mjesec → godina', () => {
    const context = planDayContext({
      date: DATE,
      goals: [
        goal('godina', 'year', '2026-01-01'),
        goal('gotov-tjedan', 'week', '2026-11-16', '2026-11-17'),
        goal('mjesec', 'month', '2026-11-01'),
        goal('tjedan', 'week', '2026-11-16'),
        goal('drugi-tjedan', 'week', '2026-11-23'),
        goal('prosla-godina', 'year', '2025-01-01'),
      ],
      tasks: [],
      weekBlocks: [],
      rules: [],
    });
    expect(context.goals.map((entry) => [entry.title, entry.done])).toEqual([
      ['tjedan', false],
      ['mjesec', false],
      ['godina', false],
      ['gotov-tjedan', true],
    ]);
  });

  it('zadaci kojima fale termini, bez prošlog roka i bez termina taj dan', () => {
    const tasks = [
      task('trening', { timesPerWeek: 3 }),
      task('gotov', { timesPerWeek: 1 }),
      task('rok-prosao', { deadline: '2026-11-18' }),
      task('vec-sutra', { timesPerWeek: 3 }),
      task('preskocen', { timesPerWeek: 1, deadline: DATE, needs: 'knjiga' }),
    ];
    const weekBlocks = [
      block('trening', '2026-11-16', 'done'),
      block('gotov', '2026-11-17'),
      block('vec-sutra', DATE),
      block('preskocen', '2026-11-17', 'skipped'),
    ];
    const context = planDayContext({ date: DATE, goals: [], tasks, weekBlocks, rules: [] });
    expect(context.tasks).toEqual([
      { title: 'trening', durationMinutes: 60, timesLeft: 2, partOfDay: 'evening', energy: 'high', deadline: null, needs: '' },
      { title: 'preskocen', durationMinutes: 60, timesLeft: 1, partOfDay: 'evening', energy: 'high', deadline: DATE, needs: 'knjiga' },
    ]);
    expect(contextTaskRefs(tasks, context)).toEqual([
      { id: 'trening', title: 'trening' },
      { id: 'preskocen', title: 'preskocen' },
    ]);
  });

  it('samo zabrane koje taj dan vrijede', () => {
    const context = planDayContext({
      date: DATE,
      goals: [],
      tasks: [],
      weekBlocks: [],
      rules: [
        rule('stalna'),
        rule('vikend', { activeDays: [0, 6] }),
        rule('ovaj-tjedan', { period: 'week', periodStart: '2026-11-16', why: '' }),
        rule('prosli-tjedan', { period: 'week', periodStart: '2026-11-09' }),
      ],
    });
    expect(context.rules).toEqual([
      { title: 'stalna', why: 'zašto' },
      { title: 'ovaj-tjedan', why: '' },
    ]);
  });

  it('prazan kontekst', () => {
    const context = planDayContext({ date: DATE, goals: [], tasks: [], weekBlocks: [], rules: [] });
    expect(isPlanContextEmpty(context)).toBe(true);
    expect(isPlanContextEmpty({ ...context, rules: [{ title: 'x', why: '' }] })).toBe(false);
  });
});
