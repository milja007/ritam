import { describe, expect, it } from '@jest/globals';

import type { BlockStatus, Task } from '../domain';
import { findSlot, placementDays, placeWeekTasks, taskProgress, type PlacementDay } from './week-tasks';

const WEEK = ['2026-11-16', '2026-11-17', '2026-11-18', '2026-11-19', '2026-11-20', '2026-11-21', '2026-11-22'];

function task(overrides: Partial<Task> = {}): Task {
  return {
    id: 't1',
    userId: 'u',
    createdAt: '2026-11-16T08:00:00.000Z',
    updatedAt: '2026-11-16T08:00:00.000Z',
    weekStart: '2026-11-16',
    title: 'Trening',
    durationMinutes: 60,
    timesPerWeek: 1,
    deadline: null,
    partOfDay: 'any',
    energy: 'medium',
    needs: '',
    ...overrides,
  };
}

type B = PlacementDay['blocks'][number];
const block = (date: string, start: string, end: string, extra: Partial<B> = {}): B => ({
  date,
  start,
  end,
  kind: 'fixed',
  status: 'planned' as BlockStatus,
  taskId: null,
  ...extra,
});

function days(
  dates: readonly string[] = WEEK,
  blocks: readonly B[] = [],
  notBefore: number | null = null,
): PlacementDay[] {
  return dates.map((date, index) => ({
    date,
    wakeTime: '07:00',
    bedtime: '23:00',
    notBefore: index === 0 ? notBefore : null,
    blocks: blocks.filter((b) => b.date === date),
  }));
}

describe('placeWeekTasks (korak 25)', () => {
  it('svaki put drugi dan, ravnomjerno; srednja energija najranije (buđenje + 30 min)', () => {
    const plan = placeWeekTasks([task({ timesPerWeek: 3 })], days());
    expect(plan.unplaced).toEqual([]);
    expect(plan.placements.map((p) => [p.date, p.start, p.end])).toEqual([
      ['2026-11-16', '07:30', '08:30'],
      ['2026-11-19', '07:30', '08:30'],
      ['2026-11-22', '07:30', '08:30'],
    ]);
  });

  it('doba dana je tvrdo; niska energija ide najkasnije, visoka najranije u prozoru', () => {
    const evening = placeWeekTasks([task({ partOfDay: 'evening', energy: 'high' })], days());
    expect(evening.placements[0]).toMatchObject({ start: '17:00', end: '18:00' });
    const lowEvening = placeWeekTasks([task({ partOfDay: 'evening', energy: 'low' })], days());
    expect(lowEvening.placements[0]).toMatchObject({ start: '22:00', end: '23:00' });
    const afternoon = placeWeekTasks([task({ partOfDay: 'afternoon', durationMinutes: 300 })], days());
    expect(afternoon.placements[0]).toMatchObject({ start: '12:00', end: '17:00' });
    const tooLong = placeWeekTasks([task({ partOfDay: 'afternoon', durationMinutes: 301 })], days());
    expect(tooLong).toEqual({ placements: [], unplaced: [expect.objectContaining({ missing: 1, reason: 'no-time' })] });
  });

  it('zaobilazi zauzeto uz razmak 10 min; san, premješteni i preskočeni ne zauzimaju', () => {
    const blocks = [
      block('2026-11-16', '07:00', '09:00'),
      block('2026-11-16', '09:30', '10:00', { status: 'skipped' }),
      block('2026-11-16', '23:00', '07:00', { kind: 'sleep' }),
    ];
    const plan = placeWeekTasks([task()], days(['2026-11-16'], blocks));
    expect(plan.placements[0]).toMatchObject({ start: '09:10', end: '10:10' });
  });

  it('rok: samo dani do roka; prošli ili zauzeti dani → razlog', () => {
    const plan = placeWeekTasks([task({ timesPerWeek: 3, deadline: '2026-11-17' })], days());
    expect(plan.placements.map((p) => p.date)).toEqual(['2026-11-16', '2026-11-17']);
    expect(plan.unplaced).toEqual([expect.objectContaining({ missing: 1, reason: 'no-days' })]);
    const late = placeWeekTasks([task({ deadline: '2026-11-17' })], days(WEEK.slice(3)));
    expect(late.unplaced).toEqual([expect.objectContaining({ missing: 1, reason: 'no-days' })]);
  });

  it('danas ne prije sada (zaokruženo na 5 min)', () => {
    const plan = placeWeekTasks([task()], days(['2026-11-18'], [], 14 * 60 + 2));
    expect(plan.placements[0]).toMatchObject({ date: '2026-11-18', start: '14:05' });
    const tooLate = placeWeekTasks([task()], days(['2026-11-18'], [], 22 * 60 + 30));
    expect(tooLate.unplaced[0]?.reason).toBe('no-time');
  });

  it('već smješteni blokovi zadatka se broje i njihovi dani se ne ponavljaju', () => {
    const blocks = [
      block('2026-11-16', '18:00', '19:00', { kind: 'task', taskId: 't1', status: 'done' }),
      block('2026-11-17', '18:00', '19:00', { kind: 'task', taskId: 't1', status: 'moved' }),
    ];
    const plan = placeWeekTasks([task({ timesPerWeek: 2 })], days(WEEK, blocks));
    expect(plan.placements.map((p) => p.date)).toEqual(['2026-11-22']);
    const full = placeWeekTasks([task({ timesPerWeek: 1 })], days(WEEK, blocks));
    expect(full).toEqual({ placements: [], unplaced: [] });
  });

  it('zadaci se ne preklapaju međusobno; raniji rok ima prednost', () => {
    const a = task({ id: 'a', title: 'A', durationMinutes: 240, partOfDay: 'morning' });
    const b = task({ id: 'b', title: 'B', durationMinutes: 120, partOfDay: 'morning', deadline: '2026-11-16' });
    const plan = placeWeekTasks([a, b], days(['2026-11-16']));
    expect(plan.placements).toEqual([expect.objectContaining({ taskId: 'b', start: '07:30', end: '09:30' })]);
    expect(plan.unplaced).toEqual([expect.objectContaining({ taskId: 'a', reason: 'no-time' })]);
  });
});

