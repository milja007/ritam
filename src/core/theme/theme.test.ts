import { describe, expect, it } from '@jest/globals';

import { contrastRatio, parseHex, relativeLuminance } from './contrast';
import { clampFraction, FILL_DURATION_MS, IGNITE_DURATION_MS, IGNITE_SWELL_MS } from './motion';
import { dayPhaseAt, dayPhaseOf, linearGradientCss, PHASE_STARTS, phaseStartsFor } from './phase';
import { DAY_PHASES, DEFAULT_SCHEME, spacing, radius, themes, typography } from './tokens';

describe('dayPhaseAt', () => {
  it.each([
    [0, 'evening'],
    [4 * 60 + 59, 'evening'],
    [5 * 60, 'dawn'],
    [8 * 60 + 59, 'dawn'],
    [9 * 60, 'day'],
    [17 * 60 + 59, 'day'],
    [18 * 60, 'evening'],
    [23 * 60 + 59, 'evening'],
  ])('minuta %p → %p', (minute, phase) => {
    expect(dayPhaseAt(minute)).toBe(phase);
  });

  it('omata vrijednosti izvan dana', () => {
    expect(dayPhaseAt(24 * 60 + 6 * 60)).toBe('dawn');
    expect(dayPhaseAt(-60)).toBe('evening');
  });

  it('granice faza idu redom zora < dan < večer', () => {
    expect(PHASE_STARTS.dawn).toBeLessThan(PHASE_STARTS.day);
    expect(PHASE_STARTS.day).toBeLessThan(PHASE_STARTS.evening);
  });

  it('granice prate buđenje: zora +3 h, večer 5 h prije kreveta', () => {
    const starts = phaseStartsFor('07:00', 8);
    expect(starts).toEqual({ dawn: 7 * 60, day: 10 * 60, evening: 18 * 60 });
    expect(dayPhaseAt(6 * 60 + 59, starts ?? PHASE_STARTS)).toBe('evening');
    expect(dayPhaseAt(7 * 60, starts ?? PHASE_STARTS)).toBe('dawn');
    expect(dayPhaseAt(10 * 60, starts ?? PHASE_STARTS)).toBe('day');
    expect(dayPhaseAt(18 * 60, starts ?? PHASE_STARTS)).toBe('evening');
    expect(phaseStartsFor('05:30', 7.5)).toEqual({ dawn: 330, day: 510, evening: 1020 }); // krevet 22:00
  });

  it('kasno buđenje preko ponoći i vrlo dug san', () => {
    // Noćna smjena: buđenje 22:00, 8 h sna → zora 22–01, dan 01–09, večer 09–22.
    const night = phaseStartsFor('22:00', 8);
    expect(night).toEqual({ dawn: 22 * 60, day: 60, evening: 9 * 60 });
    expect(dayPhaseAt(23 * 60, night ?? PHASE_STARTS)).toBe('dawn');
    expect(dayPhaseAt(3 * 60, night ?? PHASE_STARTS)).toBe('day');
    expect(dayPhaseAt(12 * 60, night ?? PHASE_STARTS)).toBe('evening');
    // 12 h sna: krevet 20:00 → večer od 15:00.
    expect(phaseStartsFor('08:00', 12)).toEqual({ dawn: 480, day: 660, evening: 900 });
    expect(phaseStartsFor('8', 8)).toBeNull();
  });

  it('dayPhaseOf koristi lokalno vrijeme datuma', () => {
    expect(dayPhaseOf(new Date(2026, 10, 7, 6, 30))).toBe('dawn');
    expect(dayPhaseOf(new Date(2026, 10, 7, 13, 0))).toBe('day');
    expect(dayPhaseOf(new Date(2026, 10, 7, 21, 15))).toBe('evening');
  });
});

describe('linearGradientCss', () => {
  it('gradi CSS string', () => {
    expect(linearGradientCss({ colors: ['#000000', '#FFFFFF'], angle: 180 })).toBe(
      'linear-gradient(180deg, #000000, #FFFFFF)',
    );
  });
});

describe('kontrast', () => {
  it('parseHex', () => {
    expect(parseHex('#FF9F43')).toEqual([255, 159, 67]);
    expect(parseHex('FF9F43')).toBeNull();
    expect(parseHex('#FFF')).toBeNull();
  });

  it('crna/bijela su krajnosti', () => {
    expect(relativeLuminance('#000000')).toBe(0);
    expect(relativeLuminance('#FFFFFF')).toBeCloseTo(1);
    expect(contrastRatio('#000000', '#FFFFFF')).toBeCloseTo(21);
    expect(contrastRatio('#FFFFFF', '#000000')).toBeCloseTo(21);
    expect(contrastRatio('#123456', '#123456')).toBeCloseTo(1);
    expect(contrastRatio('nope', '#000000')).toBeNull();
  });
});

