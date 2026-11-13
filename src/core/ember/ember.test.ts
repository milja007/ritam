import { describe, expect, it } from '@jest/globals';

import { contrastRatio, parseHex, relativeLuminance } from '../theme';
import { EMBER_LEVELS, emberColor, emberLevel, railLine, railState } from './ember';

describe('emberLevel', () => {
  it('dan bez rezultata je ugašen žar', () => {
    expect(emberLevel(null)).toBe('unlit');
    expect(emberLevel(Number.NaN)).toBe('unlit');
  });

  it('dan s rezultatom uvijek barem tinja', () => {
    expect(emberLevel(0)).toBe('faint');
    expect(emberLevel(54)).toBe('faint');
  });

  it('granice 55 / 70 / 85', () => {
    expect(emberLevel(55)).toBe('low');
    expect(emberLevel(69)).toBe('low');
    expect(emberLevel(70)).toBe('warm');
    expect(emberLevel(84)).toBe('warm');
    expect(emberLevel(85)).toBe('bright');
    expect(emberLevel(100)).toBe('bright');
  });
});

describe('emberColor', () => {
  const lit = EMBER_LEVELS.filter((level) => level !== 'unlit');

  it('ugašen žar nema ispunu ni sjaj', () => {
    for (const scheme of ['dark', 'light'] as const) {
      const color = emberColor('unlit', scheme);
      expect(color.fill).toBeNull();
      expect(color.glow).toBe(0);
    }
  });

  it('sve boje su ispravni #RRGGBB, tekst na žaru je čitljiv (≥ 4.5)', () => {
    for (const scheme of ['dark', 'light'] as const) {
      for (const level of lit) {
        const { fill, on } = emberColor(level, scheme);
        expect(fill).not.toBeNull();
        expect(parseHex(fill ?? '')).not.toBeNull();
        expect(contrastRatio(on, fill ?? '')).toBeGreaterThanOrEqual(4.5);
      }
    }
  });

  it('sjaj raste s razinom', () => {
    const glows = EMBER_LEVELS.map((level) => emberColor(level, 'dark').glow);
    expect([...glows].sort((a, b) => a - b)).toEqual(glows);
    expect(new Set(glows).size).toBe(glows.length);
  });

  it('razine se razlikuju svjetlinom, ne samo nijansom: tamna shema svjetlija, svijetla tamnija', () => {
    const lum = (scheme: 'dark' | 'light') =>
      lit.map((level) => relativeLuminance(emberColor(level, scheme).fill ?? '') ?? 0);
    const dark = lum('dark');
    const light = lum('light');
    for (let i = 1; i < lit.length; i++) {
      expect(dark[i]).toBeGreaterThan(dark[i - 1] ?? 0);
      expect(light[i]).toBeLessThan(light[i - 1] ?? 1);
    }
  });
});

describe('railState', () => {
  const task = (status: 'planned' | 'done' | 'partial' | 'skipped' | 'moved') =>
    ({ status, kind: 'task' }) as const;

  it('odrađeno svijetli, djelomično je pola', () => {
    expect(railState(task('done'), 'past')).toBe('lit');
    expect(railState(task('done'), 'current')).toBe('lit');
    expect(railState(task('partial'), 'past')).toBe('half');
  });

  it('neodrađeno, otkazano, premješteno i neprijavljeno su ugašen žar', () => {
    expect(railState(task('skipped'), 'past')).toBe('unlit');
    expect(railState(task('skipped'), 'upcoming')).toBe('unlit');
    expect(railState(task('moved'), 'past')).toBe('unlit');
    expect(railState(task('planned'), 'past')).toBe('unlit');
  });

  it('aktivnost koja traje je plamen, plan ispred je tek ocrtan', () => {
    expect(railState(task('planned'), 'current')).toBe('now');
    expect(railState(task('planned'), 'upcoming')).toBe('ahead');
  });

  it('san nikad nije plamen', () => {
    expect(railState({ status: 'planned', kind: 'sleep' }, 'current')).toBe('ahead');
  });
});

describe('railLine', () => {
  it('iza plamena je izgorjela, ispred ocrtana', () => {
    expect(railLine('past')).toBe('burnt');
    expect(railLine('current')).toBe('ahead');
    expect(railLine('upcoming')).toBe('ahead');
  });
});
