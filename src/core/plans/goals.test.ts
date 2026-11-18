import { describe, expect, it } from '@jest/globals';

import { goalSchema, isGoalPeriodStart } from '../domain';

import { goalPeriodStart, goalProgress, nextGoalPosition, sortGoals } from './goals';

const base = {
  id: 'g1',
  userId: 'u',
  createdAt: '2026-11-18T08:00:00.000Z',
  updatedAt: '2026-11-18T08:00:00.000Z',
  period: 'week' as const,
  periodStart: '2026-11-16',
  title: 'Tri treninga',
  position: 0,
  doneOn: null,
};

describe('ciljevi razdoblja', () => {
  it('goalPeriodStart: ponedjeljak, 1. u mjesecu, 1. 1.', () => {
    expect(goalPeriodStart('week', '2026-11-18')).toBe('2026-11-16');
    expect(goalPeriodStart('week', '2026-11-22')).toBe('2026-11-16');
    expect(goalPeriodStart('week', '2026-11-16')).toBe('2026-11-16');
    expect(goalPeriodStart('month', '2026-11-18')).toBe('2026-11-01');
    expect(goalPeriodStart('year', '2026-11-18')).toBe('2026-01-01');
    expect(goalPeriodStart('week', '2026-02-30')).toBeNull();
  });

  it('isGoalPeriodStart prati goalPeriodStart', () => {
    expect(isGoalPeriodStart('week', '2026-11-16')).toBe(true);
    expect(isGoalPeriodStart('week', '2026-11-17')).toBe(false);
    expect(isGoalPeriodStart('month', '2026-11-01')).toBe(true);
    expect(isGoalPeriodStart('month', '2026-11-02')).toBe(false);
    expect(isGoalPeriodStart('year', '2027-01-01')).toBe(true);
    expect(isGoalPeriodStart('year', '2027-02-01')).toBe(false);
    expect(isGoalPeriodStart('week', 'x')).toBe(false);
  });

  it('shema: naslov 1–120, početak razdoblja ispravan', () => {
    expect(goalSchema.parse(base)).toEqual(base);
    expect(goalSchema.parse({ ...base, title: '  Čitati  ' }).title).toBe('Čitati');
    expect(() => goalSchema.parse({ ...base, title: ' ' })).toThrow();
    expect(() => goalSchema.parse({ ...base, title: 'x'.repeat(121) })).toThrow();
    expect(() => goalSchema.parse({ ...base, periodStart: '2026-11-17' })).toThrow();
    expect(() => goalSchema.parse({ ...base, period: 'day' })).toThrow();
    expect(() => goalSchema.parse({ ...base, position: -1 })).toThrow();
    expect(goalSchema.parse({ ...base, doneOn: '2026-11-18' }).doneOn).toBe('2026-11-18');
  });

  it('redoslijed, napredak i sljedeća pozicija', () => {
    const a = { ...base, id: 'a', position: 1, createdAt: '2026-11-18T08:00:00.000Z' };
    const b = { ...base, id: 'b', position: 0, createdAt: '2026-11-18T09:00:00.000Z' };
    const c = { ...base, id: 'c', position: 1, createdAt: '2026-11-18T07:00:00.000Z', doneOn: '2026-11-18' };
    expect(sortGoals([a, b, c]).map((goal) => goal.id)).toEqual(['b', 'c', 'a']);
    expect(goalProgress([a, b, c])).toEqual({ done: 1, total: 3 });
    expect(nextGoalPosition([a, b, c])).toBe(2);
    expect(nextGoalPosition([])).toBe(0);
  });
});
