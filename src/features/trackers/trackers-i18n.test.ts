import { describe, expect, it } from '@jest/globals';

import en from '@/i18n/en.json';
import hr from '@/i18n/hr.json';

/** Svi listovi stabla ključeva, npr. `card.overline`. */
function leaves(node: unknown, prefix = ''): string[] {
  if (typeof node !== 'object' || node === null) return [prefix];
  return Object.entries(node).flatMap(([key, value]) => leaves(value, prefix ? `${prefix}.${key}` : key));
}

describe('trackeri i18n (korak 31b)', () => {
  it('HR i EN imaju iste ključeve i nijedan nije prazan', () => {
    expect(leaves(hr.trackers).sort()).toEqual(leaves(en.trackers).sort());
    for (const dict of [hr.trackers, en.trackers]) {
      for (const key of leaves(dict)) {
        const value = key.split('.').reduce<unknown>((node, part) => (node as Record<string, unknown>)[part], dict);
        expect(typeof value === 'string' && value.length > 0).toBe(true);
      }
    }
  });

  it('tekstovi s iznosom imaju mjesto za iznos', () => {
    for (const dict of [hr.trackers, en.trackers]) {
      expect(dict.money.left).toContain('{{value}}');
      expect(dict.money.limit.week).toContain('{{spent}}');
      expect(dict.calories.over).toContain('{{diff}}');
    }
  });
});
