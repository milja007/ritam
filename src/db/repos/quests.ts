import { and, eq, inArray } from 'drizzle-orm';

import { questSchema, xpEventSchema, type Quest, type QuestMilestone, type QuestStatus } from '@/core/domain';
import { canStartQuest, questXpAwards, sortQuests } from '@/core/gamification';

import type { RitamDb } from '../db';
import { quests, xpEvents } from '../schema';
import type { RitamTx } from './block-xp';
import { defaultRepoDeps, type RepoDeps } from './deps';

/** Ograničenje broja questova u tijeku (`MAX_ACTIVE_QUESTS`) — UI ga javlja korisniku. */
export class QuestLimitError extends Error {
  constructor() {
    super('Too many active quests');
    this.name = 'QuestLimitError';
  }
}

/** Etapa iz uređivača: postojeća zadržava id (i dan ostvarenja), nova ga nema. */
export type QuestMilestoneInput = { id?: string; title: string };

/** Polja questa koja korisnik uređuje. */
export type QuestInput = {
  title: string;
  why: string;
  targetDate: string | null;
  milestones: readonly QuestMilestoneInput[];
};

function parseRow(row: typeof quests.$inferSelect): Quest {
  return questSchema.parse(row);
}

function readQuest(tx: RitamTx | RitamDb, userId: string, id: string): Quest | null {
  const row = tx
    .select()
    .from(quests)
    .where(and(eq(quests.userId, userId), eq(quests.id, id)))
    .get();
  return row ? parseRow(row) : null;
}

function readAll(tx: RitamTx | RitamDb, userId: string): Quest[] {
  return tx.select().from(quests).where(eq(quests.userId, userId)).all().map(parseRow);
}

function milestonesFrom(input: readonly QuestMilestoneInput[], previous: readonly QuestMilestone[], deps: RepoDeps) {
  const byId = new Map(previous.map((milestone) => [milestone.id, milestone]));
  return input.map((item) => {
    const existing = item.id !== undefined ? byId.get(item.id) : undefined;
    return {
      id: existing?.id ?? deps.newId(),
      title: item.title,
      doneOn: existing?.doneOn ?? null,
    };
  });
}

/**
 * Uskladi XP questa s njegovim stanjem (etape s danom ostvarenja + ostvaren quest). Briše XP
 * etapa kojih više nema ili nisu ostvarene, dodaje nedostajući; ispravan XP ostaje netaknut
 * (bez nepotrebnih upisa za sync). `source = 'quest'` + `sourceId` = etapa ili quest.
 * `previousIds` su id-jevi etapa prije promjene (uklonjena ostvarena etapa gubi svoj XP).
 */
export function syncQuestXp(
  tx: RitamTx,
  quest: Pick<Quest, 'id' | 'userId' | 'milestones' | 'doneOn'>,
  previousIds: readonly string[],
  deps: RepoDeps,
): void {
  const ids = [...new Set([quest.id, ...previousIds, ...quest.milestones.map((milestone) => milestone.id)])];
  const existing = tx
    .select()
    .from(xpEvents)
    .where(and(eq(xpEvents.userId, quest.userId), eq(xpEvents.source, 'quest'), inArray(xpEvents.sourceId, ids)))
    .all();
  const wanted = questXpAwards(quest);
  const keep = new Set<string>();
  for (const award of wanted) {
    const match = existing.find(
      (event) =>
        !keep.has(event.id) &&
        event.sourceId === award.sourceId &&
        event.date === award.date &&
        event.amount === award.amount,
    );
    if (match) {
      keep.add(match.id);
      continue;
    }
    const now = deps.now().toISOString();
    tx.insert(xpEvents)
      .values(
        xpEventSchema.parse({
          id: deps.newId(),
          userId: quest.userId,
          createdAt: now,
          updatedAt: now,
          date: award.date,
          source: 'quest',
          sourceId: award.sourceId,
          amount: award.amount,
        }),
      )
      .run();
  }
  const stale = existing.filter((event) => !keep.has(event.id)).map((event) => event.id);
  if (stale.length > 0) tx.delete(xpEvents).where(inArray(xpEvents.id, stale)).run();
}

function save(tx: RitamTx, previous: Quest, next: Quest, deps: RepoDeps): Quest {
  const { id: _id, userId: _owner, createdAt: _created, ...changes } = next;
  tx.update(quests)
    .set(changes)
    .where(and(eq(quests.userId, next.userId), eq(quests.id, next.id)))
    .run();
  syncQuestXp(
    tx,
    next,
    previous.milestones.map((milestone) => milestone.id),
    deps,
  );
  return next;
}

