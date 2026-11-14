/**
 * @jest-environment node
 */
import { describe, expect, it } from '@jest/globals';
import { eq } from 'drizzle-orm';

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
  type RuleInput,
} from './repos';
import { reports } from './schema';
import { createTestDb, testDeps } from './testing/test-db';

const USER = 'user-1';
const W1 = '2026-10-26'; // ponedjeljci
const W2 = '2026-11-02';
const W3 = '2026-11-09';
const W4 = '2026-11-16';

const day = (start: string, offset: number) => addDays(start, offset) ?? start;

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

async function setup() {
  const { db } = await createTestDb();
  const deps = testDeps('2026-11-20T19:00:00.000Z');
  const rule = await createRule(db, USER, ruleInput, deps);
  await saveSettings(db, USER, { ...toSettingsInput(createDefaultDraft('hr')), scoreRules: true, scoreSleep: false }, deps);
  /** Zaključen dan: `done` od `total` blokova odrađeno, zabrana poštovana ili prekršena (okidač „stres“). */
  const closeDay = async (date: string, done: number, total: number, kept = true, user = USER) => {
    const items: ChecklistAnswer[] = [];
    for (let index = 0; index < total; index += 1) {
      const hour = String(8 + index).padStart(2, '0');
      const block = await createBlock(
        db,
        user,
        {
          date,
          title: `Blok ${index + 1}`,
          start: `${hour}:00`,
          end: `${hour}:45`,
          taskId: null,
          kind: 'task',
          source: 'user',
          status: 'planned',
        },
        deps,
      );
      items.push(ans(block.id, index < done ? 'ok' : 'not'));
    }
    const draft: EveningDraft = {
      date,
      items,
      rules: user === USER ? [{ ruleId: rule.id, kept, trigger: kept ? '' : 'stres' }] : [],
      rating: 3,
      note: '',
    };
    saveEveningCheckin(db, user, draft, deps);
  };
  /** Cijeli tjedan (`days` dana od ponedjeljka) s istim omjerom plana. */
  const closeWeek = async (start: string, days: number, done: number, total: number, kept = true) => {
    for (let offset = 0; offset < days; offset += 1) await closeDay(day(start, offset), done, total, kept);
  };
  return { db, deps, closeDay, closeWeek };
}

