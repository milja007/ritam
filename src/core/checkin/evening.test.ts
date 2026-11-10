import { describe, expect, it } from '@jest/globals';

import type { Checkin, CheckinItem, RuleLog, ScheduleBlock } from '../domain';
import {
  blockStatusAfterCheckin,
  checklistBlocks,
  cleanText,
  createEveningDraft,
  eveningCheckinDate,
  eveningSteps,
  eveningXpAwards,
  isChecklistAnswerValid,
  isEveningDraftComplete,
  isEveningStepValid,
  movedBlockFields,
  otherDayOptions,
  resolveLaterDate,
  rulesActiveOn,
  sumAwards,
  taskXpForBlock,
  weekdayOf,
  type ChecklistAnswer,
  type EveningDraft,
} from './evening';

type B = Pick<ScheduleBlock, 'id' | 'kind' | 'status'>;
const block = (id: string, kind: B['kind'] = 'task', status: B['status'] = 'planned'): B => ({
  id,
  kind,
  status,
});

const base = { userId: 'u', createdAt: '2026-11-09T20:00:00.000Z', updatedAt: '2026-11-09T20:00:00.000Z' };

const checkin = (overrides: Partial<Checkin> = {}): Checkin => ({
  ...base,
  id: 'c1',
  date: '2026-11-09',
  kind: 'evening',
  sleepStart: null,
  wakeTime: null,
  mood: null,
  dayRating: 4,
  note: 'Dobar dan',
  scoreAreas: null,
  ...overrides,
});

const item = (
  refId: string,
  outcome: CheckinItem['outcome'],
  comment: string | null = null,
  laterDate: string | null = null,
): CheckinItem => ({
  ...base,
  id: `i-${refId}`,
  checkinId: 'c1',
  kind: 'task',
  refId,
  ok: outcome === 'ok',
  outcome,
  comment,
  laterDate,
  movedBlockId: laterDate === null ? null : `m-${refId}`,
});

const answer = (blockId: string, overrides: Partial<ChecklistAnswer> = {}): ChecklistAnswer => ({
  blockId,
  outcome: 'ok',
  comment: '',
  later: null,
  laterDate: null,
  ...overrides,
});

const log = (ruleId: string, kept: boolean, trigger: string | null = null): RuleLog => ({
  ...base,
  id: `l-${ruleId}`,
  ruleId,
  date: '2026-11-09',
  kept,
  trigger,
  checkinId: 'c1',
});

const complete = (overrides: Partial<EveningDraft> = {}): EveningDraft => ({
  date: '2026-11-09',
  items: [answer('a')],
  rules: [{ ruleId: 'r1', kept: true, trigger: '' }],
  rating: 3,
  note: '',
  ...overrides,
});

describe('checklistBlocks', () => {
  it('izostavlja san, čuva redoslijed', () => {
    const blocks = [block('s', 'sleep'), block('a'), block('f', 'fixed'), block('x', 'unexpected')];
    expect(checklistBlocks(blocks).map((b) => b.id)).toEqual(['a', 'f', 'x']);
  });
});

describe('weekdayOf / rulesActiveOn', () => {
  it('računa dan u tjednu bez vremenske zone', () => {
    expect(weekdayOf('2026-11-09')).toBe(1); // ponedjeljak
    expect(weekdayOf('2026-11-08')).toBe(0); // nedjelja
    expect(weekdayOf('2024-02-29')).toBe(4);
    expect(weekdayOf('2026-02-30')).toBeNull();
  });

  it('vraća samo zabrane koje vrijede taj dan', () => {
    const rules = [
      { id: 'radni', activeDays: [1, 2, 3, 4, 5] },
      { id: 'vikend', activeDays: [0, 6] },
      { id: 'uvijek', activeDays: [0, 1, 2, 3, 4, 5, 6] },
    ];
    expect(rulesActiveOn(rules, '2026-11-09').map((r) => r.id)).toEqual(['radni', 'uvijek']);
    expect(rulesActiveOn(rules, '2026-11-08').map((r) => r.id)).toEqual(['vikend', 'uvijek']);
    expect(rulesActiveOn(rules, 'nije-datum')).toEqual([]);
  });
});

describe('eveningCheckinDate', () => {
  it('prije 04:00 upit pripada prethodnom danu', () => {
    expect(eveningCheckinDate(new Date(2026, 10, 9, 21, 30))).toBe('2026-11-09');
    expect(eveningCheckinDate(new Date(2026, 10, 10, 0, 30))).toBe('2026-11-09');
    expect(eveningCheckinDate(new Date(2026, 10, 10, 3, 59))).toBe('2026-11-09');
    expect(eveningCheckinDate(new Date(2026, 10, 10, 4, 0))).toBe('2026-11-10');
    expect(eveningCheckinDate(new Date(2026, 0, 1, 1, 0))).toBe('2025-12-31');
  });
});

