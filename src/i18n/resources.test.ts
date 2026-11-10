import { describe, expect, it } from '@jest/globals';

import en from './en.json';
import hr from './hr.json';

type Tree = { [key: string]: string | Tree };

function leafKeys(tree: Tree, prefix = ''): string[] {
  return Object.entries(tree).flatMap(([key, value]) => {
    const path = prefix ? `${prefix}.${key}` : key;
    return typeof value === 'string' ? [path] : leafKeys(value, path);
  });
}

/** Oblici množine po jeziku (`_one`, `_few`, `_other` …) — HR ima `_few`, EN nema. */
const PLURAL_SUFFIX = /_(zero|one|two|few|many|other)$/;

/** Ključevi bez oblika množine (jedan ključ po množini). */
function baseKeys(tree: Tree): string[] {
  return [...new Set(leafKeys(tree).map((key) => key.replace(PLURAL_SUFFIX, '')))].sort();
}

describe('prijevodi', () => {
  it('HR i EN imaju identične ključeve (množine se uspoređuju po osnovnom ključu)', () => {
    expect(baseKeys(en as Tree)).toEqual(baseKeys(hr as Tree));
  });

  it('svaka množina ima oblik _other u oba jezika', () => {
    for (const tree of [hr, en] as Tree[]) {
      const keys = new Set(leafKeys(tree));
      for (const key of keys) {
        if (PLURAL_SUFFIX.test(key)) expect(keys.has(key.replace(PLURAL_SUFFIX, '_other'))).toBe(true);
      }
    }
  });

  it('nijedan prijevod nije prazan', () => {
    for (const tree of [hr, en] as Tree[]) {
      for (const key of leafKeys(tree)) {
        const value = key.split('.').reduce<string | Tree>((node, part) => (node as Tree)[part], tree);
        expect(typeof value === 'string' && value.trim().length > 0).toBe(true);
      }
    }
  });
});
