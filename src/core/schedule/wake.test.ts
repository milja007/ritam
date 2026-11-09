import { describe, expect, it } from '@jest/globals';

import {
  bedtimeOn,
  isWeekend,
  wakeShiftMinutes,
  wakeTimeFor,
  weekdayOf,
  weekendShiftMinutes,
  weekendWakeWarning,
} from './wake';

// 2026-11-09 je ponedjeljak; 14. i 15. 11. su subota i nedjelja.
const SETTINGS = { wakeTime: '07:00', weekendWakeTime: '09:00', sleepHours: 8 };

describe('vikend', () => {
  it('weekdayOf / isWeekend', () => {
    expect(weekdayOf('2026-11-09')).toBe(1);
    expect(isWeekend('2026-11-13')).toBe(false);
    expect(isWeekend('2026-11-14')).toBe(true);
    expect(isWeekend('2026-11-15')).toBe(true);
    expect(isWeekend('2026-11-16')).toBe(false);
    expect(isWeekend('nije-datum')).toBe(false);
  });

  it('wakeTimeFor: vikendom vikend vrijeme, inače radni dan', () => {
    expect(wakeTimeFor(SETTINGS, '2026-11-13')).toBe('07:00');
    expect(wakeTimeFor(SETTINGS, '2026-11-14')).toBe('09:00');
    expect(wakeTimeFor({ ...SETTINGS, weekendWakeTime: null }, '2026-11-14')).toBe('07:00');
  });

  it('bedtimeOn prati buđenje sljedećeg dana', () => {
    expect(bedtimeOn(SETTINGS, '2026-11-12')).toBe('23:00'); // čet → pet radni
    expect(bedtimeOn(SETTINGS, '2026-11-13')).toBe('01:00'); // pet → sub vikend
    expect(bedtimeOn(SETTINGS, '2026-11-14')).toBe('01:00'); // sub → ned
    expect(bedtimeOn(SETTINGS, '2026-11-15')).toBe('23:00'); // ned → pon
    expect(bedtimeOn({ ...SETTINGS, sleepHours: 7.5 }, '2026-11-12')).toBe('23:30');
    expect(bedtimeOn(SETTINGS, 'x')).toBeNull();
  });
});

describe('razlika buđenja', () => {
  it('najkraćim putem preko ponoći', () => {
    expect(wakeShiftMinutes('07:00', '09:30')).toBe(150);
    expect(wakeShiftMinutes('09:30', '07:00')).toBe(-150);
    expect(wakeShiftMinutes('23:30', '00:30')).toBe(60);
    expect(wakeShiftMinutes('00:30', '23:30')).toBe(-60);
    expect(wakeShiftMinutes('7', '09:00')).toBeNull();
  });

  it('weekendShiftMinutes: 0 kad vikend nije zadan', () => {
    expect(weekendShiftMinutes(SETTINGS)).toBe(120);
    expect(weekendShiftMinutes({ ...SETTINGS, weekendWakeTime: null })).toBe(0);
  });

  it('upozorenje tek iznad 1 h razlike, u oba smjera', () => {
    expect(weekendWakeWarning('07:00', null)).toBe(false);
    expect(weekendWakeWarning('07:00', '08:00')).toBe(false);
    expect(weekendWakeWarning('07:00', '08:15')).toBe(true);
    expect(weekendWakeWarning('07:00', '05:45')).toBe(true);
    expect(weekendWakeWarning('23:30', '00:15')).toBe(false);
  });
});
