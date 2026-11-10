import { describe, expect, it } from '@jest/globals';

import type { BlockKind, BlockStatus } from '../domain';
import {
  dayPartOf,
  exampleIdeas,
  ideaDraft,
  isTodayPlanValid,
  needsTodayPlan,
  nextFreeSlotFrom,
  ownIdeas,
  PLAN_IDEAS,
  rankIdeas,
  shouldAutoOpenTodayPlan,
  startsInPast,
  todayPlanStart,
  typedTodayDraft,
  type BlockDraft,
  type PlanIdea,
} from '.';

const at = (h: number, m = 0) => h * 60 + m;
const slot = (start: string, end: string, kind: BlockKind = 'task') => ({ start, end, kind });
const draft = (title: string, start: string, end: string): BlockDraft => ({ title, start, end, kind: 'task' });
const hist = (
  date: string,
  title: string,
  start: string,
  end: string,
  kind: BlockKind = 'task',
  status: BlockStatus = 'done',
) => ({ date, title, start, end, kind, status });
const idea = (title: string, bestPart: PlanIdea['bestPart'], minutes = 30): PlanIdea => ({
  key: `own:${title}`,
  title,
  kind: 'task',
  minutes,
  bestPart,
  source: 'own',
});

describe('needsTodayPlan / shouldAutoOpenTodayPlan', () => {
  it('nema blokova ili samo san → treba plan', () => {
    expect(needsTodayPlan([])).toBe(true);
    expect(needsTodayPlan([{ kind: 'sleep' }])).toBe(true);
  });
  it('bilo koji drugi blok (i premješten u danas) → plan postoji', () => {
    expect(needsTodayPlan([{ kind: 'sleep' }, { kind: 'fixed' }])).toBe(false);
    expect(needsTodayPlan([{ kind: 'unexpected' }])).toBe(false);
  });
  it('prije 04:00 se ne otvara sam', () => {
    expect(shouldAutoOpenTodayPlan([], at(3, 59))).toBe(false);
    expect(shouldAutoOpenTodayPlan([], at(4))).toBe(true);
    expect(shouldAutoOpenTodayPlan([{ kind: 'task' }], at(14))).toBe(false);
  });
});

describe('todayPlanStart', () => {
  it('sljedećih 5 min; točno na granici ostaje', () => {
    expect(todayPlanStart(at(14, 2))).toBe(at(14, 5));
    expect(todayPlanStart(at(14, 5))).toBe(at(14, 5));
    expect(todayPlanStart(at(14, 56))).toBe(at(15));
    expect(todayPlanStart(at(23, 58))).toBe(at(24));
  });
});

describe('nextFreeSlotFrom', () => {
  it('prazan dan → od zadanog trenutka', () => {
    expect(nextFreeSlotFrom([], 45, at(14, 5))).toEqual({ start: '14:05', end: '14:50' });
  });
  it('prošli blokovi ne smetaju', () => {
    expect(nextFreeSlotFrom([slot('09:00', '12:00')], 30, at(14, 5))).toEqual({
      start: '14:05',
      end: '14:35',
    });
  });
  it('blok u tijeku → iza njega', () => {
    expect(nextFreeSlotFrom([slot('13:30', '14:30')], 30, at(14, 5))).toEqual({
      start: '14:30',
      end: '15:00',
    });
  });
  it('popunjava rupu u koju stane, inače preskače', () => {
    const busy = [slot('15:00', '16:00'), slot('16:30', '17:00')];
    expect(nextFreeSlotFrom(busy, 45, at(14))).toEqual({ start: '14:00', end: '14:45' });
    expect(nextFreeSlotFrom(busy, 60, at(14, 30))).toEqual({ start: '17:00', end: '18:00' });
    expect(nextFreeSlotFrom(busy, 30, at(15, 30))).toEqual({ start: '16:00', end: '16:30' });
  });
  it('kraj bloka koji nije na 5 min se zaokružuje', () => {
    expect(nextFreeSlotFrom([slot('14:00', '14:52')], 30, at(14))).toEqual({
      start: '14:55',
      end: '15:25',
    });
  });
  it('san i blokovi preko ponoći se ne gledaju', () => {
    expect(nextFreeSlotFrom([slot('23:00', '07:00', 'sleep')], 30, at(22))).toEqual({
      start: '22:00',
      end: '22:30',
    });
  });
  it('kraj dana: skraćuje do 23:59, a bez mjesta vraća null', () => {
    expect(nextFreeSlotFrom([], 60, at(23, 30))).toEqual({ start: '23:30', end: '23:59' });
    expect(nextFreeSlotFrom([], 30, at(23, 56))).toBeNull();
    expect(nextFreeSlotFrom([slot('20:00', '23:59')], 30, at(21))).toBeNull();
  });
});

describe('dayPartOf', () => {
  it('jutro / poslijepodne / večer', () => {
    expect(dayPartOf(at(5))).toBe('morning');
    expect(dayPartOf(at(11, 59))).toBe('morning');
    expect(dayPartOf(at(12))).toBe('afternoon');
    expect(dayPartOf(at(16, 59))).toBe('afternoon');
    expect(dayPartOf(at(17))).toBe('evening');
    expect(dayPartOf(at(2))).toBe('evening');
  });
});

describe('PLAN_IDEAS / exampleIdeas', () => {
  it('svaka ideja ima trajanje i doba dana, ključevi su jedinstveni', () => {
    const ids = PLAN_IDEAS.map((i) => i.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const i of PLAN_IDEAS) {
      expect(i.minutes).toBeGreaterThanOrEqual(15);
      expect(['morning', 'afternoon', 'evening']).toContain(i.bestPart);
    }
  });
  it('nazivi dolaze iz prijevoda', () => {
    const ideas = exampleIdeas((id) => `T:${id}`);
    expect(ideas[0]).toMatchObject({ key: 'example:deepWork', title: 'T:deepWork', source: 'example' });
  });
});

