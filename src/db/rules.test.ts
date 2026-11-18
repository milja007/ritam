/**
 * @jest-environment node
 */
import { describe, expect, it } from '@jest/globals';
import { ZodError } from 'zod';

import { MAX_RULES_PER_PERIOD } from '@/core/domain';

import {
  RuleHasHistoryError,
  RuleLimitError,
  createRule,
  deleteRule,
  listRuleLogs,
  listRules,
  type RuleInput,
} from './repos';
import { ruleLogs } from './schema';
import { readQueue } from './sync';
import { createTestDb, testDeps } from './testing/test-db';

const USER = 'user-1';
const input = (title: string, patch: Partial<RuleInput> = {}): RuleInput => ({
  title,
  icon: null,
  activeDays: [0, 1, 2, 3, 4, 5, 6],
  activeHours: null,
  why: 'Zašto',
  weight: 2,
  period: 'week',
  periodStart: '2026-11-16',
  ...patch,
});

async function setup() {
  const { db } = await createTestDb();
  return { db, deps: testDeps('2026-11-18T10:00:00.000Z') };
}

function addLog(db: Awaited<ReturnType<typeof setup>>['db'], ruleId: string, date: string, kept: boolean, userId = USER) {
  db.insert(ruleLogs)
    .values({
      id: `log-${ruleId}-${date}`,
      userId,
      createdAt: '2026-11-18T10:00:00.000Z',
      updatedAt: '2026-11-18T10:00:00.000Z',
      ruleId,
      date,
      kept,
      trigger: null,
      checkinId: null,
    })
    .run();
}

describe('zabrane unutar planova (repo)', () => {
  it('sprema razdoblje i stalne zabrane te ih bilježi za sync', async () => {
    const { db, deps } = await setup();
    await createRule(db, USER, input('Bez slatkiša'), deps);
    await createRule(db, USER, input('Stalna', { period: null, periodStart: null }), deps);
    const rules = await listRules(db, USER);
    expect(rules.map((rule) => [rule.title, rule.period, rule.periodStart])).toEqual([
      ['Bez slatkiša', 'week', '2026-11-16'],
      ['Stalna', null, null],
    ]);
    expect(readQueue(db).filter((entry) => entry.tableName === 'rules')).toHaveLength(2);
  });

  it('najviše MAX_RULES_PER_PERIOD po razdoblju; krivi početak se ne sprema', async () => {
    const { db, deps } = await setup();
    for (let i = 0; i < MAX_RULES_PER_PERIOD; i += 1) await createRule(db, USER, input(`Z${i}`), deps);
    await expect(createRule(db, USER, input('Previše'), deps)).rejects.toBeInstanceOf(RuleLimitError);
    // Drugi tjedan, stalne zabrane i drugi korisnik nisu ograničeni tim brojem.
    await createRule(db, USER, input('Sljedeći', { periodStart: '2026-11-23' }), deps);
    await createRule(db, USER, input('Stalna', { period: null, periodStart: null }), deps);
    await createRule(db, 'user-2', input('Tuđa'), deps);
    await expect(createRule(db, USER, input('Srijeda', { periodStart: '2026-11-18' }), deps)).rejects.toBeInstanceOf(
      ZodError,
    );
    expect(await listRules(db, USER)).toHaveLength(MAX_RULES_PER_PERIOD + 2);
  });

  it('čita zapise samo traženih zabrana tog korisnika, uzlazno', async () => {
    const { db, deps } = await setup();
    const a = await createRule(db, USER, input('A'), deps);
    const b = await createRule(db, USER, input('B'), deps);
    addLog(db, a.id, '2026-11-17', false);
    addLog(db, a.id, '2026-11-16', true);
    addLog(db, b.id, '2026-11-16', true);
    const logs = await listRuleLogs(db, USER, [a.id]);
    expect(logs.map((log) => [log.date, log.kept])).toEqual([
      ['2026-11-16', true],
      ['2026-11-17', false],
    ]);
    expect(await listRuleLogs(db, 'user-2', [a.id])).toEqual([]);
    expect(await listRuleLogs(db, USER, [])).toEqual([]);
  });

  it('briše samo zabranu bez povijesti', async () => {
    const { db, deps } = await setup();
    const fresh = await createRule(db, USER, input('Krivo upisano'), deps);
    const used = await createRule(db, USER, input('S poviješću'), deps);
    addLog(db, used.id, '2026-11-16', true);
    expect(await deleteRule(db, 'user-2', fresh.id)).toBe(false);
    expect(await deleteRule(db, USER, fresh.id)).toBe(true);
    await expect(deleteRule(db, USER, used.id)).rejects.toBeInstanceOf(RuleHasHistoryError);
    expect((await listRules(db, USER)).map((rule) => rule.title)).toEqual(['S poviješću']);
    expect(await listRuleLogs(db, USER, [used.id])).toHaveLength(1);
  });
});
