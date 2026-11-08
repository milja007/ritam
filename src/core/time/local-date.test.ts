import { describe, expect, it } from '@jest/globals';

import { addDays, daysBetween, localDateOf } from './local-date';

describe('addDays', () => {
  it('pomiče preko kraja mjeseca i godine', () => {
    expect(addDays('2026-11-30', 1)).toBe('2026-12-01');
    expect(addDays('2026-12-31', 1)).toBe('2027-01-01');
    expect(addDays('2027-01-01', -1)).toBe('2026-12-31');
  });

  it('poštuje prijestupne godine', () => {
    expect(addDays('2028-02-28', 1)).toBe('2028-02-29');
    expect(addDays('2027-02-28', 1)).toBe('2027-03-01');
  });

  it('nula vraća isti dan; preko DST prijelaza nema pomaka', () => {
    expect(addDays('2026-11-08', 0)).toBe('2026-11-08');
    expect(addDays('2026-03-28', 2)).toBe('2026-03-30');
    expect(addDays('2026-10-24', 2)).toBe('2026-10-26');
  });

  it('odbija neispravan unos', () => {
    expect(addDays('2026-02-30', 1)).toBeNull();
    expect(addDays('2026-1-1', 1)).toBeNull();
    expect(addDays('2026-11-08', 1.5)).toBeNull();
  });
});

describe('daysBetween', () => {
  it('broji dane s predznakom', () => {
    expect(daysBetween('2026-11-08', '2026-11-08')).toBe(0);
    expect(daysBetween('2026-11-07', '2026-11-08')).toBe(1);
    expect(daysBetween('2026-11-08', '2026-11-01')).toBe(-7);
    expect(daysBetween('2026-12-31', '2027-03-01')).toBe(60);
  });

  it('odbija neispravan unos', () => {
    expect(daysBetween('x', '2026-11-08')).toBeNull();
  });
});

describe('localDateOf', () => {
  it('formatira lokalni dan', () => {
    expect(localDateOf(new Date(2026, 0, 5, 23, 59))).toBe('2026-01-05');
  });
});
