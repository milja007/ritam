import { describe, expect, it } from '@jest/globals';

import type { ScheduleBlock } from '../domain';
import {
  briefBlocks,
  briefStartIndex,
  briefSummary,
  createMorningDraft,
  greetingFor,
  isMorningDraftValid,
  morningXpAwards,
  sleepDurationMinutes,
  targetBedtimeFor,
} from './morning';

const settings = { wakeTime: '07:00', weekendWakeTime: '09:00', sleepHours: 8 };

type B = Pick<ScheduleBlock, 'id' | 'kind' | 'start' | 'end' | 'status'>;
const block = (
  id: string,
  start: string,
  end: string,
  kind: B['kind'] = 'task',
  status: B['status'] = 'planned',
): B => ({ id, start, end, kind, status });

describe('targetBedtimeFor', () => {
  it('uses the wake time of the given day (weekday)', () => {
    // Utorak 2026-11-10: buđenje 07:00 − 8 h = 23:00 u ponedjeljak navečer.
    expect(targetBedtimeFor(settings, '2026-11-10')).toBe('23:00');
  });

  it('follows the weekend wake time on Saturday', () => {
    // Subota 2026-11-14: 09:00 − 8 h = 01:00.
    expect(targetBedtimeFor(settings, '2026-11-14')).toBe('01:00');
  });

  it('returns null for an invalid date', () => {
    expect(targetBedtimeFor(settings, 'nope')).toBeNull();
  });
});

describe('createMorningDraft', () => {
  it('prefills from sleep targets', () => {
    expect(createMorningDraft(settings, '2026-11-10', null)).toEqual({
      date: '2026-11-10',
      sleepStart: '23:00',
      wakeTime: '07:00',
    });
  });

  it('uses the weekend wake time on Sunday', () => {
    expect(createMorningDraft(settings, '2026-11-15', null)).toMatchObject({
      sleepStart: '01:00',
      wakeTime: '09:00',
    });
  });

  it('prefers a saved check-in', () => {
    expect(
      createMorningDraft(settings, '2026-11-10', { sleepStart: '00:15', wakeTime: '07:30' }),
    ).toMatchObject({ sleepStart: '00:15', wakeTime: '07:30' });
  });

  it('fills missing saved fields from targets', () => {
    expect(
      createMorningDraft(settings, '2026-11-10', { sleepStart: null, wakeTime: '06:45' }),
    ).toMatchObject({ sleepStart: '23:00', wakeTime: '06:45' });
  });
});

describe('sleepDurationMinutes', () => {
  it('handles crossing midnight', () => {
    expect(sleepDurationMinutes('23:30', '07:00')).toBe(450);
  });

  it('handles same-day sleep', () => {
    expect(sleepDurationMinutes('01:00', '09:15')).toBe(495);
  });

  it('is zero for equal times and null for invalid input', () => {
    expect(sleepDurationMinutes('07:00', '07:00')).toBe(0);
    expect(sleepDurationMinutes('25:00', '07:00')).toBeNull();
  });
});

describe('isMorningDraftValid', () => {
  it('requires valid times and a positive duration', () => {
    expect(isMorningDraftValid({ date: '2026-11-10', sleepStart: '23:00', wakeTime: '07:00' })).toBe(true);
    expect(isMorningDraftValid({ date: '2026-11-10', sleepStart: '07:00', wakeTime: '07:00' })).toBe(false);
    expect(isMorningDraftValid({ date: '2026-11-10', sleepStart: 'x', wakeTime: '07:00' })).toBe(false);
  });
});

describe('morningXpAwards', () => {
  it('awards the bedtime bonus within ±30 min of the target', () => {
    expect(
      morningXpAwards(settings, { date: '2026-11-10', sleepStart: '23:25', wakeTime: '07:00' }),
    ).toEqual([{ source: 'sleep', amount: 20 }]);
  });

  it('works across midnight', () => {
    expect(
      morningXpAwards(settings, { date: '2026-11-10', sleepStart: '00:30', wakeTime: '07:00' }),
    ).toEqual([]);
    expect(
      morningXpAwards(settings, { date: '2026-11-10', sleepStart: '22:30', wakeTime: '07:00' }),
    ).toEqual([{ source: 'sleep', amount: 20 }]);
  });

  it('gives nothing (no penalty) outside tolerance or for invalid drafts', () => {
    expect(
      morningXpAwards(settings, { date: '2026-11-10', sleepStart: '01:00', wakeTime: '07:00' }),
    ).toEqual([]);
    expect(
      morningXpAwards(settings, { date: '2026-11-10', sleepStart: '07:00', wakeTime: '07:00' }),
    ).toEqual([]);
  });
});

describe('greetingFor', () => {
  it('splits the day into morning, afternoon and evening', () => {
    expect(greetingFor(4 * 60)).toBe('morning');
    expect(greetingFor(11 * 60 + 59)).toBe('morning');
    expect(greetingFor(12 * 60)).toBe('afternoon');
    expect(greetingFor(18 * 60)).toBe('evening');
    expect(greetingFor(2 * 60)).toBe('evening');
  });
});

describe('brief blocks and summary', () => {
  const blocks = [
    block('s', '23:00', '07:00', 'sleep'),
    block('b', '13:00', '14:00', 'task'),
    block('a', '09:00', '12:00', 'fixed'),
    block('c', '18:00', '19:00', 'task', 'done'),
  ];

  it('drops sleep and sorts by start', () => {
    expect(briefBlocks(blocks).map((b) => b.id)).toEqual(['a', 'b', 'c']);
  });

  it('counts blocks and tasks and finds the first open block', () => {
    expect(briefSummary(blocks, 8 * 60)).toEqual({
      blocks: 3,
      tasks: 2,
      next: { id: 'a', start: '09:00' },
    });
  });

  it('includes the current block as next', () => {
    expect(briefSummary(blocks, 10 * 60).next?.id).toBe('a');
    expect(briefSummary(blocks, 12 * 60 + 30).next?.id).toBe('b');
  });

  it('skips done blocks and returns null when nothing is left', () => {
    expect(briefSummary(blocks, 15 * 60).next).toBeNull();
  });

  it('starts the cards at the next open block', () => {
    expect(briefStartIndex(blocks, 8 * 60)).toBe(0);
    expect(briefStartIndex(blocks, 12 * 60 + 30)).toBe(1);
    expect(briefStartIndex(blocks, 20 * 60)).toBe(0);
    expect(briefStartIndex([], 8 * 60)).toBe(0);
  });
});
