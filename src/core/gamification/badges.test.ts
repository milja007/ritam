import { describe, expect, it } from '@jest/globals';

import {
  BADGE_TARGETS,
  badgeProgress,
  BADGES,
  hasCounter,
  sortBadges,
  type Badge,
  type BadgeDay,
  type BadgeProgress,
} from './badges';
import { addDays } from '../time/local-date';

// 2026-11-02 je ponedjeljak.
const MONDAY = '2026-11-02';
const day = (offset: number) => addDays(MONDAY, offset) ?? '';

function scored(offset: number, score: number, rules: number | null = null, final = true): BadgeDay {
  return { date: day(offset), score, final, parts: { plan: score / 100, rules, sleep: null } };
}

/** `count` konačnih dana zaredom od `from`. */
function run(from: number, count: number, score = 60, rules: number | null = null): BadgeDay[] {
  return Array.from({ length: count }, (_, index) => scored(from + index, score, rules));
}

function get(list: readonly BadgeProgress[], badge: Badge): BadgeProgress {
  const found = list.find((item) => item.badge === badge);
  if (found === undefined) throw new Error(`nema bedža ${badge}`);
  return found;
}

describe('badgeProgress', () => {
  it('bez podataka: svi bedževi redom iz BADGES, ništa osvojeno', () => {
    const list = badgeProgress([], [], day(0));
    expect(list.map((item) => item.badge)).toEqual([...BADGES]);
    expect(list.every((item) => !item.earned && item.done === 0)).toBe(true);
    expect(list.map((item) => item.total)).toEqual(BADGES.map((badge) => BADGE_TARGETS[badge]));
  });

  it('neispravan današnji dan: ništa osvojeno, ne ruši se', () => {
    const list = badgeProgress(run(0, 40, 90, 1), [day(0)], 'nije-datum');
    expect(list.every((item) => !item.earned && item.done === 0)).toBe(true);
  });

  it('prvi tjedan: broji konačne dane, i kad nisu zaredom', () => {
    const days = [...run(0, 3), ...run(10, 3)];
    expect(get(badgeProgress(days, [], day(20)), 'firstWeek')).toMatchObject({ earned: false, done: 6, total: 7 });
    expect(get(badgeProgress([...days, scored(15, 50)], [], day(20)), 'firstWeek')).toMatchObject({
      earned: true,
      done: 7,
    });
  });

  it('rezultat „u tijeku“, budući dan i neispravan dan ne ulaze; isti dan se broji jednom', () => {
    const days: BadgeDay[] = [
      scored(0, 90),
      scored(0, 95),
      scored(1, 99, 1, false),
      scored(30, 99),
      { date: 'x', score: 99, final: true },
      { date: day(2), score: Number.NaN, final: true },
    ];
    const list = badgeProgress(days, [], day(5));
    expect(get(list, 'firstWeek').done).toBe(1);
    expect(get(list, 'brightDay').earned).toBe(true);
  });

  it('dan punog sjaja: konačni rezultat od 85 naviše; „u tijeku“ ga ne pali', () => {
    expect(get(badgeProgress([scored(0, 84)], [], day(1)), 'brightDay').earned).toBe(false);
    expect(get(badgeProgress([scored(0, 85)], [], day(1)), 'brightDay').earned).toBe(true);
    expect(get(badgeProgress([scored(0, 100, null, false)], [], day(1)), 'brightDay').earned).toBe(false);
  });

  it('niz: tekući niz je napredak, a jednom dosegnut cilj ostaje osvojen i kad niz pukne', () => {
    const five = Array.from({ length: 5 }, (_, index) => day(index));
    expect(get(badgeProgress([], five, day(4)), 'streak7')).toMatchObject({ earned: false, done: 5 });
    // Niz je pukao prije cilja: napredak se vraća na tekući niz.
    expect(get(badgeProgress([], five, day(9)), 'streak7')).toMatchObject({ earned: false, done: 0 });

    const seven = Array.from({ length: 7 }, (_, index) => day(index));
    const later = badgeProgress([], seven, day(40));
    expect(get(later, 'streak7')).toMatchObject({ earned: true, done: 7 });
    expect(get(later, 'streak30')).toMatchObject({ earned: false, done: 0, total: 30 });
  });

  it('7 dana bez prekršaja: traži uzastopne kalendarske dane sa zabranama = 1', () => {
    const six = run(0, 6, 60, 1);
    expect(get(badgeProgress(six, [], day(6)), 'cleanWeek')).toMatchObject({ earned: false, done: 6 });
    expect(get(badgeProgress([...six, scored(6, 60, 1)], [], day(6)), 'cleanWeek').earned).toBe(true);
    // Rupa u danima prekida niz.
    const gap = [...run(0, 4, 60, 1), ...run(5, 4, 60, 1)];
    expect(get(badgeProgress(gap, [], day(8)), 'cleanWeek')).toMatchObject({ earned: false, done: 4 });
  });

  it('7 dana bez prekršaja: prekršaj ili dan bez zabilježenih zabrana prekida niz, ali ne briše osvojeno', () => {
    const broken = [...run(0, 5, 60, 1), scored(5, 60, 0.5), ...run(6, 2, 60, 1)];
    expect(get(badgeProgress(broken, [], day(7)), 'cleanWeek')).toMatchObject({ earned: false, done: 2 });
    const unknown = [...run(0, 5, 60, 1), scored(5, 60, null), scored(6, 60, 1)];
    expect(get(badgeProgress(unknown, [], day(6)), 'cleanWeek').done).toBe(1);
    const earnedThenBroken = [...run(0, 7, 60, 1), scored(7, 60, 0)];
    expect(get(badgeProgress(earnedThenBroken, [], day(8)), 'cleanWeek')).toMatchObject({ earned: true, done: 7 });
  });

  it('7 dana bez prekršaja: stari niz koji ne dopire do jučer nije tekući napredak', () => {
    expect(get(badgeProgress(run(0, 5, 60, 1), [], day(10)), 'cleanWeek').done).toBe(0);
    expect(get(badgeProgress(run(0, 5, 60, 1), [], day(5)), 'cleanWeek').done).toBe(5);
  });

  it('rekord tjedna: treba ubrojeni tjedan bolji od svih prethodnih', () => {
    const first = run(0, 5, 60);
    expect(get(badgeProgress(first, [], day(8)), 'weekRecord').earned).toBe(false);
    const same = [...first, ...run(7, 5, 60)];
    expect(get(badgeProgress(same, [], day(15)), 'weekRecord').earned).toBe(false);
    const better = [...first, ...run(7, 5, 50), ...run(14, 5, 61)];
    expect(get(badgeProgress(better, [], day(22)), 'weekRecord').earned).toBe(true);
    // Tekući tjedan još nije zaključen.
    expect(get(badgeProgress(better, [], day(15)), 'weekRecord').earned).toBe(false);
  });

  it('4 dobra tjedna zaredom: susjedni tjedni; slab ili prazan tjedan prekida niz', () => {
    const three = [...run(0, 5, 75), ...run(7, 5, 75), ...run(14, 5, 75)];
    expect(get(badgeProgress(three, [], day(21)), 'goodWeeks4')).toMatchObject({ earned: false, done: 3, total: 4 });
    expect(get(badgeProgress([...three, ...run(21, 5, 75)], [], day(28)), 'goodWeeks4').earned).toBe(true);

    const weak = [...run(0, 5, 75), ...run(7, 5, 75), ...run(14, 5, 40), ...run(21, 5, 75)];
    expect(get(badgeProgress(weak, [], day(28)), 'goodWeeks4')).toMatchObject({ earned: false, done: 1 });

    const hole = [...run(0, 5, 75), ...run(7, 5, 75), ...run(21, 5, 75), ...run(28, 5, 75)];
    expect(get(badgeProgress(hole, [], day(35)), 'goodWeeks4')).toMatchObject({ earned: false, done: 2 });
  });

  it('4 dobra tjedna zaredom: niz koji ne završava prošlim tjednom nije tekući napredak', () => {
    const two = [...run(0, 5, 75), ...run(7, 5, 75)];
    expect(get(badgeProgress(two, [], day(14)), 'goodWeeks4').done).toBe(2);
    expect(get(badgeProgress(two, [], day(21)), 'goodWeeks4').done).toBe(0);
  });

  it('žarovi: 30 i 100 konačnih dana', () => {
    const list = badgeProgress(run(0, 30), [], day(30));
    expect(get(list, 'embers30')).toMatchObject({ earned: true, done: 30 });
    expect(get(list, 'embers100')).toMatchObject({ earned: false, done: 30, total: 100 });
  });

  it('neosvojen bedž nikad ne pokazuje pun brojač', () => {
    for (const item of badgeProgress(run(0, 6, 60, 1), [day(0)], day(6))) {
      if (!item.earned) expect(item.done).toBeLessThan(item.total);
    }
  });
});