describe('kad kasnije?', () => {
  it('drugi dan nudi prekosutra … +7 dana', () => {
    expect(otherDayOptions('2026-11-28')).toEqual([
      '2026-11-30',
      '2026-12-01',
      '2026-12-02',
      '2026-12-03',
      '2026-12-04',
      '2026-12-05',
    ]);
  });

  it('dan premještanja: sutra, odabrani drugi dan ili ništa', () => {
    const d = '2026-11-09';
    expect(resolveLaterDate(answer('a', { outcome: 'not', later: 'tomorrow' }), d)).toBe('2026-11-10');
    expect(resolveLaterDate(answer('a', { outcome: 'partial', later: 'other', laterDate: '2026-11-12' }), d)).toBe(
      '2026-11-12',
    );
    expect(resolveLaterDate(answer('a', { outcome: 'not', later: 'other', laterDate: '2026-11-10' }), d)).toBeNull();
    expect(resolveLaterDate(answer('a', { outcome: 'not', later: 'other', laterDate: '2026-11-17' }), d)).toBeNull();
    expect(resolveLaterDate(answer('a', { outcome: 'not', later: 'skip' }), d)).toBeNull();
    expect(resolveLaterDate(answer('a', { outcome: 'ok', later: 'tomorrow' }), d)).toBeNull();
  });

  it('Djelomično i Nije traže "kad kasnije?", drugi dan traži ispravan dan', () => {
    const d = '2026-11-09';
    expect(isChecklistAnswerValid(answer('a'), d)).toBe(true);
    expect(isChecklistAnswerValid(answer('a', { outcome: null }), d)).toBe(false);
    expect(isChecklistAnswerValid(answer('a', { outcome: 'partial' }), d)).toBe(false);
    expect(isChecklistAnswerValid(answer('a', { outcome: 'partial', later: 'skip' }), d)).toBe(true);
    expect(isChecklistAnswerValid(answer('a', { outcome: 'not', later: 'tomorrow' }), d)).toBe(true);
    expect(isChecklistAnswerValid(answer('a', { outcome: 'not', later: 'other' }), d)).toBe(false);
    expect(isChecklistAnswerValid(answer('a', { outcome: 'not', later: 'other', laterDate: '2026-11-16' }), d)).toBe(
      true,
    );
    expect(
      isChecklistAnswerValid(answer('a', { outcome: 'not', later: 'skip', comment: 'x'.repeat(2001) }), d),
    ).toBe(false);
  });

  it('premješteni blok: isti naziv i termin, planiran, ručni', () => {
    expect(
      movedBlockFields(
        { title: 'Teretana', start: '18:00', end: '19:00', taskId: null, kind: 'task' },
        '2026-11-10',
      ),
    ).toEqual({
      date: '2026-11-10',
      title: 'Teretana',
      start: '18:00',
      end: '19:00',
      taskId: null,
      kind: 'task',
      source: 'user',
      status: 'planned',
      note: null,
    });
    expect(
      movedBlockFields({ title: 'Kava', start: '10:00', end: '10:30', taskId: null, kind: 'calendar' }, '2026-11-10')
        .kind,
    ).toBe('fixed');
  });
});

describe('createEveningDraft', () => {
  it('novi upit: gotovi blokovi su unaprijed U redu, ostalo bez odgovora', () => {
    const draft = createEveningDraft(
      '2026-11-09',
      [block('s', 'sleep'), block('a', 'task', 'done'), block('b')],
      [{ id: 'r1' }],
    );
    expect(draft).toEqual({
      date: '2026-11-09',
      items: [answer('a'), answer('b', { outcome: null })],
      rules: [{ ruleId: 'r1', kept: null, trigger: '' }],
      rating: null,
      note: '',
    });
  });

  it('postojeći upit: preuzima odgovore i "kad kasnije?", novi blokovi su bez odgovora', () => {
    const draft = createEveningDraft(
      '2026-11-09',
      [block('a', 'task', 'done'), block('b'), block('c'), block('d'), block('novi')],
      [{ id: 'r1' }, { id: 'r2' }],
      {
        checkin: checkin({ note: null }),
        items: [
          item('a', 'not', 'Kasnio'),
          item('b', 'ok'),
          item('c', 'partial', null, '2026-11-10'),
          item('d', 'not', 'Gužva', '2026-11-13'),
        ],
        ruleLogs: [log('r1', false, 'Stres')],
      },
    );
    expect(draft.items).toEqual([
      answer('a', { outcome: 'not', comment: 'Kasnio', later: 'skip' }),
      answer('b'),
      answer('c', { outcome: 'partial', later: 'tomorrow' }),
      answer('d', { outcome: 'not', comment: 'Gužva', later: 'other', laterDate: '2026-11-13' }),
      answer('novi', { outcome: null }),
    ]);
    expect(draft.rules).toEqual([
      { ruleId: 'r1', kept: false, trigger: 'Stres' },
      { ruleId: 'r2', kept: null, trigger: '' },
    ]);
    expect(draft.rating).toBe(4);
    expect(draft.note).toBe('');
  });
});

