import { describe, expect, it } from '@jest/globals';

import { COLOR_THEMES, DEFAULT_COLOR_THEME } from '../theme';
import { levelProgress } from './level';
import {
  isThemeUnlocked,
  levelUp,
  nextUnlocks,
  parseSeenLevel,
  themeUnlockLevel,
  titleAt,
  TITLES,
  unlockedThemes,
  UNLOCKS,
  unlocksBetween,
  usableTheme,
} from './unlocks';

describe('tablica otključavanja', () => {
  it('ide uzlazno po razini i počinje od razine 1', () => {
    const levels = UNLOCKS.map((unlock) => unlock.level);
    expect([...levels].sort((a, b) => a - b)).toEqual(levels);
    expect(levels[0]).toBe(1);
    for (const level of levels) expect(Number.isInteger(level)).toBe(true);
  });

  it('svaka tema i svaki naslov imaju točno jedan redak', () => {
    const themes = UNLOCKS.flatMap((unlock) => (unlock.kind === 'theme' ? [unlock.theme] : []));
    const titles = UNLOCKS.flatMap((unlock) => (unlock.kind === 'title' ? [unlock.title] : []));
    expect([...themes].sort()).toEqual([...COLOR_THEMES].sort());
    expect(titles).toEqual([...TITLES]);
  });

  it('zadana tema i prvi naslov su dostupni od početka', () => {
    expect(themeUnlockLevel(DEFAULT_COLOR_THEME)).toBe(1);
    expect(titleAt(1)).toBe(TITLES[0]);
    expect(unlockedThemes(1)).toEqual([DEFAULT_COLOR_THEME]);
  });

  it('teme se otključavaju redom iz COLOR_THEMES, svaka na višoj razini', () => {
    const levels = COLOR_THEMES.map(themeUnlockLevel);
    for (let i = 1; i < levels.length; i++) expect(levels[i]).toBeGreaterThan(levels[i - 1] ?? 0);
  });

  it('prva nagrada stiže već na razini 2 (100 XP)', () => {
    expect(levelProgress(100).level).toBe(2);
    expect(unlocksBetween(1, 2)).toEqual([{ level: 2, kind: 'title', title: 'earlyBird' }]);
  });
});

describe('teme po razini', () => {
  it('tema je zaključana ispod svoje razine i otključana od nje', () => {
    expect(isThemeUnlocked('rose', 2)).toBe(false);
    expect(isThemeUnlocked('rose', 3)).toBe(true);
    expect(isThemeUnlocked('violet', 11)).toBe(false);
    expect(isThemeUnlocked('violet', 12)).toBe(true);
    expect(isThemeUnlocked('violet', 40)).toBe(true);
  });

  it('popis otključanih tema raste s razinom i nikad ne gubi temu', () => {
    let previous: string[] = [];
    for (let level = 1; level <= 20; level++) {
      const themes = unlockedThemes(level);
      for (const theme of previous) expect(themes).toContain(theme);
      previous = themes;
    }
    expect(previous).toEqual([...COLOR_THEMES]);
  });

  it('neispravna razina se tretira kao 1', () => {
    for (const bad of [0, -3, Number.NaN, Number.POSITIVE_INFINITY]) {
      expect(unlockedThemes(bad)).toEqual([DEFAULT_COLOR_THEME]);
      expect(titleAt(bad)).toBe('spark');
    }
    expect(isThemeUnlocked('rose', 3.9)).toBe(true);
    expect(isThemeUnlocked('rose', 2.9)).toBe(false);
  });

  it('usableTheme vraća zadanu temu kad je odabrana zaključana', () => {
    expect(usableTheme('azure', 5)).toBe('azure');
    expect(usableTheme('azure', 4)).toBe('ember');
    expect(usableTheme('ember', 1)).toBe('ember');
  });
});

describe('naslovi', () => {
  it('vrijedi zadnji osvojeni naslov', () => {
    expect(titleAt(1)).toBe('spark');
    expect(titleAt(2)).toBe('earlyBird');
    expect(titleAt(3)).toBe('earlyBird');
    expect(titleAt(4)).toBe('flameKeeper');
    expect(titleAt(9)).toBe('routineMaster');
    expect(titleAt(15)).toBe('eternalFlame');
    expect(titleAt(99)).toBe('eternalFlame');
  });
});

describe('nextUnlocks', () => {
  it('prva sljedeća razina koja nešto otključava', () => {
    expect(nextUnlocks(1)).toEqual({ level: 2, unlocks: [{ level: 2, kind: 'title', title: 'earlyBird' }] });
    expect(nextUnlocks(6)).toEqual({ level: 8, unlocks: [{ level: 8, kind: 'theme', theme: 'aurora' }] });
  });

  it('kad je sve otključano nema sljedećeg', () => {
    expect(nextUnlocks(15)).toBeNull();
    expect(nextUnlocks(30)).toBeNull();
  });
});

describe('levelUp', () => {
  it('prvo bilježenje razine se ne slavi', () => {
    expect(levelUp(null, 1)).toBeNull();
    expect(levelUp(null, 7)).toBeNull();
    expect(levelUp(Number.NaN, 7)).toBeNull();
  });

  it('ista ili niža razina se ne slavi', () => {
    expect(levelUp(3, 3)).toBeNull();
    expect(levelUp(5, 2)).toBeNull();
  });

  it('rast za jednu razinu nosi što je ta razina otključala', () => {
    expect(levelUp(2, 3)).toEqual({ from: 2, to: 3, unlocks: [{ level: 3, kind: 'theme', theme: 'rose' }] });
  });

  it('razina bez otključavanja se i dalje slavi, s praznim popisom', () => {
    expect(levelUp(6, 7)).toEqual({ from: 6, to: 7, unlocks: [] });
  });

  it('skok za više razina (app je bio zatvoren) skuplja sve preskočeno', () => {
    const up = levelUp(1, 5);
    expect(up?.from).toBe(1);
    expect(up?.to).toBe(5);
    expect(up?.unlocks.map((unlock) => unlock.level)).toEqual([2, 3, 4, 5]);
  });

  it('unlocksBetween ne uključuje donju granicu i uključuje gornju', () => {
    expect(unlocksBetween(3, 3)).toEqual([]);
    expect(unlocksBetween(3, 4)).toEqual([{ level: 4, kind: 'title', title: 'flameKeeper' }]);
    expect(unlocksBetween(5, 2)).toEqual([]);
  });
});

describe('parseSeenLevel', () => {
  it('čita spremljeni broj, sve ostalo je null', () => {
    expect(parseSeenLevel('7')).toBe(7);
    expect(parseSeenLevel('1')).toBe(1);
    for (const bad of [null, '', '0', '-2', '3.5', 'abc', '1e3', ' 4', '9999999']) expect(parseSeenLevel(bad)).toBeNull();
  });
});
