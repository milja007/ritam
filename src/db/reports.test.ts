/**
 * @jest-environment node
 */
import { describe, expect, it } from '@jest/globals';

import type { ChecklistAnswer, EveningDraft } from '@/core/checkin';
import { parseDayDiagnosis } from '@/core/diagnosis';
import { createDefaultDraft, toSettingsInput } from '@/core/onboarding';

import {
  createBlock,
  createRule,
  generateDayReport,
  getReport,
  saveEveningCheckin,
  saveSettings,
  type RuleInput,
} from './repos';
import { reports } from './schema';
import { createTestDb, testDeps } from './testing/test-db';

const USER = 'user-1';
const YESTERDAY = '2026-11-09';
const DATE = '2026-11-10';

const ans = (blockId: string, outcome: ChecklistAnswer['outcome'], comment = ''): ChecklistAnswer => ({
  blockId,
  outcome,
  comment,
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

async function setup() {
  const { db, raw } = await createTestDb();
  const deps = testDeps('2026-11-10T19:00:00.000Z');
  const block = (date: string, title: string, start: string, end: string) =>
    createBlock(
      db,
      USER,
      { date, title, start, end, taskId: null, kind: 'task', source: 'user', status: 'planned' },
      deps,
    );
  const rule = await createRule(db, USER, ruleInput, deps);
  // Prate se sva tri područja, da dijagnoza govori i o zabranama i snu.
  await saveSettings(db, USER, { ...toSettingsInput(createDefaultDraft('hr')), scoreRules: true, scoreSleep: true }, deps);
  return { db, raw, deps, block, rule };
}

const draft = (date: string, items: ChecklistAnswer[], ruleId: string, kept: boolean, rating: number): EveningDraft => ({
  date,
  items,
  rules: [{ ruleId, kept, trigger: kept ? '' : 'stres' }],
  rating,
  note: '',
});

describe('reports repo — dnevna dijagnoza', () => {
  it('vraća null prije generiranja', async () => {
    const { db } = await setup();
    expect(await getReport(db, USER, 'day', DATE)).toBeNull();
  });

  it('prvi dan: sprema dijagnozu bez usporedbe s jučer', async () => {
    const { db, deps, block, rule } = await setup();
    const a = await block(DATE, 'Učenje', '09:00', '10:00');
    const b = await block(DATE, 'Trening', '18:00', '19:00');
    saveEveningCheckin(db, USER, draft(DATE, [ans(a.id, 'ok'), ans(b.id, 'not', 'umoran')], rule.id, false, 2), deps);

    const { report, diagnosis } = generateDayReport(db, USER, DATE, deps);
    expect(report).toMatchObject({
      period: 'day',
      periodStart: DATE,
      promptVersion: 'local-day-v2',
      suggestion: 'ideas.ruleTrigger',
      helpful: null,
    });
    expect(diagnosis.trend).toBe('first');
    expect(diagnosis.noticed).toContainEqual({
      key: 'noticed.comment.not',
      params: { title: 'Trening', comment: 'umoran' },
    });
    expect(diagnosis.problems).toContainEqual({ key: 'problems.heavyRule', params: { rule: 'Bez slatkiša' } });

    const stored = await getReport(db, USER, 'day', DATE);
    expect(parseDayDiagnosis(stored?.sections)).toEqual(diagnosis);
  });

  it('uspoređuje s jučer samo kad je jučerašnji upit ispunjen', async () => {
    const { db, deps, block, rule } = await setup();
    const y1 = await block(YESTERDAY, 'Učenje', '09:00', '10:00');
    const y2 = await block(YESTERDAY, 'Trening', '18:00', '19:00');
    const t1 = await block(DATE, 'Učenje', '09:00', '10:00');
    const t2 = await block(DATE, 'Trening', '18:00', '19:00');
    saveEveningCheckin(db, USER, draft(DATE, [ans(t1.id, 'ok'), ans(t2.id, 'ok')], rule.id, true, 4), deps);

    // Jučer bez upita → prvi dan.
    expect(generateDayReport(db, USER, DATE, deps).diagnosis.trend).toBe('first');

    saveEveningCheckin(db, USER, draft(YESTERDAY, [ans(y1.id, 'ok'), ans(y2.id, 'not')], rule.id, false, 3), deps);
    const { diagnosis } = generateDayReport(db, USER, DATE, deps);
    expect(diagnosis.trend).toBe('better');
    expect(diagnosis.summary).toEqual({ key: 'summary.better', params: { done: 2, total: 2 } });
    expect(diagnosis.progress.find((row) => row.metric === 'plan')).toMatchObject({
      value: 2,
      previous: 1,
      change: 'up',
      good: true,
    });
    expect(diagnosis.progress.find((row) => row.metric === 'streak')?.value).toBe(2);
  });

  it('isti problem dva dana zaredom: jučerašnja ideja ostaje + nova ideja', async () => {
    const { db, deps, block, rule } = await setup();
    const y1 = await block(YESTERDAY, 'Učenje', '09:00', '10:00');
    const t1 = await block(DATE, 'Učenje', '09:00', '10:00');
    saveEveningCheckin(db, USER, draft(YESTERDAY, [ans(y1.id, 'ok')], rule.id, false, 3), deps);
    saveEveningCheckin(db, USER, draft(DATE, [ans(t1.id, 'ok')], rule.id, false, 3), deps);
    const trigger = { key: 'ideas.ruleTrigger', params: { rule: 'Bez slatkiša', trigger: 'stres' } };

    expect(generateDayReport(db, USER, YESTERDAY, deps).diagnosis.ideas).toEqual([trigger]);
    const { report, diagnosis } = generateDayReport(db, USER, DATE, deps);
    expect(diagnosis.ideas).toEqual([
      { ...trigger, params: { ...trigger.params, repeatedDays: 2 } },
      { key: 'ideas.ruleSmallStep', params: trigger.params },
    ]);
    expect(report.suggestion).toBe('ideas.ruleTrigger');
  });

  it('ponovno generiranje ažurira isti red i čuva povratnu informaciju', async () => {
    const { db, raw, deps, block, rule } = await setup();
    const a = await block(DATE, 'Učenje', '09:00', '10:00');
    saveEveningCheckin(db, USER, draft(DATE, [ans(a.id, 'not')], rule.id, true, 3), deps);
    const first = generateDayReport(db, USER, DATE, deps).report;
    raw.prepare("UPDATE reports SET helpful = 1, feedback_comment = 'dobro'").run();

    saveEveningCheckin(db, USER, draft(DATE, [ans(a.id, 'ok')], rule.id, true, 5), deps);
    const second = generateDayReport(db, USER, DATE, deps).report;

    expect(second.id).toBe(first.id);
    expect(second.createdAt).toBe(first.createdAt);
    expect(second.updatedAt > first.updatedAt).toBe(true);
    expect(second.helpful).toBe(true);
    expect(second.feedbackComment).toBe('dobro');
    const rows = await db.select().from(reports).all();
    expect(rows).toHaveLength(1);
    expect(parseDayDiagnosis(rows[0]?.sections)?.praise[0]).toEqual({ key: 'praise.allDone', params: { total: 1 } });
  });

  it('dijagnoze su po korisniku', async () => {
    const { db, deps, block, rule } = await setup();
    const a = await block(DATE, 'Učenje', '09:00', '10:00');
    saveEveningCheckin(db, USER, draft(DATE, [ans(a.id, 'ok')], rule.id, true, 4), deps);
    generateDayReport(db, USER, DATE, deps);
    expect(await getReport(db, 'drugi', 'day', DATE)).toBeNull();
  });
});