describe('ownIdeas', () => {
  const date = '2026-11-10';
  it('jednom upisano postaje ideja s trajanjem i dobom dana', () => {
    const ideas = ownIdeas([hist('2026-11-08', 'Ponavljanje kemije', '15:00', '15:45')], date);
    expect(ideas).toEqual([
      {
        key: 'own:ponavljanje kemije',
        title: 'Ponavljanje kemije',
        kind: 'task',
        minutes: 45,
        bestPart: 'afternoon',
        source: 'own',
      },
    ]);
  });
  it('najčešće trajanje i početak; poredano po broju dana', () => {
    const ideas = ownIdeas(
      [
        hist('2026-11-01', 'Trening', '07:00', '08:00'),
        hist('2026-11-03', 'trening', '07:00', '08:00'),
        hist('2026-11-05', 'Trening', '18:00', '19:30'),
        hist('2026-11-09', 'Zubar', '10:00', '10:30', 'fixed'),
      ],
      date,
    );
    expect(ideas.map((i) => [i.title, i.minutes, i.bestPart, i.kind])).toEqual([
      ['Trening', 60, 'morning', 'task'],
      ['Zubar', 30, 'morning', 'fixed'],
    ]);
  });
  it('preskače san, iskrslo, premještene, stare, buduće i već u planu', () => {
    const ideas = ownIdeas(
      [
        hist('2026-11-08', 'Spavanje', '23:00', '07:00', 'sleep'),
        hist('2026-11-08', 'Kvar', '10:00', '11:00', 'unexpected'),
        hist('2026-11-08', 'Premješteno', '10:00', '11:00', 'task', 'moved'),
        hist('2026-10-01', 'Staro', '10:00', '11:00'),
        hist('2026-11-10', 'Danas', '10:00', '11:00'),
        hist('2026-11-08', 'Već dodano', '10:00', '11:00'),
      ],
      date,
      ['već  dodano'],
    );
    expect(ideas).toEqual([]);
  });
});

describe('rankIdeas', () => {
  const ideas = [idea('A', 'morning'), idea('B', 'evening'), idea('C', 'afternoon'), idea('D', 'afternoon')];
  it('poslijepodne: trenutno, pa kasnije, pa prošlo', () => {
    expect(rankIdeas(ideas, at(14)).map((i) => i.title)).toEqual(['C', 'D', 'B', 'A']);
  });
  it('jutro: redoslijed doba dana', () => {
    expect(rankIdeas(ideas, at(8)).map((i) => i.title)).toEqual(['A', 'C', 'D', 'B']);
  });
  it('skriva već dodane nazive', () => {
    expect(rankIdeas(ideas, at(20), ['b', 'A']).map((i) => i.title)).toEqual(['C', 'D']);
  });
});

describe('ideaDraft', () => {
  it('u prvi slobodni termin od sada', () => {
    expect(ideaDraft(idea('Šetnja', 'evening', 30), [slot('14:00', '14:20')], at(14, 2))).toEqual({
      title: 'Šetnja',
      kind: 'task',
      start: '14:20',
      end: '14:50',
    });
  });
  it('nema mjesta → null', () => {
    expect(ideaDraft(idea('Šetnja', 'evening'), [], at(23, 57))).toBeNull();
  });
});

describe('typedTodayDraft', () => {
  it('vrijeme u budućnosti se koristi', () => {
    expect(typedTodayDraft('Zubar u 16', [], at(14))).toEqual(draft('Zubar', '16:00', '17:00'));
    expect(typedTodayDraft('Trening 18-19:30', [], at(14))).toEqual(draft('Trening', '18:00', '19:30'));
  });
  it('vrijeme u prošlosti → sljedeći slobodni termin (trajanje raspona ostaje)', () => {
    expect(typedTodayDraft('Trening 9-10:30', [], at(14, 2))).toEqual(draft('Trening', '14:05', '15:35'));
    expect(typedTodayDraft('Zubar u 9', [], at(14, 2))).toEqual(draft('Zubar', '14:05', '15:05'));
  });
  it('bez vremena → od sada, 1 h, iza zauzetog', () => {
    expect(typedTodayDraft('Mailovi', [slot('14:00', '14:30')], at(14, 10))).toEqual(
      draft('Mailovi', '14:30', '15:30'),
    );
  });
  it('prazno ili bez mjesta → null', () => {
    expect(typedTodayDraft('   ', [], at(14))).toBeNull();
    expect(typedTodayDraft('Mailovi', [], at(23, 58))).toBeNull();
  });
});

describe('isTodayPlanValid / startsInPast', () => {
  it('prazan plan nije valjan', () => {
    expect(isTodayPlanValid([], at(14))).toBe(false);
  });
  it('stavke od sada su valjane; mala zadrška je dopuštena', () => {
    expect(isTodayPlanValid([draft('A', '14:05', '15:00')], at(14, 2))).toBe(true);
    expect(isTodayPlanValid([draft('A', '14:05', '15:00')], at(14, 15))).toBe(true);
  });
  it('stavka u prošlosti (više od 10 min) nije valjana', () => {
    expect(startsInPast(draft('A', '13:00', '15:00'), at(14))).toBe(true);
    expect(isTodayPlanValid([draft('A', '14:05', '15:00'), draft('B', '13:00', '13:30')], at(14))).toBe(false);
  });
  it('neispravan blok (kraj prije početka) nije valjan', () => {
    expect(isTodayPlanValid([draft('A', '16:00', '15:00')], at(14))).toBe(false);
  });
});