describe('sortBadges', () => {
  it('osvojeni prvi redom iz BADGES, zatim neosvojeni od najbližeg cilju', () => {
    const list: BadgeProgress[] = [
      { badge: 'embers100', earned: false, done: 10, total: 100 },
      { badge: 'goodWeeks4', earned: false, done: 3, total: 4 },
      { badge: 'brightDay', earned: true, done: 1, total: 1 },
      { badge: 'streak7', earned: false, done: 3, total: 7 },
      { badge: 'firstWeek', earned: true, done: 7, total: 7 },
      { badge: 'weekRecord', earned: false, done: 0, total: 1 },
      { badge: 'cleanWeek', earned: false, done: 0, total: 7 },
    ];
    const before = [...list];
    expect(sortBadges(list).map((item) => item.badge)).toEqual([
      'firstWeek',
      'brightDay',
      'goodWeeks4',
      'streak7',
      'embers100',
      'cleanWeek',
      'weekRecord',
    ]);
    expect(list).toEqual(before);
  });
});

describe('hasCounter', () => {
  it('brojač imaju samo neosvojeni bedževi s ciljem većim od 1', () => {
    expect(hasCounter({ badge: 'goodWeeks4', earned: false, done: 3, total: 4 })).toBe(true);
    expect(hasCounter({ badge: 'goodWeeks4', earned: true, done: 4, total: 4 })).toBe(false);
    expect(hasCounter({ badge: 'weekRecord', earned: false, done: 0, total: 1 })).toBe(false);
  });
});
