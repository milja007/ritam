/**
 * @jest-environment node
 */
import { describe, expect, it } from '@jest/globals';

import type { ChecklistAnswer, EveningDraft } from '@/core/checkin';

import { createBlock, createRule, listDayScores, saveEveningCheckin, type RuleInput } from './repos';
import { createTestDb, testDeps } from './testing/test-db';

const USER = 'user-1';
const BEFORE = '2026-11-08';
const YESTERDAY = '2026-11-09';
const DATE = '2026-11-10';

const ans = (blockId: string, outcome: ChecklistAnswer['outcome']): ChecklistAnswer => ({
  blockId,
  outcome,
  comment: '',
  later: outcome === 'ok' ? null : 'skip',
  laterDate: null,
});

const ruleInput: RuleInput = {
  title: 'Bez slatkiša',
  icon: null,
  activeDays: [0, 1, 2, 3, 4, 5, 6],
  activeHours: null,
  why: '',
  weight: 3,
};

const draft = (date: string, items: ChecklistAnswer[], ruleId: string, kept: boolean): EveningDraft => ({
  date,
  items,
  rules: [{ ruleId, kept, trigger: '' }],
  rating: 3,
  note: '',
});

async function setup() {
  const { db } = await createTestDb();
  const deps = testDeps('2026-11-10T19:00:00.000Z');
  const block = (date: string, title: string, start: string, end: string) =>
    createBlock(
      db,
      USER,
      { date, title, start, end, taskId: null, kind: 'task', source: 'user', status: 'planned' },
      deps,
    );
  const rule = await createRule(db, USER, ruleInput, deps);
  return { db, deps, block, rule };
}

describe('listDayScores', () => {
  it('prazna baza: nema ocijenjenih dana', async () => {
    const { db } = await setup();
    expect(listDayScores(db, USER, DATE)).toEqual({ days: [], longestStreak: 0 });
  });

  it('dani s ispunjenim upitom + današnji "u tijeku"; dani bez upita ne ulaze', async () => {
    const { db, deps, block, rule } = await setup();
    await block(BEFORE, 'Učenje', '09:00', '10:00'); // bez upita → ne ulazi
    const y1 = await block(YESTERDAY, 'Učenje', '09:00', '10:00');
    const y2 = await block(YESTERDAY, 'Trening', '18:00', '19:00');
    const t1 = await block(DATE, 'Učenje', '09:00', '10:00');
    const t2 = await block(DATE, 'Trening', '18:00', '19:00');
    await block('2026-11-11', 'Sutra', '09:00', '10:00'); // poslije traženog dana
    saveEveningCheckin(db, USER, draft(YESTERDAY, [ans(y1.id, 'ok'), ans(y2.id, 'not')], rule.id, false), deps);

    // Jučer: plan 50 %, zabrana prekršena (0) → 25. Danas: ništa odrađeno, upit nije ispunjen → 0, u tijeku.
    expect(listDayScores(db, USER, DATE)).toEqual({
      days: [
        { date: YESTERDAY, score: 25, final: true },
        { date: DATE, score: 0, final: false },
      ],
      longestStreak: 1,
    });

    saveEveningCheckin(db, USER, draft(DATE, [ans(t1.id, 'ok'), ans(t2.id, 'ok')], rule.id, true), deps);
    expect(listDayScores(db, USER, DATE)).toEqual({
      days: [
        { date: YESTERDAY, score: 25, final: true },
        { date: DATE, score: 100, final: true },
      ],
      longestStreak: 2,
    });

    // Pogled na jučer ne vidi današnji dan.
    expect(listDayScores(db, USER, YESTERDAY).days).toEqual([{ date: YESTERDAY, score: 25, final: true }]);
  });
});
