/**
 * @jest-environment node
 */
import { describe, expect, it } from '@jest/globals';

import type { EveningDraft } from '@/core/checkin';
import { mainStreak } from '@/core/gamification';

import {
  createBlock,
  createRule,
  getEveningCheckin,
  IncompleteEveningCheckinError,
  listBlocksForDate,
  listXpEvents,
  saveEveningCheckin,
  type RuleInput,
} from './repos';
import { xpEvents } from './schema';
import { createTestDb, testDeps } from './testing/test-db';

const USER = 'user-1';
const DATE = '2026-11-09';

const ruleInput = (title: string, weight: 1 | 2 | 3): RuleInput => ({
  title,
  icon: null,
  activeDays: [0, 1, 2, 3, 4, 5, 6],
  activeHours: null,
  why: '',
  weight,
});

async function setup() {
  const { db } = await createTestDb();
  const deps = testDeps('2026-11-09T19:00:00.000Z');
  const block = (title: string, start: string, end: string, kind: 'task' | 'fixed' | 'sleep' = 'task') =>
    createBlock(
      db,
      USER,
      { date: DATE, title, start, end, taskId: null, kind, source: 'user', status: 'planned' },
      deps,
    );
  const work = await block('Rad', '09:00', '11:00');
  const gym = await block('Teretana', '18:00', '19:00');
  const meeting = await block('Sastanak', '12:00', '13:00', 'fixed');
  await block('San', '23:00', '07:00', 'sleep');
  const phone = await createRule(db, USER, ruleInput('Bez mobitela', 3), deps);
  const sugar = await createRule(db, USER, ruleInput('Bez šećera', 1), deps);
  return { db, deps, work, gym, meeting, phone, sugar };
}

