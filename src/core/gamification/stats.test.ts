import { describe, expect, it } from '@jest/globals';

import { STAT_WINDOW_DAYS, STATS, statValues, type StatDay } from './stats';
import { addDays } from '../time/local-date';

const TODAY = '2026-11-13';
const day = (offset: number, parts: StatDay['parts'], final = true): StatDay => ({
  date: addDays(TODAY, -offset) ?? '',
  final,
  parts,
});
const byStat = (days: readonly StatDay[], today = TODAY) =>
  Object.fromEntries(statValues(days, today).map((entry) => [entry.stat, entry.value]));

describe('statValues', () => {
  it('uvijek vraća svih pet statova istim redom', () => {
    expect(statValues([], TODAY).map((entry) => entry.stat)).toEqual([...STATS]);
  });

  it('bez podataka: mjereni statovi nemaju vrijednost, Zdravlje i Novac čekaju tracker', () => {
    expect(statValues([], TODAY)).toEqual([
      { stat: 'discipline', value: null, days: 0, source: 'measured' },
      { stat: 'will', value: null, days: 0, source: 'measured' },
      { stat: 'energy', value: null, days: 0, source: 'measured' },
      { stat: 'health', value: null, days: 0, source: 'tracker' },
      { stat: 'money', value: null, days: 0, source: 'tracker' },
    ]);
  });

  it('Disciplina = plan, Volja = zabrane, Energija = san (prosjek, 0–100)', () => {
    const days = [
      day(0, { plan: 1, rules: 1, sleep: 0.5 }),
      day(1, { plan: 0.5, rules: 0, sleep: null }),
    ];
    expect(byStat(days)).toEqual({ discipline: 75, will: 50, energy: 50, health: null, money: null });
    expect(statValues(days, TODAY).find((entry) => entry.stat === 'energy')?.days).toBe(1);
  });

  it('neodabrano područje (null svaki dan) ostaje bez vrijednosti', () => {
    expect(byStat([day(0, { plan: 0.8, rules: null, sleep: null })])).toMatchObject({
      discipline: 80,
      will: null,
      energy: null,
    });
  });

  it('rezultat „u tijeku“ i dan bez dijelova ne ulaze', () => {
    const days = [day(0, { plan: 0, rules: 0, sleep: 0 }, false), day(1, undefined), day(2, { plan: 1, rules: null, sleep: null })];
    expect(byStat(days).discipline).toBe(100);
  });

  it(`gleda zadnjih ${STAT_WINDOW_DAYS} dana uključujući danas; stariji i budući dani ne ulaze`, () => {
    const days = [
      day(STAT_WINDOW_DAYS - 1, { plan: 1, rules: null, sleep: null }),
      day(STAT_WINDOW_DAYS, { plan: 0, rules: null, sleep: null }),
      day(-1, { plan: 0, rules: null, sleep: null }),
    ];
    expect(byStat(days).discipline).toBe(100);
  });

  it('isti dan dvaput broji se jednom; vrijednosti izvan 0–1 se ograniče', () => {
    const days = [day(0, { plan: 1, rules: 7, sleep: -2 }), day(0, { plan: 0, rules: 0, sleep: 0 })];
    expect(byStat(days)).toMatchObject({ discipline: 100, will: 100, energy: 0 });
  });

  it('neispravan današnji dan: sve bez vrijednosti', () => {
    expect(byStat([day(0, { plan: 1, rules: 1, sleep: 1 })], 'x')).toMatchObject({ discipline: null, will: null, energy: null });
  });
});
