import { describe, expect, it } from '@jest/globals';

import type { CheckinKind } from '../domain/checkin';
import { EMPTY_STREAK, isEveningCheckinComplete, mainStreak, streakFromDates, streakGain } from './streak';

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
    });
  });

  it('niz do jučer je još živ (današnji upit nije propušten)', () => {
    expect(streakFromDates(['2026-11-05', '2026-11-06', '2026-11-07'], TODAY)).toEqual({
      current: 3,
      longest: 3,
      lastDate: '2026-11-07',
      doneToday: false,
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
    expect(streak).toEqual({ current: 3, longest: 3, lastDate: TODAY, doneToday: true });
  });

  it('niz preko kraja mjeseca i godine', () => {
    expect(streakFromDates(['2026-12-30', '2026-12-31', '2027-01-01'], '2027-01-01').current).toBe(3);
  });

  it('neispravan današnji dan → prazno', () => {
    expect(streakFromDates([TODAY], '2026-13-01')).toEqual(EMPTY_STREAK);
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
