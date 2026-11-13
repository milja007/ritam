import { describe, expect, it } from '@jest/globals';

import {
  closedWeeks,
  MIN_WEEK_DAYS,
  RANK_GOOD_WEEKS,
  rankForGoodWeeks,
  rankProgress,
  RANKS,
  systemMessage,
  type RankDay,
} from './rank';
import { addDays } from '../time/local-date';

// 2026-11-02 je ponedjeljak.
const MONDAY = '2026-11-02';

/** `count` konačnih dana od ponedjeljka `weekOffset` tjedana nakon `MONDAY`, svi s rezultatom `score`. */
function week(weekOffset: number, score: number, count = 5, final = true): RankDay[] {
  return Array.from({ length: count }, (_, index) => ({
    date: addDays(MONDAY, weekOffset * 7 + index) ?? '',
    score,
    final,
  }));
}

const TODAY = (weekOffset: number) => addDays(MONDAY, weekOffset * 7 + 2) ?? '';

describe('closedWeeks', () => {
  it('bez dana ili s neispravnim danom: prazno', () => {
    expect(closedWeeks([], TODAY(1))).toEqual([]);
    expect(closedWeeks(week(0, 80), 'nije-datum')).toEqual([]);
  });

  it('tekući tjedan i kasniji ne ulaze', () => {
    expect(closedWeeks(week(0, 80), TODAY(0))).toEqual([]);
    expect(closedWeeks([...week(0, 80), ...week(2, 80)], TODAY(1))).toHaveLength(1);
  });

  it(`tjedan s manje od ${MIN_WEEK_DAYS} konačna dana se ne broji`, () => {
    expect(closedWeeks(week(0, 90, MIN_WEEK_DAYS - 1), TODAY(1))).toEqual([]);
    expect(closedWeeks(week(0, 90, MIN_WEEK_DAYS), TODAY(1))).toHaveLength(1);
  });

  it('rezultat „u tijeku“ i neispravni zapisi ne ulaze', () => {
    expect(closedWeeks(week(0, 90, 5, false), TODAY(1))).toEqual([]);
    const broken: RankDay[] = [...week(0, 90, 3), { date: 'x', score: 90, final: true }, { date: MONDAY, score: NaN, final: true }];
    expect(closedWeeks(broken, TODAY(1))).toEqual([]);
  });

  it('isti dan dvaput broji se jednom', () => {
    const days = [...week(0, 80, 3), ...week(0, 80, 3)];
    expect(closedWeeks(days, TODAY(1))).toEqual([]);
  });

  it('prvi tjedan je dobar samo ako je jak; kasniji i kad je bolji od prethodnog', () => {
    const days = [...week(0, 40), ...week(1, 45), ...week(2, 45), ...week(3, 72), ...week(4, 70), ...week(5, 60)];
    expect(closedWeeks(days, TODAY(6)).map((w) => [w.average, w.good])).toEqual([
      [40, false], // prvi, slab — nema s čim usporediti
      [45, true], // bolji od 40
      [45, false], // isti
      [72, true], // bolji i jak
      [70, true], // slabiji, ali jak
      [60, false], // slabiji
    ]);
  });

  it('uspoređuje s prethodnim ubrojenim tjednom i preko rupe', () => {
    const days = [...week(0, 50), ...week(1, 90, 2), ...week(3, 55)];
    const weeks = closedWeeks(days, TODAY(5));
    expect(weeks.map((w) => w.average)).toEqual([50, 55]);
    expect(weeks[1]?.good).toBe(true);
  });

  it('prosjek je zaokružen i broji dane', () => {
    const days: RankDay[] = [0, 1, 2, 3].map((i) => ({ date: addDays(MONDAY, i) ?? '', score: [70, 71, 71, 71][i] ?? 0, final: true }));
    expect(closedWeeks(days, TODAY(1))).toEqual([{ start: MONDAY, average: 71, days: 4, good: true }]);
  });
});

describe('rankForGoodWeeks', () => {
  it('pragovi rastu i svaki rang počinje točno na svom pragu', () => {
    for (const [index, rank] of RANKS.entries()) {
      expect(rankForGoodWeeks(RANK_GOOD_WEEKS[rank])).toBe(rank);
      const previous = RANKS[index - 1];
      if (previous !== undefined) {
        expect(RANK_GOOD_WEEKS[rank]).toBeGreaterThan(RANK_GOOD_WEEKS[previous]);
        expect(rankForGoodWeeks(RANK_GOOD_WEEKS[rank] - 1)).toBe(previous);
      }
    }
  });

  it('neispravan broj je E, puno tjedana S', () => {
    expect(rankForGoodWeeks(-3)).toBe('E');
    expect(rankForGoodWeeks(NaN)).toBe('E');
    expect(rankForGoodWeeks(500)).toBe('S');
  });
});

describe('rankProgress i systemMessage', () => {
  it('novi korisnik: rang E, poruka objašnjava pravilo', () => {
    const progress = rankProgress([], TODAY(0));
    expect(progress).toEqual({
      rank: 'E',
      goodWeeks: 0,
      countedWeeks: 0,
      next: { rank: 'D', stepWeeks: 2, doneWeeks: 0, weeksLeft: 2 },
    });
    expect(systemMessage(progress)).toEqual({ kind: 'start', rank: 'D' });
  });

  it('ubrojen slab tjedan: i dalje E, ali poruka broji koliko fali', () => {
    const progress = rankProgress(week(0, 40), TODAY(1));
    expect(progress.rank).toBe('E');
    expect(systemMessage(progress)).toEqual({ kind: 'toNext', rank: 'D', count: 2 });
  });

  it('tri jaka tjedna: rang D, još 2 do C', () => {
    const progress = rankProgress([...week(0, 80), ...week(1, 80), ...week(2, 80)], TODAY(3));
    expect(progress).toEqual({
      rank: 'D',
      goodWeeks: 3,
      countedWeeks: 3,
      next: { rank: 'C', stepWeeks: 3, doneWeeks: 1, weeksLeft: 2 },
    });
    expect(systemMessage(progress)).toEqual({ kind: 'toNext', rank: 'C', count: 2 });
  });

  it('slab tjedan ne spušta rang', () => {
    const strong = [...week(0, 80), ...week(1, 80)];
    expect(rankProgress(strong, TODAY(2)).rank).toBe('D');
    expect(rankProgress([...strong, ...week(2, 10), ...week(3, 5)], TODAY(4)).rank).toBe('D');
  });

  it('rang S nema sljedeći', () => {
    const days = Array.from({ length: RANK_GOOD_WEEKS.S }, (_, i) => week(i, 90)).flat();
    const progress = rankProgress(days, TODAY(RANK_GOOD_WEEKS.S));
    expect(progress.rank).toBe('S');
    expect(progress.next).toBeNull();
    expect(systemMessage(progress)).toEqual({ kind: 'top' });
  });
});
