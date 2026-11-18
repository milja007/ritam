import { describe, expect, it } from '@jest/globals';

import { isDeadlineInWeek, taskSchema } from './index';

const task = {
  id: 't1',
  userId: 'u1',
  createdAt: '2026-11-18T10:00:00.000Z',
  updatedAt: '2026-11-18T10:00:00.000Z',
  weekStart: '2026-11-16',
  title: ' Trening ',
  durationMinutes: 60,
  timesPerWeek: 3,
  deadline: null,
  partOfDay: 'evening',
  energy: 'high',
  needs: 'Tenisice',
};

describe('taskSchema (korak 25)', () => {
  it('ispravan zadatak, naslov se skrati', () => {
    expect(taskSchema.parse(task)).toMatchObject({
      title: 'Trening',
      timesPerWeek: 3,
    });
    expect(taskSchema.safeParse({ ...task, deadline: '2026-11-22' }).success).toBe(true);
    expect(taskSchema.safeParse({ ...task, needs: '' }).success).toBe(true);
  });

  it('odbija krivi tjedan, rok izvan tjedna i granice', () => {
    expect(taskSchema.safeParse({ ...task, weekStart: '2026-11-17' }).success).toBe(false);
    expect(taskSchema.safeParse({ ...task, deadline: '2026-11-23' }).success).toBe(false);
    expect(taskSchema.safeParse({ ...task, deadline: '2026-11-15' }).success).toBe(false);
    expect(taskSchema.safeParse({ ...task, title: '  ' }).success).toBe(false);
    expect(taskSchema.safeParse({ ...task, durationMinutes: 4 }).success).toBe(false);
    expect(taskSchema.safeParse({ ...task, durationMinutes: 481 }).success).toBe(false);
    expect(taskSchema.safeParse({ ...task, durationMinutes: 30.5 }).success).toBe(false);
    expect(taskSchema.safeParse({ ...task, timesPerWeek: 0 }).success).toBe(false);
    expect(taskSchema.safeParse({ ...task, timesPerWeek: 8 }).success).toBe(false);
    expect(taskSchema.safeParse({ ...task, partOfDay: 'night' }).success).toBe(false);
    expect(taskSchema.safeParse({ ...task, energy: 'max' }).success).toBe(false);
    expect(taskSchema.safeParse({ ...task, needs: 'x'.repeat(301) }).success).toBe(false);
  });

  it('isDeadlineInWeek: pon–ned uključivo', () => {
    expect(isDeadlineInWeek('2026-11-16', '2026-11-16')).toBe(true);
    expect(isDeadlineInWeek('2026-11-16', '2026-11-22')).toBe(true);
    expect(isDeadlineInWeek('2026-11-16', '2026-11-23')).toBe(false);
    expect(isDeadlineInWeek('2026-11-16', 'nope')).toBe(false);
  });
});