/** Questovi korisnika redom za Profil (`sortQuests`). */
export function listQuests(db: RitamDb, userId: string): Quest[] {
  return sortQuests(readAll(db, userId));
}

/**
 * Novi epski quest u tijeku. Najviše `MAX_ACTIVE_QUESTS` u tijeku → `QuestLimitError`.
 * Neispravan ulaz baca `ZodError`; ništa se ne zapisuje.
 */
export function createQuest(db: RitamDb, userId: string, input: QuestInput, deps: RepoDeps = defaultRepoDeps): Quest {
  return db.transaction((tx) => {
    if (!canStartQuest(readAll(tx, userId))) throw new QuestLimitError();
    const now = deps.now().toISOString();
    const quest = questSchema.parse({
      id: deps.newId(),
      userId,
      createdAt: now,
      updatedAt: now,
      title: input.title,
      why: input.why,
      targetDate: input.targetDate,
      milestones: milestonesFrom(input.milestones, [], deps),
      status: 'active',
      doneOn: null,
    });
    tx.insert(quests).values(quest).run();
    return quest;
  });
}

function change(
  db: RitamDb,
  userId: string,
  id: string,
  deps: RepoDeps,
  apply: (quest: Quest, tx: RitamTx) => Omit<Quest, 'updatedAt'>,
): Quest | null {
  return db.transaction((tx) => {
    const previous = readQuest(tx, userId, id);
    if (previous === null) return null;
    const next = questSchema.parse({ ...apply(previous, tx), updatedAt: deps.now().toISOString() });
    return save(tx, previous, next, deps);
  });
}

/** Uredi naslov, razlog, rok i etape (postojeće etape zadržavaju dan ostvarenja). */
export function updateQuest(
  db: RitamDb,
  userId: string,
  id: string,
  input: QuestInput,
  deps: RepoDeps = defaultRepoDeps,
): Quest | null {
  return change(db, userId, id, deps, (quest) => ({
    ...quest,
    title: input.title,
    why: input.why,
    targetDate: input.targetDate,
    milestones: milestonesFrom(input.milestones, quest.milestones, deps),
  }));
}

/** Označi etapu ostvarenom (`today`) ili poništi oznaku. */
export function setQuestMilestoneDone(
  db: RitamDb,
  userId: string,
  id: string,
  milestoneId: string,
  done: boolean,
  today: string,
  deps: RepoDeps = defaultRepoDeps,
): Quest | null {
  return change(db, userId, id, deps, (quest) => ({
    ...quest,
    milestones: quest.milestones.map((milestone) =>
      milestone.id !== milestoneId
        ? milestone
        : { ...milestone, doneOn: done ? (milestone.doneOn ?? today) : null },
    ),
  }));
}

/**
 * Promijeni stanje questa: `done` (ostvaren danas), `active` (ponovo u tijeku) ili `archived`
 * (spremljen sa strane; ostvaren quest u arhivi čuva dan i XP). Povratak u tijek poštuje
 * `MAX_ACTIVE_QUESTS` (`QuestLimitError`) i uklanja XP ostvarenja; XP etapa ostaje.
 */
export function setQuestStatus(
  db: RitamDb,
  userId: string,
  id: string,
  status: QuestStatus,
  today: string,
  deps: RepoDeps = defaultRepoDeps,
): Quest | null {
  return change(db, userId, id, deps, (quest, tx) => {
    if (status === 'active' && quest.status !== 'active' && !canStartQuest(readAll(tx, userId))) {
      throw new QuestLimitError();
    }
    const doneOn = status === 'done' ? (quest.doneOn ?? today) : status === 'active' ? null : quest.doneOn;
    return { ...quest, status, doneOn };
  });
}

/** Obriši quest i njegov XP. */
export function deleteQuest(db: RitamDb, userId: string, id: string): boolean {
  return db.transaction((tx) => {
    const quest = readQuest(tx, userId, id);
    if (quest === null) return false;
    const ids = [quest.id, ...quest.milestones.map((milestone) => milestone.id)];
    tx.delete(xpEvents)
      .where(and(eq(xpEvents.userId, userId), eq(xpEvents.source, 'quest'), inArray(xpEvents.sourceId, ids)))
      .run();
    tx.delete(quests).where(and(eq(quests.userId, userId), eq(quests.id, id))).run();
    return true;
  });
}
