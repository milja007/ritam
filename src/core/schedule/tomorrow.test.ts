import { describe, expect, it } from '@jest/globals';

import type { BlockKind } from '../domain';
import {
  isTomorrowPlanValid,
  nextFreeSlot,
  occupiedSlots,
  parseTypedEntry,
  planStartMinutes,
  QUICK_PICKS,
  quickPickDraft,
  tomorrowInputs,
  tomorrowOf,
  typedDraft,
  type BlockDraft,
} from '.';

const slot = (start: string, end: string, kind: BlockKind = 'task') => ({
  start,
  end,
  kind,
});
const draft = (title: string, start: string, end: string, kind: BlockKind = 'task'): BlockDraft => ({
  title,
  start,
  end,
  kind,
});

describe('tomorrowOf', () => {
  it('dan nakon dana upita', () => {
    expect(tomorrowOf('2026-11-09')).toBe('2026-11-10');
    expect(tomorrowOf('2026-12-31')).toBe('2027-01-01');
  });
  it('neispravan datum → null', () => {
    expect(tomorrowOf('nije-datum')).toBeNull();
  });
});

describe('planStartMinutes', () => {
  it('buđenje + 30 min, zaokruženo na četvrt sata', () => {
    expect(planStartMinutes('07:00')).toBe(7 * 60 + 30);
    expect(planStartMinutes('06:40')).toBe(7 * 60 + 15);
  });
  it('neispravno buđenje → 07:30', () => {
    expect(planStartMinutes('xx')).toBe(7 * 60 + 30);
  });
  it('ne prelazi 23:45', () => {
    expect(planStartMinutes('23:40')).toBe(23 * 60 + 45);
  });
});

describe('nextFreeSlot', () => {
  it('prazan dan → od buđenja + 30 min', () => {
    expect(nextFreeSlot([], 60, '07:00')).toEqual({
      start: '07:30',
      end: '08:30',
    });
  });
  it('iza zadnjeg bloka, poravnato na četvrt sata', () => {
    expect(nextFreeSlot([slot('09:00', '10:10'), slot('08:00', '09:00')], 30, '07:00')).toEqual({
      start: '10:15',
      end: '10:45',
    });
  });
  it('blok prije buđenja ne pomiče početak', () => {
    expect(nextFreeSlot([slot('05:00', '06:00')], 60, '07:00').start).toBe('07:30');
  });
  it('san i neispravni blokovi se preskaču', () => {
    expect(nextFreeSlot([slot('23:00', '07:00', 'sleep'), slot('12:00', '11:00')], 60, '07:00').start).toBe(
      '07:30',
    );
  });
  it('ostaje unutar dana', () => {
    expect(nextFreeSlot([slot('20:00', '23:50')], 120, '07:00')).toEqual({
      start: '23:45',
      end: '23:59',
    });
  });
});

describe('quickPickDraft', () => {
  it('vrsta i trajanje iz brzog odabira, naziv iz UI-ja', () => {
    const work = QUICK_PICKS.find((pick) => pick.id === 'work');
    expect(work).toBeDefined();
    if (!work) return;
    expect(quickPickDraft(work, 'Posao', [], '06:30')).toEqual(draft('Posao', '07:00', '15:00', 'fixed'));
  });
  it('svi brzi odabiri imaju jedinstven id i trajanje u koracima od 15 min', () => {
    const ids = new Set(QUICK_PICKS.map((pick) => pick.id));
    expect(ids.size).toBe(QUICK_PICKS.length);
    for (const pick of QUICK_PICKS) expect(pick.minutes % 15).toBe(0);
  });
});

describe('parseTypedEntry', () => {
  it.each([
    ['Trening 18-19', { title: 'Trening', start: '18:00', end: '19:00' }],
    ['sastanak od 9:30 do 11', { title: 'sastanak', start: '09:30', end: '11:00' }],
    ['Predavanje 10.15–11.45', { title: 'Predavanje', start: '10:15', end: '11:45' }],
    ['9-11 posao na projektu', { title: 'posao na projektu', start: '09:00', end: '11:00' }],
    ['meeting from 14 to 15:30', { title: 'meeting', start: '14:00', end: '15:30' }],
    ['Zubar u 15', { title: 'Zubar', start: '15:00', end: null }],
    ['call at 9:30', { title: 'call', start: '09:30', end: null }],
    ['ručak 13:00', { title: 'ručak', start: '13:00', end: null }],
    ['Kupiti mlijeko', { title: 'Kupiti mlijeko', start: null, end: null }],
    ['  Trening,  18-19 ', { title: 'Trening', start: '18:00', end: '19:00' }],
  ])('%s', (text, expected) => {
    expect(parseTypedEntry(text)).toEqual(expected);
  });
  it('neispravno vrijeme ostaje u nazivu', () => {
    expect(parseTypedEntry('Film 25-26')).toEqual({
      title: 'Film 25-26',
      start: null,
      end: null,
    });
    expect(parseTypedEntry('Trening 19-18')).toEqual({
      title: 'Trening 19-18',
      start: null,
      end: null,
    });
  });
  it('prazan unos ili samo vrijeme → null', () => {
    expect(parseTypedEntry('   ')).toBeNull();
    expect(parseTypedEntry('18-19')).toBeNull();
  });
});

describe('typedDraft', () => {
  it('raspon iz teksta', () => {
    expect(typedDraft('Trening 18-19', [], '07:00')).toEqual(draft('Trening', '18:00', '19:00'));
  });
  it('samo početak → 1 h', () => {
    expect(typedDraft('Zubar u 15', [], '07:00')).toEqual(draft('Zubar', '15:00', '16:00'));
  });
  it('početak kasno navečer ostaje unutar dana', () => {
    expect(typedDraft('Film u 23:50', [], '07:00')).toEqual(draft('Film', '23:45', '23:59'));
  });
  it('bez vremena → sljedeći slobodni termin', () => {
    expect(typedDraft('Kupiti mlijeko', [slot('07:30', '09:00')], '07:00')).toEqual(
      draft('Kupiti mlijeko', '09:00', '10:00'),
    );
  });
  it('prazno → null', () => {
    expect(typedDraft(' ', [], '07:00')).toBeNull();
  });
});

describe('plan i ulazi', () => {
  it('occupiedSlots spaja postojeće i nove', () => {
    expect(occupiedSlots([slot('08:00', '09:00')], [draft('A', '09:00', '10:00')])).toHaveLength(2);
  });
  it('plan mora imati stavku i sve ispravne', () => {
    expect(isTomorrowPlanValid([])).toBe(false);
    expect(isTomorrowPlanValid([draft('A', '09:00', '10:00')])).toBe(true);
    expect(isTomorrowPlanValid([draft('A', '09:00', '10:00'), draft(' ', '10:00', '11:00')])).toBe(false);
    expect(isTomorrowPlanValid([draft('A', '10:00', '09:00')])).toBe(false);
  });
  it('ulazi su poredani po početku, user/planned na zadani dan', () => {
    const inputs = tomorrowInputs(
      [draft('B', '12:00', '13:00'), draft(' A ', '09:00', '10:00', 'fixed')],
      '2026-11-10',
    );
    expect(inputs.map((input) => input.title)).toEqual(['A', 'B']);
    expect(inputs[0]).toMatchObject({
      date: '2026-11-10',
      kind: 'fixed',
      source: 'user',
      status: 'planned',
      taskId: null,
    });
  });
});
