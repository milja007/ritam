import { describe, expect, it } from '@jest/globals';

import { EMBER_LEVELS, emberColor, railColors, segmentColor } from '../ember/ember';
import { orbFlameColors } from '../gamification/orb';
import { contrastRatio, parseHex, relativeLuminance } from './contrast';
import { COLOR_THEMES, colorThemeOr, DEFAULT_COLOR_THEME, flamePalettes, isColorThemeId } from './flame';
import { accentOf, palette, themeFor, themes } from './tokens';

const schemes = ['dark', 'light'] as const;
const ratio = (a: string, b: string) => contrastRatio(a, b) ?? 0;
const lum = (hex: string) => relativeLuminance(hex) ?? 0;

describe('teme boja plamena', () => {
  it('zadana tema je „Žar“ i prva je na popisu; identifikatori su jedinstveni', () => {
    expect(DEFAULT_COLOR_THEME).toBe('ember');
    expect(COLOR_THEMES[0]).toBe(DEFAULT_COLOR_THEME);
    expect(new Set(COLOR_THEMES).size).toBe(COLOR_THEMES.length);
    expect(Object.keys(flamePalettes).sort()).toEqual([...COLOR_THEMES].sort());
  });

  it('zadana paleta je ista kao dosadašnji plamen i žar', () => {
    expect(flamePalettes.ember.flame400).toBe(palette.flame400);
    expect(flamePalettes.ember.ember800).toBe(palette.ember800);
    expect(palette.flame400).toBe('#FF9F43');
  });

  it('svaka tema ima istih 11 boja, sve ispravni #RRGGBB', () => {
    const keys = Object.keys(flamePalettes.ember).sort();
    expect(keys).toHaveLength(11);
    for (const id of COLOR_THEMES) {
      expect(Object.keys(flamePalettes[id]).sort()).toEqual(keys);
      for (const value of Object.values(flamePalettes[id])) expect(parseHex(value)).not.toBeNull();
    }
  });

  it('teme se stvarno razlikuju (akcent svake teme je drugi)', () => {
    for (const scheme of schemes) {
      const accents = COLOR_THEMES.map((id) => themeFor(scheme, id).colors.accent);
      expect(new Set(accents).size).toBe(COLOR_THEMES.length);
    }
  });

  it('žar svake teme ide od najsvjetlijeg do najtamnijeg', () => {
    for (const id of COLOR_THEMES) {
      const p = flamePalettes[id];
      const ramp = [p.ember50, p.ember100, p.ember200, p.ember400, p.ember600, p.ember800, p.ember900].map(lum);
      for (let i = 1; i < ramp.length; i++) expect(ramp[i]).toBeLessThan(ramp[i - 1] ?? 1);
      expect(lum(p.flame300)).toBeGreaterThan(lum(p.flame400));
      expect(lum(p.flame400)).toBeGreaterThan(lum(p.flame600));
      expect(lum(p.flame600)).toBeGreaterThan(lum(p.flame700));
    }
  });

  it('isColorThemeId i colorThemeOr: nepoznato, prazno i krivi tip daju zadanu temu', () => {
    expect(isColorThemeId('azure')).toBe(true);
    expect(isColorThemeId('Azure')).toBe(false);
    expect(isColorThemeId(null)).toBe(false);
    expect(colorThemeOr('violet')).toBe('violet');
    for (const bad of [null, undefined, '', 'crvena', 3, {}]) expect(colorThemeOr(bad)).toBe('ember');
  });
});

