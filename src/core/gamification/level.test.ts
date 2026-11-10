import { describe, expect, it } from '@jest/globals';

import { levelProgress, xpForLevelStep } from './level';
import { progressSummary } from './progress';

describe('xpForLevelStep', () => {
  it('level 2 = 100 XP, svaki sljedeći ~15 % više, zaokruženo na 5', () => {
    expect([1, 2, 3, 4, 5].map(xpForLevelStep)).toEqual([100, 115, 130, 150, 175]);
  });

  it('razina ispod 1 se tretira kao 1', () => {
    expect(xpForLevelStep(0)).toBe(100);
    expect(xpForLevelStep(-3)).toBe(100);
  });

  it('koraci nikad ne padaju', () => {
    for (let level = 1; level < 60; level++) {
      expect(xpForLevelStep(level + 1)).toBeGreaterThanOrEqual(xpForLevelStep(level));
    }
  });
});

describe('levelProgress', () => {
  it('0 XP → razina 1, prazna traka', () => {
    expect(levelProgress(0)).toEqual({ level: 1, xpIntoLevel: 0, xpForNext: 100, fraction: 0 });
  });

  it('99 XP → još razina 1', () => {
    const progress = levelProgress(99);
    expect(progress.level).toBe(1);
    expect(progress.fraction).toBeCloseTo(0.99);
  });

  it('točno 100 XP → razina 2 od nule', () => {
    expect(levelProgress(100)).toEqual({ level: 2, xpIntoLevel: 0, xpForNext: 115, fraction: 0 });
  });

  it('kumulativno: 100 + 115 + 30 → razina 3, 30 / 130', () => {
    expect(levelProgress(245)).toEqual({
      level: 3,
      xpIntoLevel: 30,
      xpForNext: 130,
      fraction: 30 / 130,
    });
  });

  it('negativno i neispravno → 0 XP', () => {
    expect(levelProgress(-50).level).toBe(1);
    expect(levelProgress(Number.NaN).xpIntoLevel).toBe(0);
  });
});

describe('progressSummary', () => {
  const events = [
    { date: '2026-11-09', amount: 60 },
    { date: '2026-11-10', amount: 15 },
    { date: '2026-11-10', amount: 30 },
  ];
  const checkins = [
    { date: '2026-11-08', kind: 'evening' as const, dayRating: 4 },
    { date: '2026-11-09', kind: 'evening' as const, dayRating: 3 },
    { date: '2026-11-10', kind: 'morning' as const, dayRating: null },
  ];

  it('ukupno, danas, razina i streak', () => {
    const summary = progressSummary(events, checkins, '2026-11-10');
    expect(summary.totalXp).toBe(105);
    expect(summary.todayXp).toBe(45);
    expect(summary.level).toMatchObject({ level: 2, xpIntoLevel: 5 });
    expect(summary.streak).toMatchObject({ current: 2, longest: 2, doneToday: false });
  });

  it('streak prema danu upita (iza ponoći je to jučer)', () => {
    const summary = progressSummary(events, checkins, '2026-11-10', '2026-11-09');
    expect(summary.streak.doneToday).toBe(true);
    expect(summary.todayXp).toBe(45);
  });

  it('bez podataka', () => {
    const summary = progressSummary([], [], '2026-11-10');
    expect(summary).toMatchObject({ totalXp: 0, todayXp: 0, level: { level: 1 } });
    expect(summary.streak.current).toBe(0);
  });
});
