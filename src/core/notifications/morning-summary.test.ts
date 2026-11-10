import { describe, expect, it } from '@jest/globals';

import { contentKey, isDailyTriggerId, morningSummary, triggerIdWithContent } from '.';

type B = Parameters<typeof morningSummary>[0][number];

const DAY = '2026-11-12';

function b(title: string, start: string, overrides: Partial<B> = {}): B {
  return { date: DAY, title, start, kind: 'task', status: 'planned', ...overrides };
}

describe('morningSummary', () => {
  it('broji blokove dana bez sna, premještenih i preskočenih; prvi po vremenu', () => {
    const blocks = [
      b('Trening', '18:00'),
      b('Posao', '09:00', { kind: 'fixed' }),
      b('Učenje', '20:00', { status: 'done' }),
      b('San', '23:00', { kind: 'sleep' }),
      b('Premješteno', '07:00', { status: 'moved' }),
      b('Preskočeno', '08:00', { status: 'skipped' }),
      b('Sutra', '06:00', { date: '2026-11-13' }),
    ];
    expect(morningSummary(blocks, DAY)).toEqual({
      blocks: 3,
      tasks: 2,
      first: { title: 'Posao', start: '09:00' },
    });
  });

  it('dan bez blokova → 0 i bez prvog', () => {
    expect(morningSummary([b('San', '23:00', { kind: 'sleep' })], DAY)).toEqual({
      blocks: 0,
      tasks: 0,
      first: null,
    });
  });
});

describe('contentKey', () => {
  it('stabilan i različit za različit tekst', () => {
    expect(contentKey('Danas 3 bloka')).toBe(contentKey('Danas 3 bloka'));
    expect(contentKey('Danas 3 bloka')).not.toBe(contentKey('Danas 4 bloka'));
    expect(contentKey('')).toMatch(/^[0-9a-z]+$/);
  });

  it('id s ključem je i dalje naš dnevni okidač', () => {
    const id = triggerIdWithContent('morning:2026-11-12@07:00', contentKey('x'));
    expect(isDailyTriggerId(id)).toBe(true);
    expect(isDailyTriggerId('morning:2026-11-12@07:00#')).toBe(false);
  });
});
