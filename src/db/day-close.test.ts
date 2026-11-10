/**
 * @jest-environment node
 */
import { describe, expect, it } from '@jest/globals';

import type { EveningDraft } from '@/core/checkin';
import { mainStreak } from '@/core/gamification';

import {
  createBlock,
  generateDayReport,
  getEveningCheckin,
  getReport,
  giveUpDay,
  listBlocksForDate,
  listEveningCheckins,
  listXpEvents,
  markReportSeen,
  saveEveningCheckin,
  setBlockStatus,
} from './repos';
import { createTestDb, testDeps } from './testing/test-db';

const USER = 'user-1';
const YESTERDAY = '2026-11-09';
const DATE = '2026-11-10';

async function setup() {
  const { db } = await createTestDb();
  const deps = testDeps('2026-11-10T15:00:00.000Z');
  const block = (date: string, title: string, start: string, end: string, kind: 'task' | 'sleep' = 'task') =>
    createBlock(db, USER, { date, title, start, end, taskId: null, kind, source: 'user', status: 'planned' }, deps);
  return { db, deps, block };
}

const ratedDraft = (date: string, items: EveningDraft['items']): EveningDraft => ({
  date,
  items,
  rules: [],
  rating: 3,
  note: '',
});

describe('giveUpDay', () => {
  it('zatvara neriješene blokove bez XP-a, čuva odrađene i bilježi što se dogodilo', async () => {
    const { db, deps, block } = await setup();
    const done = await block(DATE, 'Učenje', '09:00', '10:00');
    const open = await block(DATE, 'Trening', '18:00', '19:00');
    const later = await block(DATE, 'Čitanje', '20:00', '21:00');
    const sleep = await block(DATE, 'San', '23:00', '07:00', 'sleep');
    setBlockStatus(db, USER, done.id, 'done', deps);

    const result = giveUpDay(db, USER, DATE, '  Bolestan, nemam snage  ', deps);
    expect(result.closedBlocks).toBe(2);
    expect(result.checkin).toMatchObject({ kind: 'evening', gaveUp: true, gaveUpNote: 'Bolestan, nemam snage', dayRating: null });

    const statuses = Object.fromEntries((await listBlocksForDate(db, USER, DATE)).map((b) => [b.id, b.status]));
    expect(statuses).toEqual({ [done.id]: 'done', [open.id]: 'skipped', [later.id]: 'skipped', [sleep.id]: 'planned' });
    // XP samo za odrađeni blok.
    const xp = (await listXpEvents(db, USER)).filter((event) => event.date === DATE);
    expect(xp.map((event) => event.sourceId)).toEqual([done.id]);
  });

  it('ne ruši streak: dan s odustajanjem se računa', async () => {
    const { db, deps, block } = await setup();
    const y = await block(YESTERDAY, 'Učenje', '09:00', '10:00');
    saveEveningCheckin(db, USER, ratedDraft(YESTERDAY, [{ blockId: y.id, outcome: 'ok', comment: '', later: null, laterDate: null }]), deps);
    await block(DATE, 'Trening', '18:00', '19:00');
    giveUpDay(db, USER, DATE, '', deps);

    const streak = mainStreak(await listEveningCheckins(db, USER), DATE);
    expect(streak).toMatchObject({ current: 2, doneToday: true });
  });

  it('kasnije ispunjen upit zadržava odustajanje i bilješku', async () => {
    const { db, deps, block } = await setup();
    const open = await block(DATE, 'Trening', '18:00', '19:00');
    giveUpDay(db, USER, DATE, 'Iskrslo putovanje', deps);
    saveEveningCheckin(
      db,
      USER,
      ratedDraft(DATE, [{ blockId: open.id, outcome: 'not', comment: '', later: 'skip', laterDate: null }]),
      deps,
    );
    const saved = await getEveningCheckin(db, USER, DATE);
    expect(saved?.checkin).toMatchObject({ gaveUp: true, gaveUpNote: 'Iskrslo putovanje', dayRating: 3 });
  });

  it('dijagnoza navodi odustajanje s kontekstom, bez osude', async () => {
    const { db, deps, block } = await setup();
    await block(DATE, 'Trening', '18:00', '19:00');
    giveUpDay(db, USER, DATE, 'Glavobolja', deps);
    const { diagnosis } = generateDayReport(db, USER, DATE, deps);
    expect(diagnosis.noticed[0]).toEqual({ key: 'noticed.gaveUp', params: { note: 'Glavobolja' } });
    expect(diagnosis.praise).toContainEqual({ key: 'praise.gaveUpHonest' });
  });
});

describe('markReportSeen', () => {
  it('označi dijagnozu pokupljenom jednom; ponovno generiranje to čuva', async () => {
    const { db, deps, block } = await setup();
    const a = await block(DATE, 'Učenje', '09:00', '10:00');
    setBlockStatus(db, USER, a.id, 'done', deps);

    expect(markReportSeen(db, USER, 'day', DATE, deps)).toBe(false);
    generateDayReport(db, USER, DATE, deps);
    expect((await getReport(db, USER, 'day', DATE))?.seenAt).toBeNull();

    expect(markReportSeen(db, USER, 'day', DATE, deps)).toBe(true);
    const first = (await getReport(db, USER, 'day', DATE))?.seenAt;
    expect(first).not.toBeNull();
    markReportSeen(db, USER, 'day', DATE, deps);
    generateDayReport(db, USER, DATE, deps);
    expect((await getReport(db, USER, 'day', DATE))?.seenAt).toBe(first);
  });
});
