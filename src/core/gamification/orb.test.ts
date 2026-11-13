import { describe, expect, it } from '@jest/globals';

import { EMBER_LEVELS } from '../ember/ember';
import { addDays } from '../time/local-date';
import {
  ORB_CORE_SCALE,
  ORB_HEAT_WINDOW_DAYS,
  ORB_PULSE_MS,
  ORB_SPARK_STREAKS,
  orbFlame,
  orbFlameColors,
  orbSparks,
} from './orb';
import { RANKS, type RankDay } from './rank';

// 2026-11-02 je ponedjeljak.
const MONDAY = '2026-11-02';
const day = (offset: number) => addDays(MONDAY, offset) ?? '';

function scored(offset: number, score: number, final = true): RankDay {
  return { date: day(offset), score, final };
}

/** `count` uzastopnih dana niza koji završavaju na dan `end`. */
function run(end: number, count: number): string[] {
  return Array.from({ length: count }, (_, index) => day(end - index));
}

describe('orbSparks', () => {
  it('iskre se pale na 3, 7 i 30 dana niza', () => {
    expect(ORB_SPARK_STREAKS).toEqual([3, 7, 30]);
    expect([0, 2, 3, 6, 7, 29, 30, 400].map(orbSparks)).toEqual([0, 0, 1, 1, 2, 2, 3, 3]);
  });

  it('neispravan ili negativan niz nema iskri', () => {
    expect([Number.NaN, Number.POSITIVE_INFINITY, Number.NEGATIVE_INFINITY, -5].map(orbSparks)).toEqual([0, 0, 0, 0]);
  });
});

describe('orbFlame', () => {
  it('novi korisnik: ugašen plamen ranga E, bez iskri i bez disanja', () => {
    expect(orbFlame([], [], day(0))).toEqual({
      rank: 'E',
      heat: 'unlit',
      state: 'unlit',
      average: null,
      coreScale: ORB_CORE_SCALE.E,
      streak: 0,
      sparks: 0,
      pulseMs: 0,
    });
  });

  it('neispravan današnji dan: ugašen plamen, ne ruši se', () => {
    const flame = orbFlame([scored(0, 90)], [day(0)], 'nije-datum');
    expect(flame.state).toBe('unlit');
    expect(flame.rank).toBe('E');
    expect(flame.sparks).toBe(0);
  });

  it('toplina je prosjek konačnih rezultata zadnjih 7 dana', () => {
    const flame = orbFlame([scored(4, 90), scored(5, 80), scored(6, 71)], [], day(6));
    expect(flame.state).toBe('burning');
    expect(flame.average).toBe(80);
    expect(flame.heat).toBe('warm');
    expect(flame.pulseMs).toBe(ORB_PULSE_MS.warm);
  });

  it('rezultat 0 ipak tinja — dan s rezultatom nikad nije ugašen', () => {
    const flame = orbFlame([scored(6, 0)], [], day(6));
    expect(flame.state).toBe('burning');
    expect(flame.heat).toBe('faint');
  });

  it(`prozor je točno ${ORB_HEAT_WINDOW_DAYS} dana uključujući danas`, () => {
    const today = 10;
    const edge = today - (ORB_HEAT_WINDOW_DAYS - 1);
    expect(orbFlame([scored(edge, 90)], [], day(today)).average).toBe(90);
    expect(orbFlame([scored(edge - 1, 90)], [], day(today)).average).toBeNull();
  });

  it('rezultat „u tijeku“ i budući dan ne griju plamen', () => {
    const flame = orbFlame([scored(6, 95, false), scored(7, 95)], [], day(6));
    expect(flame.state).toBe('unlit');
    expect(flame.average).toBeNull();
  });

  it('bez svježih rezultata jednom upaljen plamen tinja, ne gasi se', () => {
    const flame = orbFlame([scored(0, 92)], [], day(20));
    expect(flame.state).toBe('resting');
    expect(flame.heat).toBe('faint');
    expect(flame.average).toBeNull();
    expect(flame.pulseMs).toBe(ORB_PULSE_MS.faint);
  });

  it('isti dan zapisan dvaput broji se jednom (zadnji zapis)', () => {
    expect(orbFlame([scored(6, 20), scored(6, 80), scored(5, 60)], [], day(6)).average).toBe(70);
  });

  it('neispravan rezultat ili datum se preskače', () => {
    const days: RankDay[] = [
      { date: 'x', score: 90, final: true },
      { date: day(6), score: Number.NaN, final: true },
      scored(5, 60),
    ];
    expect(orbFlame(days, [], day(6)).average).toBe(60);
  });

  it('iskre prate tekući niz; prekinut niz ih gasi', () => {
    const days = [scored(9, 80)];
    expect(orbFlame(days, run(9, 2), day(9)).sparks).toBe(0);
    expect(orbFlame(days, run(9, 3), day(9)).sparks).toBe(1);
    expect(orbFlame(days, run(9, 7), day(9))).toMatchObject({ sparks: 2, streak: 7 });
    // Niz završio prije tri dana: tekući niz je 0.
    expect(orbFlame(days, run(6, 7), day(9))).toMatchObject({ sparks: 0, streak: 0 });
  });

  it('ugašen plamen nema iskri ni kad niz postoji („Odustajem“ bez rezultata)', () => {
    expect(orbFlame([], run(9, 7), day(9))).toMatchObject({ state: 'unlit', streak: 7, sparks: 0 });
  });

  it('jezgra raste s rangom i ne smanjuje se kad plamen tinja', () => {
    // Dva dobra zaključena tjedna (prosjek ≥ 70) → rang D.
    const weeks = [0, 1].flatMap((week) => [0, 1, 2, 3, 4].map((index) => scored(week * 7 + index, 80)));
    const active = orbFlame(weeks, [], day(15));
    expect(active.rank).toBe('D');
    expect(active.coreScale).toBe(ORB_CORE_SCALE.D);
    const later = orbFlame(weeks, [], day(90));
    expect(later.state).toBe('resting');
    expect(later.coreScale).toBe(ORB_CORE_SCALE.D);
  });
});