describe('saveEveningCheckin', () => {
  it('sprema checkin, stavke, zapise zabrana, statuse blokova i XP', async () => {
    const { db, deps, work, gym, meeting, phone, sugar } = await setup();
    const draft: EveningDraft = {
      items: [
        { blockId: work.id, ok: true, comment: 'ignorira se' },
        { blockId: meeting.id, ok: true, comment: '' },
        { blockId: gym.id, ok: false, comment: '  Umor  ' },
      ],
      rules: [
        { ruleId: phone.id, kept: true, trigger: 'ignorira se' },
        { ruleId: sugar.id, kept: false, trigger: 'Rođendan' },
      ],
      rating: 4,
      note: ' Solidan dan ',
    };

    const result = saveEveningCheckin(db, USER, DATE, draft, deps);
    // upit 15 + zadatak Rad 15 + zabrana težine 3 = 20 (sastanak je fiksan, Teretana "Nije", šećer prekršen)
    expect(result.xpEarned).toBe(50);
    expect(result.checkin).toMatchObject({ date: DATE, kind: 'evening', dayRating: 4, note: 'Solidan dan' });

    const saved = await getEveningCheckin(db, USER, DATE);
    expect(saved?.checkin).toEqual(result.checkin);
    expect(saved?.items.map((i) => [i.refId, i.kind, i.ok, i.comment])).toEqual([
      [work.id, 'task', true, null],
      [meeting.id, 'task', true, null],
      [gym.id, 'task', false, 'Umor'],
    ]);
    expect(saved?.ruleLogs.map((l) => [l.ruleId, l.date, l.kept, l.trigger, l.checkinId])).toEqual([
      [phone.id, DATE, true, null, result.checkin.id],
      [sugar.id, DATE, false, 'Rođendan', result.checkin.id],
    ]);

    const statuses = Object.fromEntries(
      (await listBlocksForDate(db, USER, DATE)).map((b) => [b.title, b.status]),
    );
    expect(statuses).toEqual({ Rad: 'done', Sastanak: 'done', Teretana: 'skipped', San: 'planned' });

    const xp = await listXpEvents(db, USER);
    expect(xp.map((e) => [e.source, e.sourceId, e.amount, e.date])).toEqual([
      ['checkin', result.checkin.id, 15, DATE],
      ['task', work.id, 15, DATE],
      ['rule', phone.id, 20, DATE],
    ]);

    // Glavni streak čita ocjenu dana iz spremljenog checkina.
    expect(mainStreak([result.checkin], DATE).current).toBe(1);
  });

  it('ponovno spremanje istog dana zamjenjuje odgovore i XP (bez dupliciranja)', async () => {
    const { db, deps, work, gym, meeting, phone, sugar } = await setup();
    const first = saveEveningCheckin(
      db,
      USER,
      DATE,
      {
        items: [
          { blockId: work.id, ok: true, comment: '' },
          { blockId: gym.id, ok: true, comment: '' },
          { blockId: meeting.id, ok: true, comment: '' },
        ],
        rules: [
          { ruleId: phone.id, kept: true, trigger: '' },
          { ruleId: sugar.id, kept: true, trigger: '' },
        ],
        rating: 5,
        note: '',
      },
      deps,
    );
    expect(first.xpEarned).toBe(15 + 15 + 15 + 20 + 5);

    const second = saveEveningCheckin(
      db,
      USER,
      DATE,
      {
        items: [
          { blockId: work.id, ok: true, comment: '' },
          { blockId: gym.id, ok: false, comment: 'Ipak nisam' },
          { blockId: meeting.id, ok: true, comment: '' },
        ],
        rules: [
          { ruleId: phone.id, kept: false, trigger: '' },
          { ruleId: sugar.id, kept: true, trigger: '' },
        ],
        rating: 3,
        note: '',
      },
      deps,
    );
    expect(second.checkin.id).toBe(first.checkin.id);
    expect(second.checkin.createdAt).toBe(first.checkin.createdAt);
    expect(second.xpEarned).toBe(15 + 15 + 5);

    const xp = await listXpEvents(db, USER);
    expect(xp.reduce((sum, e) => sum + e.amount, 0)).toBe(35);

    const saved = await getEveningCheckin(db, USER, DATE);
    expect(saved?.checkin.dayRating).toBe(3);
    expect(saved?.items).toHaveLength(3);
    expect(saved?.ruleLogs.map((l) => l.kept)).toEqual([false, true]);
    const gymNow = (await listBlocksForDate(db, USER, DATE)).find((b) => b.id === gym.id);
    expect(gymNow?.status).toBe('skipped');
  });

  it('ne dira XP drugih izvora istog dana', async () => {
    const { db, deps, work } = await setup();
    const draft: EveningDraft = {
      items: [{ blockId: work.id, ok: true, comment: '' }],
      rules: [],
      rating: 4,
      note: '',
    };
    saveEveningCheckin(db, USER, DATE, draft, deps);
    // Npr. XP za san iz jutarnje prijave (korak 14) — ručno upisan.
    await db
      .insert(xpEvents)
      .values({
        id: 'sleep-xp',
        userId: USER,
        createdAt: '2026-11-09T07:00:00.000Z',
        updatedAt: '2026-11-09T07:00:00.000Z',
        date: DATE,
        source: 'sleep',
        sourceId: null,
        amount: 10,
      })
      .run();
    saveEveningCheckin(db, USER, DATE, draft, deps);
    const xp = await listXpEvents(db, USER);
    expect(xp.map((e) => e.amount).sort((a, b) => a - b)).toEqual([10, 15, 15]);
  });

  it('preskače odgovore na nepostojeće blokove i zabrane', async () => {
    const { db, deps, work } = await setup();
    const result = saveEveningCheckin(
      db,
      USER,
      DATE,
      {
        items: [
          { blockId: work.id, ok: true, comment: '' },
          { blockId: 'obrisan', ok: true, comment: '' },
        ],
        rules: [{ ruleId: 'nema', kept: true, trigger: '' }],
        rating: 2,
        note: '',
      },
      deps,
    );
    expect(result.xpEarned).toBe(30);
    const saved = await getEveningCheckin(db, USER, DATE);
    expect(saved?.items.map((i) => i.refId)).toEqual([work.id]);
    expect(saved?.ruleLogs).toEqual([]);
  });

  it('odbija nepotpun nacrt i ništa ne piše', async () => {
    const { db, deps, work } = await setup();
    expect(() =>
      saveEveningCheckin(
        db,
        USER,
        DATE,
        { items: [{ blockId: work.id, ok: null, comment: '' }], rules: [], rating: 4, note: '' },
        deps,
      ),
    ).toThrow(IncompleteEveningCheckinError);
    expect(() =>
      saveEveningCheckin(db, USER, DATE, { items: [], rules: [], rating: null, note: '' }, deps),
    ).toThrow(IncompleteEveningCheckinError);
    expect(await getEveningCheckin(db, USER, DATE)).toBeNull();
    expect(await listXpEvents(db, USER)).toEqual([]);
  });

  it('je sve ili ništa: greška usred transakcije ne ostavlja ništa', async () => {
    const { db, work } = await setup();
    const clashing = { newId: () => 'isti-id', now: () => new Date('2026-11-09T20:00:00.000Z') };
    expect(() =>
      saveEveningCheckin(
        db,
        USER,
        DATE,
        { items: [{ blockId: work.id, ok: true, comment: '' }], rules: [], rating: 4, note: '' },
        clashing,
      ),
    ).toThrow();
    expect(await getEveningCheckin(db, USER, DATE)).toBeNull();
    expect(await listXpEvents(db, USER)).toEqual([]);
    const workNow = (await listBlocksForDate(db, USER, DATE)).find((b) => b.id === work.id);
    expect(workNow?.status).toBe('planned');
  });

  it('upit je po korisniku i danu', async () => {
    const { db, deps } = await setup();
    saveEveningCheckin(db, USER, DATE, { items: [], rules: [], rating: 3, note: '' }, deps);
    expect(await getEveningCheckin(db, 'user-2', DATE)).toBeNull();
    expect(await getEveningCheckin(db, USER, '2026-11-10')).toBeNull();
  });
});
