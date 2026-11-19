/**
 * @jest-environment node
 */
import { describe, expect, it } from '@jest/globals';
import { ZodError } from 'zod';

import { xpEventSchema } from '@/core/domain';

import {
  QuestLimitError,
  createQuest,
  deleteQuest,
  listQuests,
  listXpEvents,
  setQuestMilestoneDone,
  setQuestStatus,
  updateQuest,
} from './repos';
import { xpEvents } from './schema';
import { readQueue } from './sync';
import { createTestDb, testDeps } from './testing/test-db';

const USER = 'user-1';
const input = {
  title: 'Polumaraton',
  why: 'Zdravlje i upornost',
  targetDate: '2027-04-12',
  milestones: [{ title: '5 km bez stajanja' }, { title: '10 km' }, { title: '15 km' }],
};

async function setup() {
  const { db } = await createTestDb();
  return { db, deps: testDeps('2026-11-17T10:00:00.000Z') };
}

/** XP koji je quest dao prije koraka 34c (stari zapisi u bazi). */
function legacyXp(db: Parameters<typeof listXpEvents>[0], id: string, sourceId: string, amount: number) {
  db.insert(xpEvents)
    .values(
      xpEventSchema.parse({
        id,
        userId: USER,
        createdAt: '2026-11-17T10:00:00.000Z',
        updatedAt: '2026-11-17T10:00:00.000Z',
        date: '2026-11-17',
        source: 'quest',
        sourceId,
        amount,
      }),
    )
    .run();
}

const questXp = async (db: Parameters<typeof listXpEvents>[0]) =>
  (await listXpEvents(db, USER)).filter((event) => event.source === 'quest');

