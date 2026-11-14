/**
 * @jest-environment node
 */
import { describe, expect, it } from '@jest/globals';

import type { ChecklistAnswer, EveningDraft } from '@/core/checkin';
import { parseWeekDiagnosis } from '@/core/diagnosis';
import { createDefaultDraft, toSettingsInput } from '@/core/onboarding';
import { addDays } from '@/core/time/local-date';

import {
  answerReportSuggestion,
  createBlock,
  createRule,
  generateWeekReport,
  getReport,
  saveEveningCheckin,
  saveSettings,
} from './repos';
import { reports } from './schema';
import { createTestDb, testDeps } from './testing/test-db';

const USER = 'user-1';
const WEEK = '2026-11-09'; // ponedjeljak
const PREVIOUS = '2026-11-02';
const NEXT = '2026-11-16';

const day = (start: string, offset: number) => addDays(start, offset) ?? start;

async function setup() {
  const { db, raw } = await createTestDb();
  const deps = testDeps('2026-11-20T19:00:00.000Z');
  const rule = await createRule(
    db,
    USER,
    { title: 'Bez slatkiša', icon: null, activeDays: [0, 1, 2, 3, 4, 5, 6], activeHours: null, why: '', weight: 1 },
    deps,
  );
  await saveSettings(db, USER, { ...toSettingsInput(createDefaultDraft('hr')), scoreRules: true, scoreSleep: true }, deps);

  /** Zaključi dan: `done` od `total` blokova odrađeno, zabrana poštovana ili ne. */
  const closeDay = async (date: string, done: number, total: number, kept = true) => {
    const items: ChecklistAnswer[] = [];
    for (let i = 0; i < total; i += 1) {
      const hour = String(9 + i).padStart(2, '0');
      const block = await createBlock(
        db,
        USER,
        { date, title: `Blok ${i}`, start: `${hour}:00`, end: `${hour}:45`, taskId: null, kind: 'task', source: 'user', status: 'planned' },
        deps,
      );
      const ok = i < done;
      items.push({ blockId: block.id, outcome: ok ? 'ok' : 'not', comment: '', later: ok ? null : 'skip', laterDate: null });
    }
    const draft: EveningDraft = {
      date,
      items,
      rules: [{ ruleId: rule.id, kept, trigger: kept ? '' : 'umor' }],
      rating: 3,
      note: '',
    };
    saveEveningCheckin(db, USER, draft, deps);
  };
  /** Zaključi prvih `count` dana tjedna s istim ishodom. */
  const closeWeek = async (start: string, count: number, done: number, total: number, kept = true) => {
    for (let offset = 0; offset < count; offset += 1) await closeDay(day(start, offset), done, total, kept);
  };
  return { db, raw, deps, closeDay, closeWeek };
}

