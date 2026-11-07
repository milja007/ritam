import { describe, expect, it } from '@jest/globals';

import { formatClock, MINUTES_PER_DAY, parseClock } from './clock';

describe('parseClock', () => {
  it.each([
    ['00:00', 0],
    ['07:30', 450],
    ['7:30', 450],
    [' 22:15 ', 1335],
    ['23:59', MINUTES_PER_DAY - 1],
  ])('%p → %p', (input, expected) => {
    expect(parseClock(input)).toBe(expected);
  });

  it.each(['', '24:00', '12:60', '7:5', '123:00', 'ab:cd', '07-30', '07:30:00', '-1:00'])(
    'vraća null za %p',
    (input) => {
      expect(parseClock(input)).toBeNull();
    },
  );
});

describe('formatClock', () => {
  it.each([
    [0, '00:00'],
    [450, '07:30'],
    [1335, '22:15'],
    [MINUTES_PER_DAY - 1, '23:59'],
  ])('%p → %p', (input, expected) => {
    expect(formatClock(input)).toBe(expected);
  });

  it.each([-1, MINUTES_PER_DAY, 7.5, Number.NaN, Number.POSITIVE_INFINITY])(
    'vraća null za %p',
    (input) => {
      expect(formatClock(input)).toBeNull();
    },
  );

  it('je inverz od parseClock za svaku minutu dana', () => {
    for (let m = 0; m < MINUTES_PER_DAY; m += 1) {
      const text = formatClock(m);
      expect(text).not.toBeNull();
      expect(parseClock(text as string)).toBe(m);
    }
  });
});
