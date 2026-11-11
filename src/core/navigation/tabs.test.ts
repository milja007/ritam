import { describe, expect, it } from '@jest/globals';

import { TABS } from './tabs';

describe('tabovi', () => {
  it('su točno Dan · Tjedan · Mjesec · Godina · Profil, tim redom', () => {
    expect(TABS.map((tab) => tab.id)).toEqual(['day', 'week', 'month', 'year', 'profile']);
  });

  it('Dan je početni ekran (ruta index)', () => {
    expect(TABS[0]?.route).toBe('index');
  });

  it('nemaju Questove ni Navike (oni su u Profilu)', () => {
    const routes: string[] = TABS.map((tab) => tab.route);
    expect(routes).not.toContain('quests');
    expect(routes).not.toContain('habits');
  });

  it('rute i nazivi su jedinstveni', () => {
    for (const pick of [
      (tab: (typeof TABS)[number]) => tab.route,
      (tab: (typeof TABS)[number]) => tab.labelKey,
    ]) {
      expect(new Set(TABS.map(pick)).size).toBe(TABS.length);
    }
  });
});
