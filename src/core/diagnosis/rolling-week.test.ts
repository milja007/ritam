import { describe, expect, it } from '@jest/globals';

import {
  buildRollingWeekDiagnosis,
  periodStats,
  rollingWeekStart,
  showsRollingWeek,
  type DayStats,
  type PeriodDay,
} from './index';

function day(date: string, score: number | null, done = 4): PeriodDay {
  const stats: DayStats = {
    date,
    plan: { total: 4, done, partial: 0, missed: 4 - done, moved: 0, open: 0, rate: done / 4 },
    rules: { active: 0, kept: 0, broken: 0, brokenRules: [], activeWeight: 0, keptWeight: 0 },
    sleep: null,
    xp: 10,
    rating: null,
    note: null,
    streak: 1,
    comments: [],
    gaveUp: false,
    gaveUpNote: null,
    misses: [],
  };
  return { stats, score };
}

describe('showsRollingWeek', () => {
  it('zadnji dan mjeseca koji nije nedjelja', () => {
    expect(showsRollingWeek('2026-11-30')).toBe(true); // ponedjeljak
    expect(showsRollingWeek('2027-02-28')).toBe(false); // nedjelja → prava tjedna dijagnoza
    expect(showsRollingWeek('2026-12-31')).toBe(true); // četvrtak
    expect(showsRollingWeek('2026-11-29')).toBe(false); // nije zadnji dan
    expect(showsRollingWeek('nije')).toBe(false);
  });

  it('početak razdoblja je 6 dana prije, i preko granice mjeseca', () => {
    expect(rollingWeekStart('2026-11-30')).toBe('2026-11-24');
    expect(rollingWeekStart('2027-03-03')).toBe('2027-02-25');
  });
});

describe('buildRollingWeekDiagnosis', () => {
  const current = periodStats('2026-11-24', '2026-11-30', 7, [
    day('2026-11-24', 80),
    day('2026-11-25', 85),
    day('2026-11-27', 90),
    day('2026-11-30', 75, 2),
  ]);
  const previous = periodStats('2026-11-17', '2026-11-23', 7, [day('2026-11-18', 60), day('2026-11-20', 62)]);

  it('raspon zadnjih 7 dana, usporedba s 7 dana prije', () => {
    const diagnosis = buildRollingWeekDiagnosis(current, previous);
    expect(diagnosis.start).toBe('2026-11-24');
    expect(diagnosis.end).toBe('2026-11-30');
    expect(diagnosis.trend).toBe('better');
    expect(diagnosis.progress.find((row) => row.metric === 'average')?.previous).toBe(61);
  });

  it('samo pregled: bez ideja, prijedloga i niza boljih tjedana', () => {
    for (const prev of [previous, null]) {
      const diagnosis = buildRollingWeekDiagnosis(current, prev);
      expect(diagnosis.ideas).toEqual([]);
      expect(diagnosis.suggestion).toBeNull();
      expect(diagnosis.carried).toBe(false);
      expect(diagnosis.progress.some((row) => row.metric === 'betterWeeks')).toBe(false);
      expect(diagnosis.summary.key.length).toBeGreaterThan(0);
    }
  });
});
