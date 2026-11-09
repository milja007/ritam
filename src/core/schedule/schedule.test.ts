import { describe, expect, it } from '@jest/globals';

import type { BlockKind, ScheduleBlock } from '../domain';
import {
  blockPhase,
  blockRange,
  canShiftEnd,
  canShiftStart,
  currentBlockId,
  draftFromBlock,
  draftToInput,
  draftToPatch,
  isBlockDraftValid,
  isDone,
  minutesOfDay,
  newBlockDraft,
  shiftDraftEnd,
  shiftDraftStart,
  toggledStatus,
  type BlockDraft,
} from '.';

const at = (clock: string) => {
  const [h, m] = clock.split(':').map(Number);
  return (h ?? 0) * 60 + (m ?? 0);
};

function block(id: string, start: string, end: string, kind: BlockKind = 'task'): ScheduleBlock {
  return {
    id,
    userId: 'u',
    createdAt: '2026-11-09T08:00:00.000Z',
    updatedAt: '2026-11-09T08:00:00.000Z',
    date: '2026-11-09',
    title: id,
    start,
    end,
    taskId: null,
    kind,
    source: 'user',
    status: 'planned',
  };
}

const draft = (start: string, end: string, kind: BlockKind = 'task', title = 'Rad'): BlockDraft => ({
  title,
  start,
  end,
  kind,
});

describe('blockRange', () => {
  it('običan blok', () => {
    expect(blockRange(block('a', '09:00', '10:30'))).toEqual({ start: 540, end: 630 });
  });
  it('san preko ponoći traje do kraja današnjeg dana', () => {
    expect(blockRange(block('s', '23:00', '07:00', 'sleep'))).toEqual({ start: 1380, end: 1440 });
  });
  it('neispravan blok → null', () => {
    expect(blockRange(block('x', '10:00', '09:00'))).toBeNull();
    expect(blockRange(block('x', '25:00', '26:00'))).toBeNull();
  });
});

describe('blockPhase', () => {
  const b = block('a', '09:00', '10:00');
  it.each([
    ['08:59', 'upcoming'],
    ['09:00', 'current'],
    ['09:59', 'current'],
    ['10:00', 'past'],
    ['23:00', 'past'],
  ] as const)('u %s → %s', (now, phase) => {
    expect(blockPhase(b, at(now))).toBe(phase);
  });
  it('san navečer je tekući do ponoći, ujutro još slijedi', () => {
    const sleep = block('s', '23:00', '07:00', 'sleep');
    expect(blockPhase(sleep, at('23:30'))).toBe('current');
    expect(blockPhase(sleep, at('06:00'))).toBe('upcoming');
  });
});

describe('currentBlockId', () => {
  it('nema bloka → null', () => {
    expect(currentBlockId([], at('10:00'))).toBeNull();
    expect(currentBlockId([block('a', '09:00', '10:00')], at('10:00'))).toBeNull();
  });
  it('vraća blok koji traje', () => {
    const blocks = [block('a', '09:00', '10:00'), block('b', '10:00', '11:00')];
    expect(currentBlockId(blocks, at('10:00'))).toBe('b');
  });
  it('kod preklapanja bira kasnije započeti', () => {
    const blocks = [block('outer', '09:00', '12:00'), block('inner', '10:00', '10:30')];
    expect(currentBlockId(blocks, at('10:15'))).toBe('inner');
    expect(currentBlockId(blocks, at('10:45'))).toBe('outer');
  });
});

describe('status', () => {
  it('kvačica prebacuje planned ↔ done, ostalo → done', () => {
    expect(toggledStatus('planned')).toBe('done');
    expect(toggledStatus('done')).toBe('planned');
    expect(toggledStatus('partial')).toBe('done');
    expect(toggledStatus('skipped')).toBe('done');
    expect(toggledStatus('moved')).toBe('done');
  });
  it('isDone', () => {
    expect(isDone({ status: 'done' })).toBe(true);
    expect(isDone({ status: 'partial' })).toBe(false);
  });
  it('minutesOfDay koristi lokalno vrijeme', () => {
    expect(minutesOfDay(new Date(2026, 10, 9, 14, 37))).toBe(877);
  });
});

