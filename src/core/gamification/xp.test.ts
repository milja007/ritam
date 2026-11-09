import { describe, expect, it } from '@jest/globals';

import {
  bedtimeDeviationMinutes,
  totalXp,
  XP_TABLE,
  xpByDate,
  xpForBedtime,
  xpForDate,
  xpForEveningCheckin,
  xpForRescheduledWithReason,
  xpForRuleKept,
  xpForTaskDone,
  xpForTaskPartial,
  xpForWakeWithoutSnooze,
} from './xp';

describe('iznosi XP-a (tablica iz koncepta)', () => {
  it('zadaci po težini, +5 u planiranom terminu', () => {
    expect(xpForTaskDone('easy', false)).toEqual({ source: 'task', amount: 10 });
    expect(xpForTaskDone('medium', false).amount).toBe(25);
    expect(xpForTaskDone('hard', false).amount).toBe(50);
    expect(xpForTaskDone('easy', true).amount).toBe(15);
    expect(xpForTaskDone('hard', true).amount).toBe(55);
  });

  it('djelomično: pola XP-a zadatka, zaokruženo naviše', () => {
    expect(xpForTaskPartial('easy', true)).toEqual({ source: 'task', amount: 8 });
    expect(xpForTaskPartial('easy', false).amount).toBe(5);
    expect(xpForTaskPartial('hard', true).amount).toBe(28);
  });

  it('zabrana po težini 5/10/20', () => {
    expect(xpForRuleKept(1)).toEqual({ source: 'rule', amount: 5 });
    expect(xpForRuleKept(2).amount).toBe(10);
    expect(xpForRuleKept(3).amount).toBe(20);
  });

  it('upit, san, preraspoređivanje', () => {
    expect(xpForEveningCheckin()).toEqual({ source: 'checkin', amount: 15 });
    expect(xpForWakeWithoutSnooze()).toEqual({ source: 'sleep', amount: 10 });
    expect(xpForRescheduledWithReason()).toEqual({ source: 'task', amount: 5 });
  });

  it('nema kazni — svi iznosi su pozitivni cijeli brojevi', () => {
    const amounts = [
      ...Object.values(XP_TABLE.task),
      ...Object.values(XP_TABLE.ruleKept),
      XP_TABLE.taskOnTimeBonus,
      XP_TABLE.eveningCheckin,
      XP_TABLE.bedtimeOnTarget,
      XP_TABLE.wokeWithoutSnooze,
      XP_TABLE.rescheduledWithReason,
    ];
    for (const amount of amounts) {
      expect(Number.isInteger(amount) && amount > 0).toBe(true);
    }
  });
});

describe('krevet na vrijeme (±30 min)', () => {
  it('računa odstupanje preko ponoći', () => {
    expect(bedtimeDeviationMinutes('23:00', '23:20')).toBe(20);
    expect(bedtimeDeviationMinutes('23:45', '00:10')).toBe(25);
    expect(bedtimeDeviationMinutes('00:10', '23:45')).toBe(25);
    expect(bedtimeDeviationMinutes('22:00', '22:00')).toBe(0);
    expect(bedtimeDeviationMinutes('25:00', '22:00')).toBeNull();
  });

  it('granica 30 min je uključena', () => {
    expect(xpForBedtime('23:00', '23:30')).toEqual({ source: 'sleep', amount: 20 });
    expect(xpForBedtime('23:00', '22:30')?.amount).toBe(20);
    expect(xpForBedtime('23:00', '23:31')).toBeNull();
    expect(xpForBedtime('23:30', '00:15')).toBeNull();
    expect(xpForBedtime('x', '23:00')).toBeNull();
  });
});

describe('zbrojevi iz xp_events', () => {
  const events = [
    { date: '2026-11-08', amount: 15 },
    { date: '2026-11-07', amount: 10 },
    { date: '2026-11-08', amount: 25 },
    { date: '2026-11-06', amount: 5 },
  ];

  it('ukupno i po danu', () => {
    expect(totalXp(events)).toBe(55);
    expect(totalXp([])).toBe(0);
    expect(xpForDate(events, '2026-11-08')).toBe(40);
    expect(xpForDate(events, '2026-11-01')).toBe(0);
  });

  it('po danu, sortirano', () => {
    expect([...xpByDate(events)]).toEqual([
      ['2026-11-06', 5],
      ['2026-11-07', 10],
      ['2026-11-08', 40],
    ]);
  });
});
