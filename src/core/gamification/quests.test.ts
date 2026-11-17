import { describe, expect, it } from '@jest/globals';

import {
  MAX_ACTIVE_QUESTS,
  QUEST_DONE_XP,
  QUEST_MILESTONE_XP,
  canStartQuest,
  questDaysLeft,
  questProgress,
  questXpAwards,
  sortQuests,
} from './quests';

const m = (id: string, doneOn: string | null = null) => ({ id, title: id, doneOn });

describe('epski questovi', () => {
  it('XP: svaka ostvarena etapa + ostvaren quest', () => {
    expect(questXpAwards({ id: 'q', milestones: [m('a', '2026-11-10'), m('b')], doneOn: null })).toEqual([
      { sourceId: 'a', date: '2026-11-10', amount: QUEST_MILESTONE_XP },
    ]);
    expect(questXpAwards({ id: 'q', milestones: [m('a', '2026-11-10')], doneOn: '2026-11-12' })).toEqual([
      { sourceId: 'a', date: '2026-11-10', amount: QUEST_MILESTONE_XP },
      { sourceId: 'q', date: '2026-11-12', amount: QUEST_DONE_XP },
    ]);
    expect(questXpAwards({ id: 'q', milestones: [], doneOn: null })).toEqual([]);
  });

  it('napredak', () => {
    expect(questProgress({ milestones: [m('a', '2026-11-10'), m('b'), m('c'), m('d')], status: 'active' })).toEqual({
      done: 1,
      total: 4,
      fraction: 0.25,
    });
    expect(questProgress({ milestones: [], status: 'active' }).fraction).toBe(0);
    expect(questProgress({ milestones: [m('a')], status: 'done' }).fraction).toBe(1);
  });

  it('dani do roka', () => {
    expect(questDaysLeft({ targetDate: null }, '2026-11-17')).toBeNull();
    expect(questDaysLeft({ targetDate: '2026-11-20' }, '2026-11-17')).toBe(3);
    expect(questDaysLeft({ targetDate: '2026-11-15' }, '2026-11-17')).toBe(-2);
  });

  it(`najviše ${MAX_ACTIVE_QUESTS} u tijeku`, () => {
    const active = { status: 'active' as const };
    expect(canStartQuest([active, active])).toBe(true);
    expect(canStartQuest([active, active, active])).toBe(false);
    expect(canStartQuest([active, active, { status: 'done' }, { status: 'archived' }])).toBe(true);
  });

  it('redoslijed: u tijeku po roku (bez roka zadnji), pa ostvareni noviji prvi, pa arhiva', () => {
    const q = (id: string, status: 'active' | 'done' | 'archived', targetDate: string | null, doneOn: string | null, createdAt = '2026-11-01T00:00:00.000Z') => ({
      id,
      status,
      targetDate,
      doneOn,
      createdAt,
    });
    const sorted = sortQuests([
      q('arch', 'archived', null, null),
      q('done-old', 'done', null, '2026-10-01'),
      q('free', 'active', null, null),
      q('late', 'active', '2027-06-01', null),
      q('done-new', 'done', null, '2026-11-10'),
      q('soon', 'active', '2026-12-01', null),
    ]);
    expect(sorted.map((quest) => quest.id)).toEqual(['soon', 'late', 'free', 'done-new', 'done-old', 'arch']);
  });
});
