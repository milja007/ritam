import { describe, expect, it } from '@jest/globals';

import { learnedQuickPicks, LEARNED_MAX_PICKS, pickKey } from '.';

type H = Parameters<typeof learnedQuickPicks>[0][number];

/** Ciljni dan: utorak 17. 11. 2026. */
const TUESDAY = '2026-11-17';

function h(date: string, title: string, start: string, end: string, overrides: Partial<H> = {}): H {
  return { date, title, start, end, kind: 'task', status: 'done', ...overrides };
}

describe('learnedQuickPicks', () => {
  it('ponavljani blok se nudi u najčešćem terminu, prednost isti dan u tjednu', () => {
    const history = [
      h('2026-11-10', 'Trening', '18:00', '19:00'), // utorak
      h('2026-11-03', 'Trening', '18:00', '19:00'), // utorak
      h('2026-11-12', 'trening ', '07:00', '08:00'), // četvrtak
      h('2026-11-13', 'Trening', '07:00', '08:00'), // petak
      h('2026-11-14', 'Trening', '07:00', '08:00'), // subota
    ];
    expect(learnedQuickPicks(history, TUESDAY)).toEqual([
      {
        key: 'trening',
        title: 'Trening',
        kind: 'task',
        start: '18:00',
        end: '19:00',
        days: 5,
        sameWeekdayDays: 2,
      },
    ]);
    // Srijeda: nema srijeda u povijesti → najčešći termin ukupno.
    expect(learnedQuickPicks(history, '2026-11-18')[0]).toMatchObject({ start: '07:00', end: '08:00' });
  });

  it('jedna pojava se ne nudi; dva različita dana da', () => {
    expect(learnedQuickPicks([h('2026-11-16', 'Zubar', '15:00', '16:00')], TUESDAY)).toEqual([]);
    const twiceSameDay = [h('2026-11-16', 'Zubar', '15:00', '16:00'), h('2026-11-16', 'Zubar', '17:00', '18:00')];
    expect(learnedQuickPicks(twiceSameDay, TUESDAY)).toEqual([]);
    expect(
      learnedQuickPicks([h('2026-11-16', 'Posao', '09:00', '17:00', { kind: 'fixed' }), h('2026-11-13', 'Posao', '09:00', '17:00', { kind: 'fixed' })], TUESDAY),
    ).toMatchObject([{ title: 'Posao', kind: 'fixed', start: '09:00', end: '17:00', sameWeekdayDays: 0 }]);
  });

  it('preskače san, nepredviđeno, premještene, stare (> 28 dana), buduće i već planirane', () => {
    const history = [
      h('2026-11-16', 'San', '23:00', '07:00', { kind: 'sleep' }),
      h('2026-11-15', 'San', '23:00', '07:00', { kind: 'sleep' }),
      h('2026-11-16', 'Iskrslo', '10:00', '11:00', { kind: 'unexpected' }),
      h('2026-11-15', 'Iskrslo', '10:00', '11:00', { kind: 'unexpected' }),
      h('2026-11-16', 'Učenje', '20:00', '21:30', { status: 'moved' }),
      h('2026-11-15', 'Učenje', '20:00', '21:30'),
      h('2026-10-19', 'Čitanje', '21:00', '21:30'),
      h('2026-10-18', 'Čitanje', '21:00', '21:30'),
      h('2026-11-17', 'Šetnja', '12:00', '12:30'),
      h('2026-11-18', 'Šetnja', '12:00', '12:30'),
      h('2026-11-16', 'Trening', '18:00', '19:00'),
      h('2026-11-15', 'Trening', '18:00', '19:00'),
    ];
    expect(learnedQuickPicks(history, TUESDAY, ['  TRENING'])).toEqual([]);
  });

  it('poredak: isti dan u tjednu, broj dana; najviše LEARNED_MAX_PICKS', () => {
    const history: H[] = [];
    for (let i = 0; i < 9; i += 1) {
      const title = `Blok ${i}`;
      const days = i + 2;
      for (let d = 0; d < days; d += 1) {
        const day = String(16 - d).padStart(2, '0');
        history.push(h(`2026-11-${day}`, title, '10:00', '11:00'));
      }
    }
    history.push(h('2026-11-10', 'Utorkom', '19:00', '20:00'), h('2026-11-03', 'Utorkom', '19:00', '20:00'));
    const picks = learnedQuickPicks(history, TUESDAY);
    expect(picks).toHaveLength(LEARNED_MAX_PICKS);
    // "Utorkom" ima dva utorka; blokovi 5–8 sežu do utorka 10. 11. (jedan), blok 4 ne.
    expect(picks[0]?.title).toBe('Utorkom');
    expect(picks.slice(1).map((pick) => pick.title)).toEqual(['Blok 8', 'Blok 7', 'Blok 6', 'Blok 5', 'Blok 4']);
  });

  it('pickKey normalizira razmake i velika slova', () => {
    expect(pickKey('  Jutarnji   TRENING ')).toBe('jutarnji trening');
  });
});