describe('reports repo — tjedna dijagnoza', () => {
  it('nije dostupna dok tjedan traje, osim nedjeljom nakon večernjeg upita', async () => {
    const { db, deps, closeDay, closeWeek } = await setup();
    await closeWeek(W3, 5, 2, 2);
    expect(generateWeekReport(db, USER, W3, day(W3, 4), deps)).toBeNull();
    expect(generateWeekReport(db, USER, W3, day(W3, 6), deps)).toBeNull(); // nedjelja bez upita
    await closeDay(day(W3, 6), 2, 2);
    expect(generateWeekReport(db, USER, W3, day(W3, 6), deps)?.diagnosis.start).toBe(W3);
    expect(await db.select().from(reports).where(eq(reports.period, 'week')).all()).toHaveLength(1);
  });

  it('prošli tjedan bez ijednog zaključenog dana nema dijagnozu; `start` mora biti ponedjeljak', async () => {
    const { db, deps, closeWeek } = await setup();
    await closeWeek(W2, 5, 2, 2);
    expect(generateWeekReport(db, USER, W3, W4, deps)).toBeNull();
    expect(generateWeekReport(db, USER, day(W2, 1), W4, deps)).toBeNull();
    expect(await getReport(db, USER, 'week', W3)).toBeNull();
  });

  it('prvi tjedan: sprema dijagnozu bez usporedbe, statistiku i verziju pravila', async () => {
    const { db, deps, closeWeek } = await setup();
    await closeWeek(W2, 5, 3, 4);
    const result = generateWeekReport(db, USER, W2, W3, deps);
    expect(result?.diagnosis).toMatchObject({ start: W2, end: day(W2, 6), trend: 'first', carried: false });
    expect(result?.report).toMatchObject({
      period: 'week',
      periodStart: W2,
      promptVersion: 'local-week-v1',
      suggestionAccepted: null,
      seenAt: null,
    });
    const stored = await getReport(db, USER, 'week', W2);
    expect(parseWeekDiagnosis(stored?.sections)).toEqual(result?.diagnosis);
    expect(stored?.stats).toMatchObject({ current: { recorded: 5, plan: { total: 20, done: 15 } }, previous: null });
  });

  it('uspoređuje s prošlim tjednom i broji niz boljih tjedana zaključno s ovim', async () => {
    const { db, deps, closeWeek } = await setup();
    await closeWeek(W1, 5, 1, 4);
    await closeWeek(W2, 5, 2, 4);
    await closeWeek(W3, 5, 4, 4);
    const result = generateWeekReport(db, USER, W3, W4, deps);
    expect(result?.diagnosis.trend).toBe('better');
    expect(result?.diagnosis.betterWeeks).toBe(2);
    expect(result?.diagnosis.praise.map((line) => line.key)).toContain('praise.record');
    // Dijagnoza ranijeg tjedna gleda niz kakav je bio tada, ne današnji.
    expect(generateWeekReport(db, USER, W2, W4, deps)?.diagnosis.betterWeeks).toBe(1);
  });

  it('ponovni poziv bez promjene podataka ništa ne piše; s promjenom osvježi isti red', async () => {
    const { db, deps, closeDay, closeWeek } = await setup();
    await closeWeek(W2, 4, 1, 4);
    const first = generateWeekReport(db, USER, W2, W3, deps)?.report;
    const second = generateWeekReport(db, USER, W2, W3, deps)?.report;
    expect(second?.updatedAt).toBe(first?.updatedAt);
    await closeDay(day(W2, 5), 4, 4);
    const third = generateWeekReport(db, USER, W2, W3, deps)?.report;
    expect(third?.id).toBe(first?.id);
    expect(third?.createdAt).toBe(first?.createdAt);
    expect((third?.updatedAt ?? '') > (first?.updatedAt ?? '')).toBe(true);
    expect(await db.select().from(reports).all()).toHaveLength(1);
  });

  it('odgovor na prijedlog se sprema i preživi ponovno generiranje', async () => {
    const { db, deps, closeWeek } = await setup();
    await closeWeek(W2, 5, 1, 4, false);
    const { diagnosis } = generateWeekReport(db, USER, W2, W3, deps) ?? {};
    expect(diagnosis?.suggestion).toBe('ideas.ruleTrigger');
    expect(answerReportSuggestion(db, USER, 'week', W2, false, deps)).toBe(true);
    expect(generateWeekReport(db, USER, W2, W3, deps)?.report.suggestionAccepted).toBe(false);
    expect(answerReportSuggestion(db, USER, 'week', W3, true, deps)).toBe(false); // nema dijagnoze
  });

  it('odbijeni prijedlog se sljedeći tjedan ne nudi ponovo', async () => {
    const { db, deps, closeWeek } = await setup();
    await closeWeek(W2, 5, 4, 4, false);
    expect(generateWeekReport(db, USER, W2, W3, deps)?.diagnosis.suggestion).toBe('ideas.ruleTrigger');
    answerReportSuggestion(db, USER, 'week', W2, false, deps);
    await closeWeek(W3, 5, 4, 4, false);
    const next = generateWeekReport(db, USER, W3, W4, deps);
    expect(next?.diagnosis.suggestion).not.toBe('ideas.ruleTrigger');
  });

  it('prihvaćena promjena ostaje jedina i idući tjedan se sprema kao već prihvaćena', async () => {
    const { db, deps, closeWeek } = await setup();
    await closeWeek(W1, 5, 4, 4, false);
    generateWeekReport(db, USER, W1, W2, deps);
    answerReportSuggestion(db, USER, 'week', W1, true, deps);

    await closeWeek(W2, 5, 4, 4, true);
    const second = generateWeekReport(db, USER, W2, W3, deps);
    expect(second?.diagnosis).toMatchObject({ carried: true, suggestion: 'ideas.ruleTrigger' });
    expect(second?.diagnosis.ideas).toEqual([{ key: 'ideas.stay.rules' }]);
    expect(second?.diagnosis.noticed[0]).toEqual({ key: 'followUp.rules.worked' });
    expect(second?.report.suggestionAccepted).toBe(true);

    // Nakon dva tjedna promjena je stabilna: smije doći nova (ili „zadrži ritam“).
    await closeWeek(W3, 5, 4, 4, true);
    expect(generateWeekReport(db, USER, W3, W4, deps)?.diagnosis.carried).toBe(false);
  });

  it('dijagnoze su po korisniku', async () => {
    const { db, deps, closeWeek } = await setup();
    await closeWeek(W2, 5, 4, 4);
    generateWeekReport(db, USER, W2, W3, deps);
    expect(generateWeekReport(db, 'drugi', W2, W3, deps)).toBeNull();
    expect(await getReport(db, 'drugi', 'week', W2)).toBeNull();
    expect(answerReportSuggestion(db, 'drugi', 'week', W2, true, deps)).toBe(false);
  });
});
