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

describe('prijevodi', () => {
  it('HR i EN imaju identične ključeve', () => {
    expect(leafKeys(en).sort()).toEqual(leafKeys(hr).sort());
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