describe('epski questovi (repo)', () => {
  it('stvara quest u tijeku s etapama i bilježi ga za sync', async () => {
    const { db, deps } = await setup();
    const quest = createQuest(db, USER, input, deps);
    expect(quest).toMatchObject({ status: 'active', doneOn: null, title: 'Polumaraton' });
    expect(quest.milestones).toHaveLength(3);
    expect(quest.milestones.every((milestone) => milestone.doneOn === null)).toBe(true);
    expect(listQuests(db, USER)).toEqual([quest]);
    expect(readQueue(db)).toEqual([expect.objectContaining({ tableName: 'quests', rowId: quest.id, op: 'upsert' })]);
  });

  it('neispravan ulaz ne zapisuje ništa', async () => {
    const { db, deps } = await setup();
    expect(() => createQuest(db, USER, { ...input, title: '  ' }, deps)).toThrow(ZodError);
    expect(listQuests(db, USER)).toEqual([]);
  });

  it('najviše 3 u tijeku; ostvaren ne broji; povratak u tijek poštuje granicu', async () => {
    const { db, deps } = await setup();
    const a = createQuest(db, USER, input, deps);
    createQuest(db, USER, input, deps);
    createQuest(db, USER, input, deps);
    expect(() => createQuest(db, USER, input, deps)).toThrow(QuestLimitError);
    setQuestStatus(db, USER, a.id, 'done', '2026-11-17', deps);
    const d = createQuest(db, USER, input, deps);
    expect(d.status).toBe('active');
    expect(() => setQuestStatus(db, USER, a.id, 'active', '2026-11-17', deps)).toThrow(QuestLimitError);
  });

  it('korak 34c: etape i ostvarenje ne daju XP; dan ostvarenja ostaje kao bedž', async () => {
    const { db, deps } = await setup();
    const quest = createQuest(db, USER, input, deps);
    const first = quest.milestones[0].id;
    setQuestMilestoneDone(db, USER, quest.id, first, true, '2026-11-17', deps);
    setQuestMilestoneDone(db, USER, quest.id, first, true, '2026-11-18', deps);
    const done = setQuestStatus(db, USER, quest.id, 'done', '2026-11-20', deps);
    expect(done).toMatchObject({ status: 'done', doneOn: '2026-11-20' });
    expect(done?.milestones[0].doneOn).toBe('2026-11-17');
    expect(await questXp(db)).toEqual([]);

    const archived = setQuestStatus(db, USER, quest.id, 'archived', '2026-11-21', deps);
    expect(archived).toMatchObject({ status: 'archived', doneOn: '2026-11-20' });
    const reopened = setQuestStatus(db, USER, quest.id, 'active', '2026-11-21', deps);
    expect(reopened).toMatchObject({ status: 'active', doneOn: null });
    expect(await questXp(db)).toEqual([]);
  });

  it('korak 34c: XP dodijeljen prije ostaje — poništenje, uređivanje, povratak u tijek i brisanje ga ne diraju', async () => {
    const { db, deps } = await setup();
    const quest = createQuest(db, USER, input, deps);
    const [a, b] = quest.milestones;
    setQuestMilestoneDone(db, USER, quest.id, a.id, true, '2026-11-17', deps);
    setQuestMilestoneDone(db, USER, quest.id, b.id, true, '2026-11-17', deps);
    setQuestStatus(db, USER, quest.id, 'done', '2026-11-17', deps);
    legacyXp(db, 'xp-a', a.id, 15);
    legacyXp(db, 'xp-b', b.id, 15);
    legacyXp(db, 'xp-q', quest.id, 100);
    const ids = async () => (await questXp(db)).map((event) => event.id).sort();
    expect(await ids()).toEqual(['xp-a', 'xp-b', 'xp-q']);

    setQuestStatus(db, USER, quest.id, 'active', '2026-11-18', deps);
    setQuestMilestoneDone(db, USER, quest.id, a.id, false, '2026-11-18', deps);
    updateQuest(db, USER, quest.id, { ...input, milestones: [{ id: a.id, title: '5 km' }] }, deps);
    expect(await ids()).toEqual(['xp-a', 'xp-b', 'xp-q']);

    expect(deleteQuest(db, USER, quest.id)).toBe(true);
    expect(await ids()).toEqual(['xp-a', 'xp-b', 'xp-q']);
  });

  it('uređivanje čuva ostvarene etape; nova etapa dobiva id', async () => {
    const { db, deps } = await setup();
    const quest = createQuest(db, USER, input, deps);
    const [a, b] = quest.milestones;
    setQuestMilestoneDone(db, USER, quest.id, a.id, true, '2026-11-17', deps);
    setQuestMilestoneDone(db, USER, quest.id, b.id, true, '2026-11-17', deps);

    const updated = updateQuest(
      db,
      USER,
      quest.id,
      { ...input, title: 'Maraton', milestones: [{ id: a.id, title: '5 km' }, { title: 'Novo' }] },
      deps,
    );
    expect(updated?.title).toBe('Maraton');
    expect(updated?.milestones).toEqual([
      { id: a.id, title: '5 km', doneOn: '2026-11-17' },
      { id: expect.any(String), title: 'Novo', doneOn: null },
    ]);
    expect(updated?.milestones[1].id).not.toBe(b.id);
  });

  it('nepostojeći quest → null; brisanje questa', async () => {
    const { db, deps } = await setup();
    expect(setQuestStatus(db, USER, 'nema', 'done', '2026-11-17', deps)).toBeNull();
    const quest = createQuest(db, USER, input, deps);
    setQuestMilestoneDone(db, USER, quest.id, quest.milestones[0].id, true, '2026-11-17', deps);
    expect(deleteQuest(db, USER, quest.id)).toBe(true);
    expect(listQuests(db, USER)).toEqual([]);
    expect(deleteQuest(db, USER, quest.id)).toBe(false);
  });

  it('drugi korisnik ne vidi ni ne mijenja quest', async () => {
    const { db, deps } = await setup();
    const quest = createQuest(db, USER, input, deps);
    expect(listQuests(db, 'other')).toEqual([]);
    expect(setQuestStatus(db, 'other', quest.id, 'done', '2026-11-17', deps)).toBeNull();
    expect(deleteQuest(db, 'other', quest.id)).toBe(false);
  });
});