describe('tokeni orb-plamena', () => {
  it('jezgra strogo raste s rangom i stane u crtkani prsten', () => {
    const scales = RANKS.map((rank) => ORB_CORE_SCALE[rank]);
    for (let i = 1; i < scales.length; i++) expect(scales[i]).toBeGreaterThan(scales[i - 1]);
    expect(scales[0]).toBeGreaterThanOrEqual(0.4);
    expect(scales[scales.length - 1]).toBeLessThan(0.9);
  });

  it('topliji plamen diše brže, ugašen ne diše', () => {
    expect(ORB_PULSE_MS.unlit).toBe(0);
    const lit = EMBER_LEVELS.filter((level) => level !== 'unlit').map((level) => ORB_PULSE_MS[level]);
    for (let i = 1; i < lit.length; i++) expect(lit[i]).toBeLessThan(lit[i - 1]);
  });
});

describe('orbFlameColors', () => {
  it('aureola jača s toplinom u obje sheme', () => {
    for (const scheme of ['dark', 'light'] as const) {
      const halos = EMBER_LEVELS.map((level) => orbFlameColors(level, scheme).halo);
      expect(halos[0]).toBe(0);
      for (let i = 1; i < halos.length; i++) expect(halos[i]).toBeGreaterThan(halos[i - 1]);
    }
  });

  it('ugašen plamen nema ispunu, samo obrub', () => {
    const colors = orbFlameColors('unlit', 'dark');
    expect(colors.core).toBe('transparent');
    expect(colors.edge).not.toBe('transparent');
  });

  it('upaljen plamen ima sve boje gradijenta', () => {
    for (const level of EMBER_LEVELS.filter((l) => l !== 'unlit')) {
      const colors = orbFlameColors(level, 'light');
      for (const key of ['core', 'mid', 'glow', 'edge'] as const) expect(colors[key]).toMatch(/^#[0-9A-F]{6}$/);
    }
  });
});
