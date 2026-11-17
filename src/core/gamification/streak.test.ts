import { describe, expect, it } from '@jest/globals';

import type { CheckinKind } from '../domain/checkin';
import {
  EMPTY_STREAK,
  FREEZE_EVERY,
  FREEZE_MAX,
  freezeEarned,
  isEveningCheckinComplete,
  isStreakFrozen,
  mainStreak,
  streakFromDates,
  streakGain,
} from './streak';
import { addDays } from '../time/local-date';

/** `n` uzastopnih dana koji završavaju s `last` (uključivo). */
function run(last: string, n: number): string[] {
  const out: string[] = [];
  for (let i = n - 1; i >= 0; i--) out.push(addDays(last, -i) as string);
  return out;
}

const TODAY = '2026-11-08';

describe('streakFromDates', () => {
  it('prazno', () => {
    expect(streakFromDates([], TODAY)).toEqual(EMPTY_STREAK);
  });

  it('samo danas', () => {
    expect(streakFromDates([TODAY], TODAY)).toEqual({
      current: 1,
      longest: 1,
      lastDate: TODAY,
      doneToday: true,
      freezes: { held: 0, nextIn: 6, savedDates: [] },
    });
  });

  it('niz do jučer je još živ (današnji upit nije propušten)', () => {
    expect(streakFromDates(['2026-11-05', '2026-11-06', '2026-11-07'], TODAY)).toEqual({
      current: 3,
      longest: 3,
      lastDate: '2026-11-07',
      doneToday: false,
      freezes: { held: 0, nextIn: 4, savedDates: [] },
    });
  });

  it('propušten jučerašnji dan prekida niz', () => {
    const streak = streakFromDates(['2026-11-05', '2026-11-06'], TODAY);
    expect(streak.current).toBe(0);
    expect(streak.longest).toBe(2);
    expect(streak.lastDate).toBe('2026-11-06');
  });

  it('rupa u sredini: trenutni je samo zadnji niz, najduži pamti stari', () => {
    const streak = streakFromDates(
      ['2026-10-01', '2026-10-02', '2026-10-03', '2026-10-04', '2026-11-07', TODAY],
      TODAY,
    );
    expect(streak.current).toBe(2);
    expect(streak.longest).toBe(4);
  });

  it('ignorira duplikate, redoslijed, neispravne i buduće datume', () => {
    const streak = streakFromDates(
      [TODAY, '2026-11-07', TODAY, '2026-11-06', '2026-11-09', '2026-02-30', 'x'],
      TODAY,
    );
    expect(streak).toEqual({
      current: 3,
      longest: 3,
      lastDate: TODAY,
      doneToday: true,
      freezes: { held: 0, nextIn: 4, savedDates: [] },
    });
  });

  it('niz preko kraja mjeseca i godine', () => {
    expect(streakFromDates(['2026-12-30', '2026-12-31', '2027-01-01'], '2027-01-01').current).toBe(3);
  });

  it('neispravan današnji dan → prazno', () => {
    expect(streakFromDates([TODAY], '2026-13-01')).toEqual(EMPTY_STREAK);
  });
});