describe('teme', () => {
  const schemes = ['dark', 'light'] as const;

  it('zadana shema je tamna (dark-first)', () => {
    expect(DEFAULT_SCHEME).toBe('dark');
  });

  it('obje sheme imaju iste semantičke ključeve i sve faze gradijenta', () => {
    expect(Object.keys(themes.light.colors).sort()).toEqual(Object.keys(themes.dark.colors).sort());
    for (const scheme of schemes) {
      expect(themes[scheme].scheme).toBe(scheme);
      expect(Object.keys(themes[scheme].gradients).sort()).toEqual([...DAY_PHASES].sort());
    }
  });

  it('sve boje su ispravni #RRGGBB', () => {
    for (const scheme of schemes) {
      const { colors, gradients } = themes[scheme];
      for (const value of Object.values(colors)) expect(parseHex(value)).not.toBeNull();
      for (const phase of DAY_PHASES) {
        expect(gradients[phase].colors.length).toBeGreaterThanOrEqual(2);
        for (const value of gradients[phase].colors) expect(parseHex(value)).not.toBeNull();
      }
    }
  });

  describe.each(schemes)('čitljivost (%s)', (scheme) => {
    const { colors, gradients } = themes[scheme];
    const ratio = (a: string, b: string) => contrastRatio(a, b) ?? 0;

    it('tekst ≥ 4.5 na pozadini, površinama i svim gradijentima', () => {
      const backgrounds = [
        colors.background,
        colors.surface,
        colors.surfaceRaised,
        ...DAY_PHASES.flatMap((phase) => gradients[phase].colors),
      ];
      for (const bg of backgrounds) expect(ratio(colors.text, bg)).toBeGreaterThanOrEqual(4.5);
    });

    it('prigušeni tekst ≥ 4.5 na pozadini i površini', () => {
      expect(ratio(colors.textMuted, colors.background)).toBeGreaterThanOrEqual(4.5);
      expect(ratio(colors.textMuted, colors.surface)).toBeGreaterThanOrEqual(4.5);
    });

    it('akcent ≥ 3 na pozadini, onAccent ≥ 4.5 na akcentu', () => {
      expect(ratio(colors.accent, colors.background)).toBeGreaterThanOrEqual(3);
      expect(ratio(colors.onAccent, colors.accent)).toBeGreaterThanOrEqual(4.5);
    });

    it('statusne boje ≥ 3 na pozadini', () => {
      for (const c of [colors.success, colors.danger, colors.info]) {
        expect(ratio(c, colors.background)).toBeGreaterThanOrEqual(3);
      }
    });
  });
});

describe('razmaci, radius, tipografija', () => {
  it('razmaci su na 4-pt skali (osim xxs) i rastu', () => {
    const values = Object.values(spacing);
    expect([...values].sort((a, b) => a - b)).toEqual(values);
    for (const [key, value] of Object.entries(spacing)) {
      if (key !== 'xxs') expect(value % 4).toBe(0);
    }
  });

  it('radius raste', () => {
    const values = Object.values(radius);
    expect([...values].sort((a, b) => a - b)).toEqual(values);
  });

  it('lineHeight ≥ fontSize za svaku varijantu', () => {
    for (const token of Object.values(typography)) {
      expect(token.lineHeight).toBeGreaterThanOrEqual(token.fontSize);
    }
  });
});

describe('kretanje', () => {
  it('clampFraction ograničava na 0–1 i neispravan broj svodi na 0', () => {
    expect(clampFraction(0.4)).toBe(0.4);
    expect(clampFraction(-1)).toBe(0);
    expect(clampFraction(7)).toBe(1);
    expect(clampFraction(Number.NaN)).toBe(0);
    expect(clampFraction(Number.POSITIVE_INFINITY)).toBe(0);
  });

  it('ispuna trake je kratka (ispod pola sekunde)', () => {
    expect(FILL_DURATION_MS).toBeGreaterThan(0);
    expect(FILL_DURATION_MS).toBeLessThan(500);
  });

  it('paljenje žara je kratko, a nabujanje je manji dio animacije', () => {
    expect(IGNITE_SWELL_MS).toBeGreaterThan(0);
    expect(IGNITE_SWELL_MS).toBeLessThan(IGNITE_DURATION_MS);
    // Smirivanje traje dulje od nabujanja: žar se upali naglo, pa polako sjedne.
    expect(IGNITE_DURATION_MS - IGNITE_SWELL_MS).toBeGreaterThan(IGNITE_SWELL_MS);
    expect(IGNITE_DURATION_MS).toBeLessThanOrEqual(1200);
  });
});
