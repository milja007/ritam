/**
 * @jest-environment node
 */
import { describe, expect, it } from '@jest/globals';

import type { ChecklistAnswer, EveningDraft } from '@/core/checkin';
import { mainStreak } from '@/core/gamification';

import {
  createBlock,
  createRule,
  deleteBlock,
  setBlockStatus,
  getEveningCheckin,
  IncompleteEveningCheckinError,
  listBlocksForDate,
  listEveningCheckins,
  listXpEvents,
  saveEveningCheckin,
  type RuleInput,
} from './repos';
import { checkins, ruleLogs, xpEvents } from './schema';
import { createTestDb, testDeps } from './testing/test-db';

const USER = 'user-1';
const DATE = '2026-11-09';

const ans = (
  blockId: string,
  outcome: ChecklistAnswer['outcome'],
  comment = '',
  later: Partial<Pick<ChecklistAnswer, 'later' | 'laterDate'>> = {},
): ChecklistAnswer => ({
  blockId,
  outcome,
  comment,
  later: later.later ?? (outcome === 'ok' || outcome === null ? null : 'skip'),
  laterDate: later.laterDate ?? null,
});

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
      date: DATE,
      items: [
        ans(work.id, 'ok', 'ignorira se'),
        ans(meeting.id, 'ok', ''),
        ans(gym.id, 'not', '  Umor  '),
      ],
      rules: [
        { ruleId: phone.id, kept: true, trigger: 'ignorira se' },
        { ruleId: sugar.id, kept: false, trigger: 'Rođendan' },
      ],
      rating: 4,
      note: ' Solidan dan ',
    };

    const result = saveEveningCheckin(db, USER, draft, deps);
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
      ['task', work.id, 15, DATE],
      ['checkin', result.checkin.id, 15, DATE],
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
      {
        date: DATE,
        items: [
          ans(work.id, 'ok', ''),
          ans(gym.id, 'ok', ''),
          ans(meeting.id, 'ok', ''),
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
      {
        date: DATE,
        items: [
          ans(work.id, 'ok', ''),
          ans(gym.id, 'not', 'Ipak nisam'),
          ans(meeting.id, 'ok', ''),
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
      date: DATE,
      items: [ans(work.id, 'ok', '')],
      rules: [],
      rating: 4,
      note: '',
    };
    saveEveningCheckin(db, USER, draft, deps);
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
    saveEveningCheckin(db, USER, draft, deps);
    const xp = await listXpEvents(db, USER);
    expect(xp.map((e) => e.amount).sort((a, b) => a - b)).toEqual([10, 15, 15]);
  });

  it('preskače odgovore na nepostojeće blokove i zabrane', async () => {
    const { db, deps, work } = await setup();
    const result = saveEveningCheckin(
      db,
      USER,
      {
        date: DATE,
        items: [
          ans(work.id, 'ok', ''),
          ans('obrisan', 'ok', ''),
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
        {
          date: DATE, items: [ans(work.id, null, '')], rules: [], rating: 4, note: '' },
        deps,
      ),
    ).toThrow(IncompleteEveningCheckinError);
    expect(() =>
      saveEveningCheckin(db, USER, { date: DATE, items: [], rules: [], rating: null, note: '' }, deps),
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
        {
          date: DATE, items: [ans(work.id, 'ok', '')], rules: [], rating: 4, note: '' },
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
    saveEveningCheckin(db, USER, { date: DATE, items: [], rules: [], rating: 3, note: '' }, deps);
    expect(await getEveningCheckin(db, 'user-2', DATE)).toBeNull();
    expect(await getEveningCheckin(db, USER, '2026-11-10')).toBeNull();
  });

  it('Djelomično: blok ostaje partial i daje pola XP-a (8)', async () => {
    const { db, deps, work } = await setup();
    const result = saveEveningCheckin(
      db,
      USER,
      { date: DATE, items: [ans(work.id, 'partial', 'Pola', { later: 'skip' })], rules: [], rating: 3, note: '' },
      deps,
    );
    expect(result.xpEarned).toBe(15 + 8);
    const saved = await getEveningCheckin(db, USER, DATE);
    expect(saved?.items.map((i) => [i.ok, i.outcome, i.comment, i.laterDate])).toEqual([
      [false, 'partial', 'Pola', null],
    ]);
    expect((await listBlocksForDate(db, USER, DATE)).find((b) => b.id === work.id)?.status).toBe('partial');
  });

  it('kad kasnije? sutra / drugi dan: novi planirani blok, original moved (Djelomično ostaje partial)', async () => {
    const { db, deps, work, gym } = await setup();
    saveEveningCheckin(
      db,
      USER,
      {
        date: DATE,
        items: [
          ans(gym.id, 'not', 'Umor', { later: 'tomorrow' }),
          ans(work.id, 'partial', '', { later: 'other', laterDate: '2026-11-12' }),
        ],
        rules: [],
        rating: 3,
        note: '',
      },
      deps,
    );
    const today = Object.fromEntries((await listBlocksForDate(db, USER, DATE)).map((b) => [b.title, b.status]));
    expect(today).toMatchObject({ Teretana: 'moved', Rad: 'partial' });

    const tomorrow = await listBlocksForDate(db, USER, '2026-11-10');
    expect(tomorrow.map((b) => [b.title, b.start, b.end, b.kind, b.source, b.status])).toEqual([
      ['Teretana', '18:00', '19:00', 'task', 'user', 'planned'],
    ]);
    const later = await listBlocksForDate(db, USER, '2026-11-12');
    expect(later.map((b) => b.title)).toEqual(['Rad']);

    const saved = await getEveningCheckin(db, USER, DATE);
    const gymItem = saved?.items.find((i) => i.refId === gym.id);
    expect(gymItem).toMatchObject({ outcome: 'not', laterDate: '2026-11-10', movedBlockId: tomorrow[0]?.id });
  });

  it('ponovno spremanje: premješteni blok se ne duplicira, prati novi dan, a uz preskoči nestaje', async () => {
    const { db, deps, gym } = await setup();
    const save = (later: Partial<Pick<ChecklistAnswer, 'later' | 'laterDate'>>) =>
      saveEveningCheckin(
        db,
        USER,
        { date: DATE, items: [ans(gym.id, 'not', '', later)], rules: [], rating: 3, note: '' },
        deps,
      );
    save({ later: 'tomorrow' });
    save({ later: 'tomorrow' });
    expect(await listBlocksForDate(db, USER, '2026-11-10')).toHaveLength(1);

    save({ later: 'other', laterDate: '2026-11-14' });
    expect(await listBlocksForDate(db, USER, '2026-11-10')).toHaveLength(0);
    expect(await listBlocksForDate(db, USER, '2026-11-14')).toHaveLength(1);

    save({ later: 'skip' });
    expect(await listBlocksForDate(db, USER, '2026-11-14')).toHaveLength(0);
    expect((await listBlocksForDate(db, USER, DATE)).find((b) => b.id === gym.id)?.status).toBe('skipped');
  });

  it('odrađeni premješteni blok se ne briše ni ne seli pri ponovnom spremanju', async () => {
    const { db, deps, gym } = await setup();
    const save = (later: Partial<Pick<ChecklistAnswer, 'later' | 'laterDate'>>) =>
      saveEveningCheckin(
        db,
        USER,
        { date: DATE, items: [ans(gym.id, 'not', '', later)], rules: [], rating: 3, note: '' },
        deps,
      );
    save({ later: 'tomorrow' });
    const [moved] = await listBlocksForDate(db, USER, '2026-11-10');
    if (!moved) throw new Error('moved block missing');
    setBlockStatus(db, USER, moved.id, 'done', deps);

    save({ later: 'other', laterDate: '2026-11-14' });
    expect((await listBlocksForDate(db, USER, '2026-11-10')).map((b) => b.status)).toEqual(['done']);
    expect(await listBlocksForDate(db, USER, '2026-11-14')).toHaveLength(0);
    save({ later: 'skip' });
    expect(await listBlocksForDate(db, USER, '2026-11-10')).toHaveLength(1);
  });

  it('kvačica na timelineu daje XP odmah; upit ga potvrđuje bez dupliciranja', async () => {
    const { db, deps, work, meeting } = await setup();
    setBlockStatus(db, USER, work.id, 'done', deps);
    setBlockStatus(db, USER, meeting.id, 'done', deps); // fiksna obaveza — bez XP-a
    expect((await listXpEvents(db, USER)).map((e) => [e.source, e.sourceId, e.amount])).toEqual([
      ['task', work.id, 15],
    ]);

    const result = saveEveningCheckin(
      db,
      USER,
      { date: DATE, items: [ans(work.id, 'ok'), ans(meeting.id, 'ok')], rules: [], rating: 4, note: '' },
      deps,
    );
    expect(result.xpEarned).toBe(30);
    const xp = await listXpEvents(db, USER);
    expect(xp.filter((e) => e.source === 'task')).toHaveLength(1);
    expect(xp.reduce((sum, e) => sum + e.amount, 0)).toBe(30);

    // Upit kaže Djelomično → XP zadatka se smanjuje na 8, ne dodaje.
    saveEveningCheckin(
      db,
      USER,
      { date: DATE, items: [ans(work.id, 'partial', '', { later: 'skip' })], rules: [], rating: 4, note: '' },
      deps,
    );
    expect((await listXpEvents(db, USER)).reduce((sum, e) => sum + e.amount, 0)).toBe(15 + 8);
  });

  it('jedan zapis po zabrani po danu i jedan večernji checkin po danu (jedinstveni indeksi)', async () => {
    const { db, deps, phone } = await setup();
    // Zapis iste zabrane istog dana izvan upita (npr. budući ekran zabrana) — upit ga zamjenjuje.
    await db
      .insert(ruleLogs)
      .values({
        id: 'stari-log',
        userId: USER,
        createdAt: '2026-11-09T12:00:00.000Z',
        updatedAt: '2026-11-09T12:00:00.000Z',
        ruleId: phone.id,
        date: DATE,
        kept: false,
        trigger: null,
        checkinId: null,
      })
      .run();
    saveEveningCheckin(
      db,
      USER,
      { date: DATE, items: [], rules: [{ ruleId: phone.id, kept: true, trigger: '' }], rating: 4, note: '' },
      deps,
    );
    const saved = await getEveningCheckin(db, USER, DATE);
    expect(saved?.ruleLogs.map((l) => [l.ruleId, l.kept])).toEqual([[phone.id, true]]);

    const duplicate = {
      id: 'drugi-checkin',
      userId: USER,
      createdAt: '2026-11-09T21:00:00.000Z',
      updatedAt: '2026-11-09T21:00:00.000Z',
      date: DATE,
      kind: 'evening' as const,
    };
    expect(() => db.insert(checkins).values(duplicate).run()).toThrow();
    expect(() =>
      db
        .insert(ruleLogs)
        .values({ ...duplicate, ruleId: phone.id, kept: true, trigger: null, checkinId: null })
        .run(),
    ).toThrow();
    // Jutarnji checkin istog dana je dopušten.
    expect(() => db.insert(checkins).values({ ...duplicate, kind: 'morning' }).run()).not.toThrow();
  });
});

describe('setBlockStatus / deleteBlock', () => {
  it('kvačica daje i vraća XP; brisanje bloka briše njegov XP', async () => {
    const { db, deps, work } = await setup();
    expect(setBlockStatus(db, USER, work.id, 'done', deps)?.status).toBe('done');
    setBlockStatus(db, USER, work.id, 'done', deps);
    expect((await listXpEvents(db, USER)).map((e) => e.amount)).toEqual([15]);
    setBlockStatus(db, USER, work.id, 'planned', deps);
    expect(await listXpEvents(db, USER)).toEqual([]);

    setBlockStatus(db, USER, work.id, 'done', deps);
    expect(deleteBlock(db, USER, work.id)).toBe(true);
    expect(await listXpEvents(db, USER)).toEqual([]);
    expect(setBlockStatus(db, USER, work.id, 'done', deps)).toBeNull();
  });
});

describe('listEveningCheckins', () => {
  it('samo večernji upiti korisnika, uzlazno, s ocjenom (za streak)', async () => {
    const { db, deps } = await setup();
    const iso = deps.now().toISOString();
    const stamp = { createdAt: iso, updatedAt: iso };
    const row = (id: string, userId: string, date: string, kind: 'evening' | 'morning', dayRating: number | null) => ({
      ...stamp,
      id,
      userId,
      date,
      kind,
      dayRating,
      note: null,
      mood: null,
      sleepStart: null,
      wakeTime: null,
    });
    db.insert(checkins)
      .values([
        row('c2', USER, '2026-11-09', 'evening', 4),
        row('c1', USER, '2026-11-08', 'evening', 3),
        row('m1', USER, '2026-11-09', 'morning', null),
        row('o1', 'drugi', '2026-11-07', 'evening', 5),
      ])
      .run();

    const list = await listEveningCheckins(db, USER);
    expect(list).toEqual([
      { date: '2026-11-08', kind: 'evening', dayRating: 3 },
      { date: '2026-11-09', kind: 'evening', dayRating: 4 },
    ]);
    expect(mainStreak(list, '2026-11-10')).toMatchObject({ current: 2, doneToday: false });
  });
});
