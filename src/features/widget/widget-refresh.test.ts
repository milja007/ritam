import { describe, expect, it, jest } from '@jest/globals';

import type { WidgetBlock, WidgetDayInput } from '@/core/widget';

import { MAX_WAIT_MS, pushWidgetUpdate } from './widget-refresh';

const labels = {
  now: 'Sada',
  next: 'Sljedeće',
  free: 'Slobodno',
  dayDone: 'Dan je odrađen',
  noPlan: 'Nema plana',
  openApp: 'Otvori Ritam',
  streakUnit: 'dana',
};
const block = (id: string, start: string, end: string): WidgetBlock => ({
  id,
  title: id,
  start,
  end,
  kind: 'task',
  status: 'planned',
});
const input = (blocks: WidgetBlock[]): WidgetDayInput => ({ date: '2026-11-20', blocks, score: 50, streak: 3, labels });
const at = (h: number, m = 0) => new Date(2026, 10, 20, h, m, 0);

describe('pushWidgetUpdate', () => {
  it('Android: snapshot with the current activity, wait until it ends', () => {
    const updateSnapshot = jest.fn();
    const wait = pushWidgetUpdate({ updateSnapshot }, input([block('kemija', '14:00', '15:30')]), at(14, 10), 'android');
    expect(updateSnapshot).toHaveBeenCalledTimes(1);
    expect(JSON.stringify(updateSnapshot.mock.calls[0]?.[0])).toContain('kemija');
    expect(wait).toBe(80 * 60 * 1000);
  });

  it('Android: wait is capped (6 h) and never below a second', () => {
    const updateSnapshot = jest.fn();
    expect(pushWidgetUpdate({ updateSnapshot }, input([]), at(1), 'android')).toBe(MAX_WAIT_MS);
    const late = new Date(2026, 10, 20, 23, 59, 59, 900);
    expect(pushWidgetUpdate({ updateSnapshot }, input([]), late, 'android')).toBe(1000);
  });

  it('iOS: timeline instead of a snapshot, nothing to wait for', () => {
    const updateSnapshot = jest.fn();
    const updateTimeline = jest.fn();
    const wait = pushWidgetUpdate({ updateSnapshot, updateTimeline }, input([block('a', '09:00', '10:00')]), at(8), 'ios');
    expect(wait).toBeNull();
    expect(updateTimeline).toHaveBeenCalledTimes(1);
    expect(updateSnapshot).not.toHaveBeenCalled();
  });

  it('Android ignores updateTimeline even when the object has it', () => {
    const updateSnapshot = jest.fn();
    const updateTimeline = jest.fn();
    pushWidgetUpdate({ updateSnapshot, updateTimeline }, input([]), at(8), 'android');
    expect(updateTimeline).not.toHaveBeenCalled();
    expect(updateSnapshot).toHaveBeenCalledTimes(1);
  });
});