describe('themeFor', () => {
  it('zadana tema vraća postojeće teme nepromijenjene', () => {
    for (const scheme of schemes) {
      expect(themeFor(scheme)).toBe(themes[scheme]);
      expect(themeFor(scheme, 'ember')).toBe(themes[scheme]);
    }
  });

  it('tema mijenja samo plamen: akcent i paletu, ne pozadine, tekst, statuse ni gradijente', () => {
    for (const scheme of schemes) {
      const base = themes[scheme];
      for (const id of COLOR_THEMES) {
        const theme = themeFor(scheme, id);
        expect(theme.colorTheme).toBe(id);
        expect(theme.flame).toBe(flamePalettes[id]);
        expect(theme.scheme).toBe(scheme);
        expect(theme.gradients).toBe(base.gradients);
        expect({ ...theme.colors, accent: '' }).toEqual({ ...base.colors, accent: '' });
        expect(theme.colors.accent).toBe(accentOf(flamePalettes[id], scheme));
      }
    }
  });

  describe.each(COLOR_THEMES)('čitljivost teme %s', (id) => {
    it.each(schemes)('akcent ≥ 4.5 na pozadini i površini, onAccent ≥ 4.5 na akcentu (%s)', (scheme) => {
      const { colors } = themeFor(scheme, id);
      expect(ratio(colors.accent, colors.background)).toBeGreaterThanOrEqual(4.5);
      expect(ratio(colors.accent, colors.surface)).toBeGreaterThanOrEqual(4.5);
      expect(ratio(colors.onAccent, colors.accent)).toBeGreaterThanOrEqual(4.5);
    });

    it.each(schemes)('žarovi: tekst na žaru čitljiv, razine se razlikuju svjetlinom (%s)', (scheme) => {
      const flame = flamePalettes[id];
      const lit = EMBER_LEVELS.filter((level) => level !== 'unlit');
      const fills = lit.map((level) => {
        const { fill, on } = emberColor(level, scheme, flame);
        expect(parseHex(fill ?? '')).not.toBeNull();
        expect(ratio(on, fill ?? '')).toBeGreaterThanOrEqual(4.5);
        return lum(fill ?? '');
      });
      for (let i = 1; i < fills.length; i++) {
        if (scheme === 'dark') expect(fills[i]).toBeGreaterThan(fills[i - 1] ?? 0);
        else expect(fills[i]).toBeLessThan(fills[i - 1] ?? 1);
      }
      expect(emberColor('unlit', scheme, flame).fill).toBeNull();
    });

    it.each(schemes)('traka dana, odsječci tjedna i orb koriste boje teme (%s)', (scheme) => {
      const flame = flamePalettes[id];
      const { colors } = themeFor(scheme, id);
      const own = new Set<string>(Object.values(flame));
      const rail = railColors(scheme, flame);
      for (const value of [rail.lit, rail.half, rail.burnt, ...Object.values(rail.orb)]) expect(own.has(value)).toBe(true);
      // Odrađena točka mora se vidjeti na pozadini (grafički element: ≥ 3).
      expect(ratio(rail.lit, colors.background)).toBeGreaterThanOrEqual(3);
      expect(own.has(segmentColor('done', scheme, flame).fill ?? '')).toBe(true);
      // Fiksne obaveze ostaju plave u svakoj temi; ugašeno ostaje sivo.
      expect(segmentColor('fixed', scheme, flame)).toEqual(segmentColor('fixed', scheme));
      expect(segmentColor('missed', scheme, flame)).toEqual(segmentColor('missed', scheme));
      for (const level of EMBER_LEVELS.filter((l) => l !== 'unlit')) {
        const orb = orbFlameColors(level, scheme, flame);
        for (const key of ['core', 'mid', 'glow', 'edge'] as const) expect(own.has(orb[key])).toBe(true);
        expect(own.has(orb.spark)).toBe(true);
      }
      expect(orbFlameColors('unlit', scheme, flame).core).toBe('transparent');
    });
  });

  it('bez proslijeđene palete vrijedi zadana tema', () => {
    for (const scheme of schemes) {
      expect(emberColor('warm', scheme)).toEqual(emberColor('warm', scheme, flamePalettes.ember));
      expect(railColors(scheme)).toEqual(railColors(scheme, flamePalettes.ember));
      expect(orbFlameColors('bright', scheme)).toEqual(orbFlameColors('bright', scheme, flamePalettes.ember));
    }
  });
});
