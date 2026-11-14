import { describe, expect, it } from '@jest/globals';

import { betterWeeksStreak } from './better-weeks';
import { closedWeeks, type RankDay, type WeekResult } from './rank';

const week = (start: string, average: number): WeekResult => ({ start, average, days: 5, good: true });
const TODAY = '2026-11-12'; // četvrtak, tjedan od 2026-11-09

describe('betterWeeksStreak', () => {
  it('bez tjedana ili s jednim tjednom nema niza', () => {
    expect(betterWeeksStreak([], TODAY)).toEqual({ current: 0, longest: 0 });
    expect(betterWeeksStreak([week('2026-11-02', 80)], TODAY)).toEqual({ current: 0, longest: 0 });
  });

  it('broji tjedne jednako dobre ili bolje od prethodnog', () => {
    const weeks = [week('2026-10-12', 50), week('2026-10-19', 60), week('2026-10-26', 60), week('2026-11-02', 72)];
    expect(betterWeeksStreak(weeks, TODAY)).toEqual({ current: 3, longest: 3 });
  });

  it('slabiji tjedan prekida niz, najduži ostaje', () => {
    const weeks = [
      week('2026-10-05', 50),
      week('2026-10-12', 60),
      week('2026-10-19', 70),
      week('2026-10-26', 40),
      week('2026-11-02', 45),
    ];
    expect(betterWeeksStreak(weeks, TODAY)).toEqual({ current: 1, longest: 2 });
  });

  it('preskočen tjedan (premalo dana) prekida niz', () => {
    const weeks = [week('2026-10-12', 50), week('2026-10-19', 60), week('2026-11-02', 70)];
    expect(betterWeeksStreak(weeks, TODAY)).toEqual({ current: 0, longest: 1 });
  });

  it('tekući niz je 0 kad zadnji ubrojeni tjedan nije prošli tjedan', () => {
    const weeks = [week('2026-10-12', 50), week('2026-10-19', 60)];
    expect(betterWeeksStreak(weeks, TODAY)).toEqual({ current: 0, longest: 1 });
  });

  it('neispravan današnji dan → tekući niz 0', () => {
    expect(betterWeeksStreak([week('2026-10-26', 50), week('2026-11-02', 60)], 'x').current).toBe(0);
  });

  it('radi nad tjednima iz closedWeeks', () => {
    const days: RankDay[] = [];
    const add = (start: string, score: number) => {
      for (let i = 0; i < 4; i += 1) {
        const day = String(Number(start.slice(8)) + i).padStart(2, '0');
        days.push({ date: `${start.slice(0, 8)}${day}`, score, final: true });
      }
    };
    add('2026-10-19', 40);
    add('2026-10-26', 55);
    add('2026-11-02', 55);
    expect(betterWeeksStreak(closedWeeks(days, TODAY), TODAY)).toEqual({ current: 2, longest: 2 });
  });
});