describe('generateWeekReport', () => {
  it('tjedan bez zaključenih dana nema dijagnozu i ništa ne sprema', async () => {
    const { db, deps } = await setup();
    expect(generateWeekReport(db, USER, WEEK, deps)).toBeNull();
    expect(await db.select().from(reports).all()).toHaveLength(0);
    expect(generateWeekReport(db, USER, 'nije-datum', deps)).toBeNull();
  });

  it('sprema dijagnozu pod ponedjeljkom tjedna, i kad se traži za dan usred tjedna', async () => {
    const { db, deps, closeWeek } = await setup();
    await closeWeek(WEEK, 5, 4, 4);
    const result = generateWeekReport(db, USER, day(WEEK, 3), deps);
    expect(result?.report).toMatchObject({
      period: 'week',
      periodStart: WEEK,
      promptVersion: 'local-week-v1',
      suggestion: null,
      suggestionAccepted: null,
      seenAt: null,
    });
    expect(result?.diagnosis).toMatchObject({ start: WEEK, end: '2026-11-15', trend: 'first', betterWeeks: 0 });
    expect(result?.diagnosis.progress.find((row) => row.metric === 'days')).toMatchObject({ value: 5, total: 7 });
    expect(result?.diagnosis.progress.find((row) => row.metric === 'plan')).toMatchObject({ value: 20, total: 20 });
    const stored = await getReport(db, USER, 'week', WEEK);
    expect(parseWeekDiagnosis(stored?.sections)).toEqual(result?.diagnosis);
  });

  it('uspoređuje s prošlim tjednom, broji niz boljih tjedana i rekord', async () => {
    const { db, deps, closeWeek } = await setup();
    await closeWeek('2026-10-26', 4, 1, 4);
    await closeWeek(PREVIOUS, 4, 2, 4);
    await closeWeek(WEEK, 4, 4, 4);
    const result = generateWeekReport(db, USER, WEEK, deps);
    expect(result?.diagnosis.trend).toBe('better');
    expect(result?.diagnosis.betterWeeks).toBe(2);
    expect(result?.diagnosis.praise.map((line) => line.key)).toEqual(
      expect.arrayContaining(['praise.record', 'praise.betterWeeks', 'praise.planDone']),
    );
    expect(result?.diagnosis.progress.find((row) => row.metric === 'plan')).toMatchObject({
      value: 16,
      total: 16,
      previous: 8,
      previousTotal: 16,
      change: 'up',
    });
  });

  it('dani izvan tjedna i dani bez ispunjenog upita ne ulaze', async () => {
    const { db, deps, closeDay } = await setup();
    await closeDay(day(WEEK, 0), 2, 2);
    await closeDay(day(WEEK, 7), 0, 2); // sljedeći tjedan
    const result = generateWeekReport(db, USER, WEEK, deps);
    expect(result?.diagnosis.progress.find((row) => row.metric === 'days')?.value).toBe(1);
    expect(result?.diagnosis.problems[0]?.key).toBe('problems.fewDays');
  });

  it('odgovor na prijedlog ostaje pri ponovnom generiranju, a „seenAt“ i id se čuvaju', async () => {
    const { db, deps, closeWeek } = await setup();
    await closeWeek(WEEK, 5, 1, 4);
    const first = generateWeekReport(db, USER, WEEK, deps);
    expect(first?.report.suggestion).toBe('ideas.smallerPlan');
    expect(answerReportSuggestion(db, USER, 'week', WEEK, true, deps)).toBe(true);

    const second = generateWeekReport(db, USER, WEEK, deps);
    expect(second?.report.id).toBe(first?.report.id);
    expect(second?.report.suggestionAccepted).toBe(true);
    expect(await db.select().from(reports).all()).toHaveLength(1);
  });

  it('prihvaćena promjena se prenosi u sljedeći tjedan kao već prihvaćena, s provjerom je li upalila', async () => {
    const { db, deps, closeWeek } = await setup();
    await closeWeek(WEEK, 5, 1, 4);
    generateWeekReport(db, USER, WEEK, deps);
    answerReportSuggestion(db, USER, 'week', WEEK, true, deps);

    await closeWeek(NEXT, 5, 3, 4);
    const next = generateWeekReport(db, USER, NEXT, deps);
    expect(next?.diagnosis.noticed[0]).toEqual({ key: 'followUp.plan.worked' });
    expect(next?.diagnosis.ideas).toEqual([{ key: 'ideas.stay.plan' }]);
    expect(next?.report).toMatchObject({ suggestion: 'ideas.smallerPlan', suggestionAccepted: true });
  });

  it('odbijeni prijedlog se sljedeći tjedan ne nudi', async () => {
    const { db, deps, closeWeek } = await setup();
    await closeWeek(WEEK, 5, 1, 4);
    generateWeekReport(db, USER, WEEK, deps);
    answerReportSuggestion(db, USER, 'week', WEEK, false, deps);

    await closeWeek(NEXT, 5, 1, 4);
    const next = generateWeekReport(db, USER, NEXT, deps);
    expect(next?.diagnosis.ideas).toEqual([{ key: 'ideas.keepRhythm' }]);
    expect(next?.report.suggestion).toBeNull();
    expect(next?.report.suggestionAccepted).toBeNull();
  });

  it('dijagnoze su po korisniku', async () => {
    const { db, deps, closeWeek } = await setup();
    await closeWeek(WEEK, 4, 4, 4);
    generateWeekReport(db, USER, WEEK, deps);
    expect(await getReport(db, 'drugi', 'week', WEEK)).toBeNull();
    expect(generateWeekReport(db, 'drugi', WEEK, deps)).toBeNull();
  });
});

describe('answerReportSuggestion', () => {
  it('ne mijenja dijagnozu bez prijedloga ni nepostojeću', async () => {
    const { db, deps, closeWeek } = await setup();
    expect(answerReportSuggestion(db, USER, 'week', WEEK, true, deps)).toBe(false);
    await closeWeek(WEEK, 5, 4, 4);
    generateWeekReport(db, USER, WEEK, deps);
    expect(answerReportSuggestion(db, USER, 'week', WEEK, true, deps)).toBe(false);
    expect((await getReport(db, USER, 'week', WEEK))?.suggestionAccepted).toBeNull();
  });

  it('zapisuje odgovor i pomiče updatedAt (da ga sync prenese)', async () => {
    const { db, deps, closeWeek } = await setup();
    await closeWeek(WEEK, 5, 1, 4);
    const before = generateWeekReport(db, USER, WEEK, deps)?.report;
    expect(answerReportSuggestion(db, USER, 'week', WEEK, false, deps)).toBe(true);
    const after = await getReport(db, USER, 'week', WEEK);
    expect(after?.suggestionAccepted).toBe(false);
    expect((after?.updatedAt ?? '') > (before?.updatedAt ?? '')).toBe(true);
  });
});
