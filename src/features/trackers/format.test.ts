import { describe, expect, it } from '@jest/globals';

import { formatEuro, formatKcal, parseEuroCents, parseKcal } from './format';

describe('trackeri — unos i prikaz (korak 31b)', () => {
  it('euri u cente', () => {
    expect(parseEuroCents('12')).toBe(1200);
    expect(parseEuroCents('12,5')).toBe(1250);
    expect(parseEuroCents('12.05')).toBe(1205);
    expect(parseEuroCents(' 1 250,00 € ')).toBe(125000);
    expect(parseEuroCents('0')).toBeNull();
    expect(parseEuroCents('12,555')).toBeNull();
    expect(parseEuroCents('-5')).toBeNull();
    expect(parseEuroCents('abc')).toBeNull();
    expect(parseEuroCents('')).toBeNull();
  });

  it('kalorije', () => {
    expect(parseKcal('650')).toBe(650);
    expect(parseKcal('1 200')).toBe(1200);
    expect(parseKcal('1.200')).toBe(1200);
    expect(parseKcal('0')).toBeNull();
    expect(parseKcal('10001')).toBeNull();
    expect(parseKcal('6,5')).toBeNull();
  });

  it('prikaz na jeziku appa', () => {
    expect(formatEuro(1250, 'hr')).toMatch(/12,50/);
    expect(formatEuro(1250, 'en')).toMatch(/12\.50/);
    expect(formatKcal(2200, 'en')).toBe('2,200');
  });
});
