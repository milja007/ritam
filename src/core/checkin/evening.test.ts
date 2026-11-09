import { describe, expect, it } from '@jest/globals';

import type { Checkin, CheckinItem, RuleLog, ScheduleBlock } from '../domain';
import {
  blockStatusAfterCheckin,
  checklistBlocks,
  cleanText,
  createEveningDraft,
  eveningSteps,
  eveningXpAwards,
  isEveningDraftComplete,
  isEveningStepValid,
  rulesActiveOn,
  sumAwards,
  weekdayOf,
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
  ...overrides,
});

const item = (refId: string, ok: boolean, comment: string | null = null): CheckinItem => ({
  ...base,
  id: `i-${refId}`,
  checkinId: 'c1',
  kind: 'task',
  refId,
  ok,
  comment,
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
  items: [{ blockId: 'a', ok: true, comment: '' }],
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

describe('createEveningDraft', () => {
  it('novi upit: gotovi blokovi su unaprijed U redu, ostalo bez odgovora', () => {
    const draft = createEveningDraft(
      [block('s', 'sleep'), block('a', 'task', 'done'), block('b')],
      [{ id: 'r1' }],
    );
    expect(draft).toEqual({
      items: [
        { blockId: 'a', ok: true, comment: '' },
        { blockId: 'b', ok: null, comment: '' },
      ],
      rules: [{ ruleId: 'r1', kept: null, trigger: '' }],
      rating: null,
      note: '',
    });
  });

  it('postojeći upit: preuzima spremljene odgovore, novi blokovi su bez odgovora', () => {
    const draft = createEveningDraft(
      [block('a', 'task', 'done'), block('b'), block('novi')],
      [{ id: 'r1' }, { id: 'r2' }],
      {
        checkin: checkin({ note: null }),
        items: [item('a', false, 'Kasnio'), item('b', true)],
        ruleLogs: [log('r1', false, 'Stres')],
      },
    );
    expect(draft.items).toEqual([
      { blockId: 'a', ok: false, comment: 'Kasnio' },
      { blockId: 'b', ok: true, comment: '' },
      { blockId: 'novi', ok: null, comment: '' },
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
    expect(
      isEveningStepValid('checklist', complete({ items: [{ blockId: 'a', ok: null, comment: '' }] })),
    ).toBe(false);
    expect(
      isEveningStepValid(
        'checklist',
        complete({ items: [{ blockId: 'a', ok: false, comment: 'x'.repeat(2001) }] }),
      ),
    ).toBe(false);
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
  });
});

describe('cleanText', () => {
  it('prazno → null, inače obrezano', () => {
    expect(cleanText('   ')).toBeNull();
    expect(cleanText(' Umor ')).toBe('Umor');
  });
});

describe('blockStatusAfterCheckin', () => {
  it('U redu → done, Nije → skipped, djelomično/premješteno ostaje', () => {
    expect(blockStatusAfterCheckin('planned', true)).toBe('done');
    expect(blockStatusAfterCheckin('skipped', true)).toBe('done');
    expect(blockStatusAfterCheckin('planned', false)).toBe('skipped');
    expect(blockStatusAfterCheckin('done', false)).toBe('skipped');
    expect(blockStatusAfterCheckin('partial', false)).toBe('partial');
    expect(blockStatusAfterCheckin('moved', false)).toBe('moved');
  });
});

describe('eveningXpAwards', () => {
  const blocks = [
    { id: 'a', kind: 'task' as const },
    { id: 'b', kind: 'task' as const },
    { id: 'f', kind: 'fixed' as const },
  ];
  const rules = [
    { id: 'r1', weight: 1 as const },
    { id: 'r3', weight: 3 as const },
  ];

  it('upit + zadaci U redu + poštovane zabrane; bez kazni', () => {
    const awards = eveningXpAwards(
      {
        items: [
          { blockId: 'a', ok: true, comment: '' },
          { blockId: 'b', ok: false, comment: 'Nisam stigao' },
          { blockId: 'f', ok: true, comment: '' },
        ],
        rules: [
          { ruleId: 'r1', kept: false, trigger: 'Umor' },
          { ruleId: 'r3', kept: true, trigger: '' },
        ],
        rating: 4,
        note: '',
      },
      blocks,
      rules,
      'c1',
    );
    expect(awards).toEqual([
      { source: 'checkin', amount: 15, sourceId: 'c1' },
      { source: 'task', amount: 15, sourceId: 'a' },
      { source: 'rule', amount: 20, sourceId: 'r3' },
    ]);
    expect(sumAwards(awards)).toBe(50);
  });

  it('nepoznati blok ili zabrana ne daju XP', () => {
    const awards = eveningXpAwards(
      complete({ items: [{ blockId: 'nema', ok: true, comment: '' }], rules: [{ ruleId: 'nema', kept: true, trigger: '' }] }),
      blocks,
      rules,
      'c1',
    );
    expect(awards).toEqual([{ source: 'checkin', amount: 15, sourceId: 'c1' }]);
  });
});