describe('findSlot / taskProgress', () => {
  it('nema mjesta → null', () => {
    expect(findSlot({ start: 450, end: 480 }, [], 'any', 60, false)).toBeNull();
  });

  it('broji smještene (bez premještenih/preskočenih) i odrađene (i djelomično)', () => {
    const blocks = [
      block('2026-11-16', '18:00', '19:00', { taskId: 't1', status: 'done' }),
      block('2026-11-17', '18:00', '19:00', { taskId: 't1', status: 'partial' }),
      block('2026-11-18', '18:00', '19:00', { taskId: 't1', status: 'planned' }),
      block('2026-11-19', '18:00', '19:00', { taskId: 't1', status: 'skipped' }),
      block('2026-11-19', '18:00', '19:00', { taskId: 'x', status: 'done' }),
    ];
    expect(taskProgress(task({ timesPerWeek: 4 }), blocks)).toEqual({ placed: 3, done: 2, target: 4 });
  });
});

describe('placementDays', () => {
  it('samo od danas; vikend buđenje; krevet prema sutrašnjem buđenju', () => {
    const settings = { wakeTime: '07:00', weekendWakeTime: '09:00', sleepHours: 8 };
    const result = placementDays(WEEK, '2026-11-20', 600, settings, [block('2026-11-21', '10:00', '11:00')]);
    expect(result.map((day) => [day.date, day.wakeTime, day.bedtime, day.notBefore, day.blocks.length])).toEqual([
      ['2026-11-20', '07:00', '01:00', 600, 0],
      ['2026-11-21', '09:00', '01:00', null, 1],
      ['2026-11-22', '09:00', '23:00', null, 0],
    ]);
  });
});
