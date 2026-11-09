import { describe, expect, it } from '@jest/globals';

import type { ScheduleBlock } from '../domain';
import {
  blockActionEffect,
  blockReminderBudget,
  blockReminderId,
  IOS_PENDING_NOTIFICATION_LIMIT,
  isBlockReminderId,
  isDailyTriggerId,
  planBlockReschedule,
  SNOOZE_RESERVE,
  snoozedBlockId,
  snoozeFireAt,
  snoozeReminderId,
  upcomingBlockReminders,
} from '.';

type B = ScheduleBlock;

function block(id: string, start: string, overrides: Partial<B> = {}): B {
  return {
    id,
    userId: 'u',
    createdAt: '2026-11-09T08:00:00.000Z',
    updatedAt: '2026-11-09T08:00:00.000Z',
    date: '2026-11-09',
    title: `Blok ${id}`,
    start,
    end: '23:30',
    taskId: null,
    kind: 'task',
    source: 'user',
    status: 'planned',
    ...overrides,
  };
}

/** 9. 11. 2026. u 10:00 lokalno. */
const NOW = new Date(2026, 10, 9, 10, 0, 0, 0);

describe('id-jevi podsjetnika', () => {
  it('blok: dan i početak u id-ju; prepoznavanje', () => {
    const id = blockReminderId(block('abc', '18:00'));
    expect(id).toBe('block:abc@2026-11-09T18:00');
    expect(isBlockReminderId(id)).toBe(true);
    expect(isDailyTriggerId(id)).toBe(false);
    expect(isBlockReminderId('block:abc')).toBe(false);
    expect(isBlockReminderId('morning:2026-11-09@07:00')).toBe(false);
  });

  it('odgoda', () => {
    expect(snoozeReminderId('abc')).toBe('snooze:abc');
    expect(snoozedBlockId('snooze:abc')).toBe('abc');
    expect(snoozedBlockId('block:abc@2026-11-09T18:00')).toBeNull();
    expect(snoozedBlockId('snooze:')).toBeNull();
  });
});

describe('blockReminderBudget', () => {
  it('limit iOS-a − dnevne − rezerva, nikad negativno', () => {
    expect(blockReminderBudget(9)).toBe(IOS_PENDING_NOTIFICATION_LIMIT - 9 - SNOOZE_RESERVE);
    expect(blockReminderBudget(100)).toBe(0);
    expect(blockReminderBudget(Number.NaN)).toBe(IOS_PENDING_NOTIFICATION_LIMIT - SNOOZE_RESERVE);
  });
});

describe('upcomingBlockReminders', () => {
  it('samo planirani budući blokovi, bez sna, sortirano po vremenu', () => {
    const blocks = [
      block('kasno', '18:00'),
      block('rano', '09:00'),
      block('sad', '10:00'),
      block('san', '23:00', { kind: 'sleep', end: '07:00' }),
      block('gotov', '12:00', { status: 'done' }),
      block('preskocen', '12:00', { status: 'skipped' }),
      block('premjesten', '12:00', { status: 'moved' }),
      block('djelomicno', '12:00', { status: 'partial' }),
      block('fiksno', '11:00', { kind: 'fixed' }),
      block('sutra', '08:00', { date: '2026-11-10' }),
    ];
    const reminders = upcomingBlockReminders(blocks, NOW, 10);
    expect(reminders.map((r) => r.blockId)).toEqual(['fiksno', 'kasno', 'sutra']);
    expect(reminders[0]).toEqual({
      id: 'block:fiksno@2026-11-09T11:00',
      blockId: 'fiksno',
      title: 'Blok fiksno',
      date: '2026-11-09',
      start: '11:00',
      end: '23:30',
      fireAt: new Date(2026, 10, 9, 11, 0, 0, 0),
    });
  });

  it('poštuje limit (najraniji ostaju)', () => {
    const blocks = ['13:00', '11:00', '12:00'].map((start) => block(start, start));
    expect(upcomingBlockReminders(blocks, NOW, 2).map((r) => r.start)).toEqual(['11:00', '12:00']);
    expect(upcomingBlockReminders(blocks, NOW, 0)).toEqual([]);
  });

  it('neispravan now → ništa', () => {
    expect(upcomingBlockReminders([block('a', '11:00')], new Date(Number.NaN), 5)).toEqual([]);
  });
});

describe('planBlockReschedule', () => {
  const desired = upcomingBlockReminders([block('a', '11:00'), block('b', '12:00')], NOW, 10);

  it('zakaže nedostajuće, otkaže zastarjele, tuđe i dnevne ne dira', () => {
    const plan = planBlockReschedule(
      ['block:a@2026-11-09T11:00', 'block:a@2026-11-09T09:00', 'morning:2026-11-10@07:00', 'drugo'],
      desired,
      new Set(['a', 'b']),
    );
    expect(plan.toCancel).toEqual(['block:a@2026-11-09T09:00']);
    expect(plan.toSchedule.map((r) => r.id)).toEqual(['block:b@2026-11-09T12:00']);
  });

  it('odgoda ostaje dok je blok planiran, inače se otkaže', () => {
    const scheduled = ['snooze:a', 'snooze:gotov'];
    const plan = planBlockReschedule(scheduled, [], new Set(['a']));
    expect(plan.toCancel).toEqual(['snooze:gotov']);
  });
});

describe('blockActionEffect', () => {
  it('Gotovo i Odgodi za planirani blok', () => {
    expect(blockActionEffect(block('a', '11:00'), 'done', NOW)).toEqual({ type: 'markDone' });
    expect(blockActionEffect(block('a', '11:00'), 'snooze', NOW)).toEqual({
      type: 'snooze',
      fireAt: new Date(2026, 10, 9, 10, 15, 0, 0),
    });
  });

  it('Iskrslo uvijek otvara blok (ako postoji)', () => {
    expect(blockActionEffect(block('a', '11:00', { status: 'done' }), 'cameUp', NOW)).toEqual({
      type: 'openBlock',
    });
    expect(blockActionEffect(null, 'cameUp', NOW)).toEqual({ type: 'none' });
  });

  it('riješen ili obrisan blok → ništa', () => {
    expect(blockActionEffect(block('a', '11:00', { status: 'done' }), 'done', NOW)).toEqual({ type: 'none' });
    expect(blockActionEffect(block('a', '11:00', { status: 'skipped' }), 'snooze', NOW)).toEqual({
      type: 'none',
    });
    expect(blockActionEffect(null, 'done', NOW)).toEqual({ type: 'none' });
  });

  it('odgoda = +15 min', () => {
    expect(snoozeFireAt(NOW).getTime() - NOW.getTime()).toBe(15 * 60_000);
  });
});
