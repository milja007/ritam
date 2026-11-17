import { describe, expect, it } from '@jest/globals';

import type { ScheduleBlock } from '../domain';
import { defaultUnexpectedChoice, isRescheduleChoice, planUnexpected, unexpectedWindow } from './unexpected';

type B = Pick<ScheduleBlock, 'id' | 'start' | 'end' | 'kind' | 'status'>;
const b = (id: string, start: string, end: string, extra: Partial<B> = {}): B => ({
  id,
  start,
  end,
  kind: 'task',
  status: 'planned',
  ...extra,
});
const at = (clock: string) => Number(clock.slice(0, 2)) * 60 + Number(clock.slice(3));

describe('unexpectedWindow', () => {
  it('od sada, najkasnije do 23:59', () => {
    expect(unexpectedWindow(at('10:00'), 60)).toEqual({ start: 600, end: 660 });
    expect(unexpectedWindow(at('23:30'), 120)).toEqual({ start: at('23:30'), end: 1439 });
    expect(unexpectedWindow(at('09:00'), 'rest')).toEqual({ start: 540, end: 1439 });
    expect(unexpectedWindow(1439, 15)).toBeNull();
    expect(unexpectedWindow(-1, 15)).toBeNull();
  });
});

describe('planUnexpected', () => {
  it('pogođeni su planirani blokovi koji se preklapaju s prozorom, i onaj koji upravo traje', () => {
    const blocks = [
      b('past', '08:00', '09:00'),
      b('running', '09:30', '10:30'),
      b('inside', '10:45', '11:15'),
      b('after', '11:30', '12:00'),
      b('done', '10:30', '10:45', { status: 'done' }),
      b('cancelled', '10:00', '11:00', { status: 'skipped' }),
      b('sleep', '23:00', '07:00', { kind: 'sleep' }),
    ];
    const plan = planUnexpected(blocks, at('10:00'), 60);
    expect(plan?.window).toEqual({ start: 600, end: 660 });
    expect(plan?.affected.map((entry) => entry.block.id)).toEqual(['running', 'inside']);
  });

  it('kasnije danas: prvi slobodan termin iste duljine nakon prozora, redom i bez preklapanja', () => {
    const blocks = [
      b('a', '10:00', '11:00'),
      b('b', '10:30', '11:00'),
      b('fixed', '11:00', '12:00', { kind: 'fixed' }), // izvan prozora: zauzima
      b('lunch', '12:30', '13:00', { status: 'done' }),
    ];
    const plan = planUnexpected(blocks, at('10:00'), 60);
    expect(plan?.affected.map((entry) => [entry.block.id, entry.laterToday])).toEqual([
      ['a', { start: '13:00', end: '14:00' }], // 12:00–12:30 premalo za sat
      ['b', { start: '12:00', end: '12:30' }],
    ]);
  });

  it('nema termina do 23:59 (ili je do kraja dana) → kasnije danas nije ponuđeno', () => {
    const late = planUnexpected([b('x', '22:00', '23:30'), b('sleep', '23:00', '07:00', { kind: 'sleep' })], at('22:00'), 30);
    expect(late?.affected[0]?.laterToday).toBeNull();
    const rest = planUnexpected([b('x', '15:00', '16:00')], at('14:00'), 'rest');
    expect(rest?.affected[0]?.laterToday).toBeNull();
    expect(defaultUnexpectedChoice(rest!.affected[0]!)).toBe('tomorrow');
  });

  it('zadani izbor i XP pravilo', () => {
    const plan = planUnexpected([b('x', '10:00', '10:30')], at('10:00'), 15);
    expect(plan?.affected[0]?.laterToday).toEqual({ start: '10:15', end: '10:45' });
    expect(defaultUnexpectedChoice(plan!.affected[0]!)).toBe('laterToday');
    expect(isRescheduleChoice('laterToday')).toBe(true);
    expect(isRescheduleChoice('other')).toBe(true);
    expect(isRescheduleChoice('skip')).toBe(false);
  });

  it('bez pogođenih i neispravno vrijeme', () => {
    expect(planUnexpected([b('x', '15:00', '16:00')], at('10:00'), 30)?.affected).toEqual([]);
    expect(planUnexpected([], 2000, 30)).toBeNull();
  });
});
