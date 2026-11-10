import { describe, expect, it } from '@jest/globals';

import type { BlockKind, BlockStatus } from '../domain';
import {
  blockActions,
  daySchedule,
  formatClockSeconds,
  formatCountdown,
  normalizeNote,
  reportedStatus,
  secondsOfDay,
} from '.';

const hms = (h: number, m = 0, s = 0) => h * 3600 + m * 60 + s;
const block = (
  id: string,
  start: string,
  end: string,
  kind: BlockKind = 'task',
  status: BlockStatus = 'planned',
) => ({ id, start, end, kind, status });

describe('daySchedule', () => {
  const day = [
    block('sleep', '23:00', '07:00', 'sleep'),
    block('a', '08:00', '09:00'),
    block('b', '09:00', '10:30'),
    block('c', '12:00', '13:00', 'fixed'),
  ];

  it('nalazi trenutnu i sljedeću aktivnost s odbrojavanjem u sekundama', () => {
    const view = daySchedule(day, hms(9, 15, 30));
    expect(view.current?.id).toBe('b');
    expect(view.next?.id).toBe('c');
    expect(view.secondsLeft).toBe(hms(10, 30) - hms(9, 15, 30));
    expect(view.secondsUntilNext).toBe(hms(12) - hms(9, 15, 30));
    expect(view.progress).toBeCloseTo((15 * 60 + 30) / (90 * 60));
    expect(view.past.map((b) => b.id)).toEqual(['a']);
    expect(view.upcoming.map((b) => b.id)).toEqual(['c', 'sleep']);
  });

  it('na granici: blok koji završava u 09:00 je prošao, onaj od 09:00 traje', () => {
    const view = daySchedule(day, hms(9));
    expect(view.current?.id).toBe('b');
    expect(view.progress).toBe(0);
  });

  it('u rupi nema trenutne; odbrojava do sljedeće', () => {
    const view = daySchedule(day, hms(11, 0, 10));
    expect(view.current).toBeNull();
    expect(view.secondsLeft).toBeNull();
    expect(view.progress).toBeNull();
    expect(view.next?.id).toBe('c');
    expect(view.secondsUntilNext).toBe(hms(12) - hms(11, 0, 10));
  });

  it('san nikad nije trenutna ni sljedeća aktivnost i ne ide u prošle', () => {
    const view = daySchedule(day, hms(23, 30));
    expect(view.current).toBeNull();
    expect(view.next).toBeNull();
    expect(view.past.map((b) => b.id)).toEqual(['a', 'b', 'c']);
    expect(view.upcoming.map((b) => b.id)).toEqual(['sleep']);
  });

  it('otkazana aktivnost nije trenutna ni sljedeća, ali ostaje na rasporedu', () => {
    const blocks = [block('x', '10:00', '11:00', 'task', 'skipped'), block('y', '11:00', '12:00')];
    const view = daySchedule(blocks, hms(10, 30));
    expect(view.current).toBeNull();
    expect(view.next?.id).toBe('y');
    expect(view.upcoming.map((b) => b.id)).toEqual(['x', 'y']);
  });

  it('kod preklapanja trenutna je ona koja je počela kasnije; druga ostaje u ostatku dana', () => {
    const blocks = [block('long', '09:00', '12:00'), block('inner', '10:00', '10:30')];
    const view = daySchedule(blocks, hms(10, 10));
    expect(view.current?.id).toBe('inner');
    expect(view.upcoming.map((b) => b.id)).toEqual(['long']);
    expect(view.next).toBeNull(); // "long" je već počeo
  });

  it('ne mijenja ulazni niz i sortira po početku', () => {
    const blocks = [block('late', '15:00', '16:00'), block('early', '08:00', '09:00')];
    const view = daySchedule(blocks, hms(7));
    expect(view.upcoming.map((b) => b.id)).toEqual(['early', 'late']);
    expect(blocks[0].id).toBe('late');
  });

  it('prazan dan', () => {
    const view = daySchedule([], hms(12));
    expect(view).toMatchObject({ current: null, next: null, past: [], upcoming: [] });
  });
});

describe('formatiranje vremena', () => {
  it('sat u sekundama', () => {
    expect(formatClockSeconds(hms(13, 45, 30))).toBe('13:45:30');
    expect(formatClockSeconds(0)).toBe('00:00:00');
    expect(formatClockSeconds(hms(23, 59, 59))).toBe('23:59:59');
  });

  it('odbrojavanje', () => {
    expect(formatCountdown(247)).toBe('4:07');
    expect(formatCountdown(hms(1, 5, 9))).toBe('1:05:09');
    expect(formatCountdown(59.9)).toBe('0:59');
    expect(formatCountdown(-5)).toBe('0:00');
  });

  it('secondsOfDay', () => {
    expect(secondsOfDay(new Date(2026, 10, 10, 14, 3, 7))).toBe(hms(14, 3, 7));
  });
});

describe('blockActions', () => {
  it('Komentar samo trenutna i prošle; Otkaži samo trenutna i buduće', () => {
    expect(blockActions({ kind: 'task' }, 'past')).toEqual({
      comment: true,
      cancel: false,
      report: ['done', 'partial', 'skipped'],
    });
    expect(blockActions({ kind: 'task' }, 'current')).toEqual({ comment: true, cancel: true, report: ['done'] });
    expect(blockActions({ kind: 'fixed' }, 'upcoming')).toEqual({ comment: false, cancel: true, report: [] });
  });

  it('san nema akcija', () => {
    expect(blockActions({ kind: 'sleep' }, 'current')).toEqual({ comment: false, cancel: false, report: [] });
  });
});

describe('reportedStatus i normalizeNote', () => {
  it('ponovni dodir vraća na planned', () => {
    expect(reportedStatus('planned', 'partial')).toBe('partial');
    expect(reportedStatus('partial', 'partial')).toBe('planned');
    expect(reportedStatus('done', 'skipped')).toBe('skipped');
  });

  it('bilješka', () => {
    expect(normalizeNote('  ')).toBeNull();
    expect(normalizeNote('  kasnio bus ')).toBe('kasnio bus');
    expect(normalizeNote('x'.repeat(2100))).toHaveLength(2000);
  });
});