describe('newBlockDraft', () => {
  it('prazan dan: prvih punih 15 min od sada, 1 h', () => {
    expect(newBlockDraft([], at('10:07'))).toEqual(draft('10:15', '11:15', 'task', ''));
    expect(newBlockDraft([], at('10:00'))).toMatchObject({ start: '10:00', end: '11:00' });
  });
  it('nastavlja na kraj zadnjeg bloka ako je kasniji od sada', () => {
    const blocks = [block('a', '09:00', '10:00'), block('b', '13:00', '14:30')];
    expect(newBlockDraft(blocks, at('10:07'))).toMatchObject({ start: '14:30', end: '15:30' });
  });
  it('ignorira prošle blokove i san preko ponoći', () => {
    const blocks = [block('a', '07:00', '08:00'), block('s', '23:00', '07:00', 'sleep')];
    expect(newBlockDraft(blocks, at('12:00'))).toMatchObject({ start: '12:00', end: '13:00' });
  });
  it('ne prelazi kraj dana', () => {
    expect(newBlockDraft([], at('23:20'))).toMatchObject({ start: '23:30', end: '23:59' });
    expect(newBlockDraft([], at('23:50'))).toMatchObject({ start: '23:45', end: '23:59' });
  });
});

describe('shiftDraftStart', () => {
  it('pomiče početak i čuva trajanje', () => {
    expect(shiftDraftStart(draft('09:00', '10:30'), 1)).toMatchObject({ start: '09:15', end: '10:45' });
    expect(shiftDraftStart(draft('09:00', '10:30'), -1)).toMatchObject({ start: '08:45', end: '10:15' });
  });
  it('poravnava na četvrt sata', () => {
    expect(shiftDraftStart(draft('09:07', '10:07'), 1)).toMatchObject({ start: '09:15', end: '10:15' });
    expect(shiftDraftStart(draft('09:07', '10:07'), -1)).toMatchObject({ start: '09:00', end: '10:00' });
  });
  it('rubovi dana: ne ispod 00:00 ni iznad 23:45, kraj najviše 23:59', () => {
    expect(canShiftStart(draft('00:00', '01:00'), -1)).toBe(false);
    expect(shiftDraftStart(draft('23:00', '23:59'), 1)).toMatchObject({ start: '23:15', end: '23:59' });
    expect(canShiftStart(draft('23:45', '23:59'), 1)).toBe(false);
  });
  it('san se omata preko ponoći', () => {
    expect(shiftDraftStart(draft('23:45', '07:00', 'sleep'), 1)).toMatchObject({ start: '00:00', end: '07:00' });
  });
});

describe('shiftDraftEnd', () => {
  it('pomiče kraj', () => {
    expect(shiftDraftEnd(draft('09:00', '10:00'), 1).end).toBe('10:15');
    expect(shiftDraftEnd(draft('09:00', '10:00'), -1).end).toBe('09:45');
  });
  it('kraj ostaje barem 15 min nakon početka', () => {
    expect(canShiftEnd(draft('09:00', '09:15'), -1)).toBe(false);
  });
  it('s 23:45 ide na 23:59 i dalje ne', () => {
    expect(shiftDraftEnd(draft('23:00', '23:45'), 1).end).toBe('23:59');
    expect(canShiftEnd(draft('23:00', '23:59'), 1)).toBe(false);
    expect(shiftDraftEnd(draft('23:00', '23:59'), -1).end).toBe('23:45');
  });
  it('san se omata preko ponoći', () => {
    expect(shiftDraftEnd(draft('23:00', '00:00', 'sleep'), -1).end).toBe('23:45');
  });
});

describe('validacija i pretvorba', () => {
  it('ispravan nacrt', () => {
    expect(isBlockDraftValid(draft('09:00', '10:00'))).toBe(true);
    expect(isBlockDraftValid(draft('23:00', '07:00', 'sleep'))).toBe(true);
  });
  it('prazan naziv, kraj prije početka ili neispravno vrijeme ne prolaze', () => {
    expect(isBlockDraftValid(draft('09:00', '10:00', 'task', '   '))).toBe(false);
    expect(isBlockDraftValid(draft('10:00', '09:00'))).toBe(false);
    expect(isBlockDraftValid(draft('09:00', '24:00'))).toBe(false);
  });
  it('draftToInput: ručni, planiran, bez zadatka, naziv obrezan', () => {
    expect(draftToInput(draft('09:00', '10:00', 'fixed', '  Sastanak '), '2026-11-09')).toEqual({
      date: '2026-11-09',
      title: 'Sastanak',
      start: '09:00',
      end: '10:00',
      kind: 'fixed',
      taskId: null,
      source: 'user',
      status: 'planned',
    });
  });
  it('draftFromBlock i draftToPatch mijenjaju samo naziv, vrijeme i tip', () => {
    const b = { ...block('a', '09:00', '10:00', 'calendar'), status: 'done' as const };
    const d = draftFromBlock(b);
    expect(d).toEqual(draft('09:00', '10:00', 'calendar', 'a'));
    expect(draftToPatch({ ...d, title: ' Novo ' })).toEqual({
      title: 'Novo',
      start: '09:00',
      end: '10:00',
      kind: 'calendar',
    });
  });
});