describe('koraci i validacija', () => {
  it('preskače korak zabrana kad nijedna ne vrijedi', () => {
    expect(eveningSteps(complete())).toEqual(['checklist', 'rules', 'rating']);
    expect(eveningSteps(complete({ rules: [] }))).toEqual(['checklist', 'rating']);
  });

  it('checklist traži odgovor na svaku stavku; prazna checklista je ispunjena', () => {
    expect(isEveningStepValid('checklist', complete())).toBe(true);
    expect(isEveningStepValid('checklist', complete({ items: [] }))).toBe(true);
    expect(isEveningStepValid('checklist', complete({ items: [answer('a', { outcome: null })] }))).toBe(false);
    expect(isEveningStepValid('checklist', complete({ items: [answer('a', { outcome: 'not' })] }))).toBe(false);
    expect(
      isEveningStepValid('checklist', complete({ items: [answer('a', { outcome: 'not', later: 'skip' })] })),
    ).toBe(true);
  });

  it('zabrane traže odgovor na svaku', () => {
    expect(isEveningStepValid('rules', complete({ rules: [{ ruleId: 'r', kept: null, trigger: '' }] }))).toBe(
      false,
    );
    expect(isEveningStepValid('rules', complete({ rules: [{ ruleId: 'r', kept: false, trigger: '' }] }))).toBe(
      true,
    );
  });

  it('ocjena mora biti cijeli broj 1–5', () => {
    expect(isEveningStepValid('rating', complete({ rating: null }))).toBe(false);
    expect(isEveningStepValid('rating', complete({ rating: 0 }))).toBe(false);
    expect(isEveningStepValid('rating', complete({ rating: 6 }))).toBe(false);
    expect(isEveningStepValid('rating', complete({ rating: 2.5 }))).toBe(false);
    expect(isEveningStepValid('rating', complete({ rating: 5 }))).toBe(true);
  });

  it('cijeli nacrt', () => {
    expect(isEveningDraftComplete(complete())).toBe(true);
    expect(isEveningDraftComplete(complete({ rules: [] }))).toBe(true);
    expect(isEveningDraftComplete(complete({ rating: null }))).toBe(false);
    expect(isEveningDraftComplete(complete({ date: '2026-13-01' }))).toBe(false);
  });
});

describe('cleanText', () => {
  it('prazno → null, inače obrezano', () => {
    expect(cleanText('   ')).toBeNull();
    expect(cleanText(' Umor ')).toBe('Umor');
  });
});

describe('blockStatusAfterCheckin', () => {
  it('U redu → done, Djelomično → partial, Nije → moved ili skipped', () => {
    expect(blockStatusAfterCheckin('ok', null)).toBe('done');
    expect(blockStatusAfterCheckin('partial', null)).toBe('partial');
    expect(blockStatusAfterCheckin('partial', '2026-11-10')).toBe('partial');
    expect(blockStatusAfterCheckin('not', '2026-11-10')).toBe('moved');
    expect(blockStatusAfterCheckin('not', null)).toBe('skipped');
  });
});

describe('taskXpForBlock', () => {
  it('zadatak: gotovo 15, djelomično 8; ostalo bez XP-a', () => {
    expect(taskXpForBlock({ kind: 'task', status: 'done' })).toEqual({ source: 'task', amount: 15 });
    expect(taskXpForBlock({ kind: 'task', status: 'partial' })).toEqual({ source: 'task', amount: 8 });
    expect(taskXpForBlock({ kind: 'task', status: 'planned' })).toBeNull();
    expect(taskXpForBlock({ kind: 'task', status: 'skipped' })).toBeNull();
    expect(taskXpForBlock({ kind: 'task', status: 'moved' })).toBeNull();
    expect(taskXpForBlock({ kind: 'fixed', status: 'done' })).toBeNull();
  });
});

describe('eveningXpAwards', () => {
  const rules = [
    { id: 'r1', weight: 1 as const },
    { id: 'r3', weight: 3 as const },
  ];

  it('upit + poštovane zabrane; bez kazni (XP zadataka ide preko statusa bloka)', () => {
    const awards = eveningXpAwards(
      {
        rules: [
          { ruleId: 'r1', kept: false, trigger: 'Umor' },
          { ruleId: 'r3', kept: true, trigger: '' },
        ],
      },
      rules,
      'c1',
    );
    expect(awards).toEqual([
      { source: 'checkin', amount: 15, sourceId: 'c1' },
      { source: 'rule', amount: 20, sourceId: 'r3' },
    ]);
    expect(sumAwards(awards)).toBe(35);
  });

  it('nepoznata zabrana ne daje XP', () => {
    const awards = eveningXpAwards({ rules: [{ ruleId: 'nema', kept: true, trigger: '' }] }, rules, 'c1');
    expect(awards).toEqual([{ source: 'checkin', amount: 15, sourceId: 'c1' }]);
  });
});