describe('žeravica (freeze tokeni)', () => {
  it('pragovi', () => {
    expect(FREEZE_EVERY).toBe(7);
    expect(FREEZE_MAX).toBe(2);
  });

  it('7 dana zaredom donese jednu žeravicu, 14 dvije, više od toga ne', () => {
    expect(streakFromDates(run(TODAY, 6), TODAY).freezes).toEqual({ held: 0, nextIn: 1, savedDates: [] });
    expect(streakFromDates(run(TODAY, 7), TODAY).freezes).toEqual({ held: 1, nextIn: 7, savedDates: [] });
    expect(streakFromDates(run(TODAY, 14), TODAY).freezes).toEqual({ held: 2, nextIn: 0, savedDates: [] });
    expect(streakFromDates(run(TODAY, 30), TODAY).freezes.held).toBe(2);
  });

  it('jedan propušten dan premosti žeravica: niz živi, premošteni dan ga ne povećava', () => {
    // 1.–7. 11. ubrojeni (žeravica), 8. propušten, 9.–10. ubrojeni.
    const dates = [...run('2026-11-07', 7), '2026-11-09', '2026-11-10'];
    const streak = streakFromDates(dates, '2026-11-10');
    expect(streak.current).toBe(9);
    expect(streak.longest).toBe(9);
    expect(streak.freezes).toEqual({ held: 0, nextIn: 5, savedDates: ['2026-11-08'] });
  });

  it('bez žeravice propušten dan prekida niz (staro ponašanje)', () => {
    const streak = streakFromDates([...run('2026-11-05', 6), '2026-11-07'], '2026-11-07');
    expect(streak.current).toBe(1);
    expect(streak.longest).toBe(6);
  });

  it('rupa veća od žeravica prekida niz, a zarađene žeravice ostaju', () => {
    // 7 dana → 1 žeravica; rupa od 2 dana; novi niz od 2 dana.
    const dates = [...run('2026-11-07', 7), '2026-11-10', '2026-11-11'];
    const streak = streakFromDates(dates, '2026-11-11');
    expect(streak.current).toBe(2);
    expect(streak.longest).toBe(7);
    expect(streak.freezes).toEqual({ held: 1, nextIn: 5, savedDates: [] });
  });

  it('dvije žeravice premoste dva dana', () => {
    const dates = [...run('2026-11-14', 14), '2026-11-17'];
    const streak = streakFromDates(dates, '2026-11-17');
    expect(streak.current).toBe(15);
    expect(streak.freezes).toEqual({ held: 0, nextIn: 6, savedDates: ['2026-11-15', '2026-11-16'] });
  });

  it('žeravica čuva niz do danas: jučer propušten, danas još nije upisan', () => {
    const streak = streakFromDates(run('2026-11-06', 7), TODAY);
    expect(streak.current).toBe(7);
    expect(streak.doneToday).toBe(false);
    expect(streak.freezes).toEqual({ held: 0, nextIn: 7, savedDates: ['2026-11-07'] });
    expect(isStreakFrozen(streak)).toBe(true);
  });

  it('nedovoljno žeravica za rupu do danas → niz je 0, žeravice ostaju', () => {
    const streak = streakFromDates(run('2026-11-05', 7), TODAY);
    expect(streak.current).toBe(0);
    expect(streak.longest).toBe(7);
    expect(streak.freezes).toEqual({ held: 1, nextIn: 7, savedDates: [] });
    expect(isStreakFrozen(streak)).toBe(false);
  });

  it('nakon premošćivanja i nastavka niz više nije „zamrznut“', () => {
    const streak = streakFromDates([...run('2026-11-06', 7), TODAY], TODAY);
    expect(streak.current).toBe(8);
    expect(streak.freezes.savedDates).toEqual(['2026-11-07']);
    expect(isStreakFrozen(streak)).toBe(false);
  });

  it('premošćivanje preko kraja godine', () => {
    const dates = [...run('2026-12-30', 7), '2027-01-01'];
    const streak = streakFromDates(dates, '2027-01-01');
    expect(streak.current).toBe(8);
    expect(streak.freezes.savedDates).toEqual(['2026-12-31']);
  });

  it('freezeEarned: samo stvaran rast, prvo crtanje ne', () => {
    expect(freezeEarned(null, 1)).toBe(false);
    expect(freezeEarned(0, 1)).toBe(true);
    expect(freezeEarned(1, 1)).toBe(false);
    expect(freezeEarned(2, 1)).toBe(false);
  });
});

describe('glavni streak iz checkina', () => {
  const checkin = (date: string, kind: CheckinKind, dayRating: number | null) => ({
    date,
    kind,
    dayRating,
  });

  it('ispunjena večernja provjera = večernji checkin s ocjenom dana', () => {
    expect(isEveningCheckinComplete(checkin(TODAY, 'evening', 4))).toBe(true);
    expect(isEveningCheckinComplete(checkin(TODAY, 'evening', null))).toBe(false);
    expect(isEveningCheckinComplete(checkin(TODAY, 'morning', 4))).toBe(false);
  });

  it('broji samo ispunjene večernje provjere', () => {
    const streak = mainStreak(
      [
        checkin('2026-11-05', 'evening', 3),
        checkin('2026-11-06', 'evening', 5),
        checkin('2026-11-07', 'morning', null),
        checkin('2026-11-07', 'evening', null),
        checkin(TODAY, 'evening', 2),
      ],
      TODAY,
    );
    expect(streak.current).toBe(1);
    expect(streak.longest).toBe(2);
    expect(streak.doneToday).toBe(true);
  });

  it('jutarnji checkin bez večernjeg ne drži streak', () => {
    expect(mainStreak([checkin('2026-11-07', 'morning', null)], TODAY)).toEqual(EMPTY_STREAK);
  });
});

describe('streakGain', () => {
  it('prvo crtanje ne bljesne', () => {
    expect(streakGain(null, 5)).toBe(0);
  });

  it('rast niza daje razliku', () => {
    expect(streakGain(0, 1)).toBe(1);
    expect(streakGain(4, 5)).toBe(1);
    expect(streakGain(2, 5)).toBe(3);
  });

  it('isti niz, prekid niza i neispravni brojevi daju 0', () => {
    expect(streakGain(5, 5)).toBe(0);
    expect(streakGain(5, 0)).toBe(0);
    expect(streakGain(Number.NaN, 3)).toBe(0);
    expect(streakGain(3, Number.POSITIVE_INFINITY)).toBe(0);
  });
});
