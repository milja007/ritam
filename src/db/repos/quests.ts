import { and, eq } from 'drizzle-orm';

import { questSchema, type Quest, type QuestMilestone, type QuestStatus } from '@/core/domain';
import { canStartQuest, sortQuests } from '@/core/gamification';

import type { RitamDb } from '../db';
import { quests } from '../schema';
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
 * Spremi promjenu questa. Korak 34c (odluka 92): questovi više ne daju XP, a XP koji su dali
 * prije ostaje u `xp_events` netaknut — ni poništena etapa ni povratak u tijek ga ne brišu.
 */
function save(tx: RitamTx, next: Quest): Quest {
  const { id: _id, userId: _owner, createdAt: _created, ...changes } = next;
  tx.update(quests)
    .set(changes)
    .where(and(eq(quests.userId, next.userId), eq(quests.id, next.id)))
    .run();
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
    return save(tx, next);
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
 * (spremljen sa strane; ostvaren quest u arhivi čuva dan i bedž). Povratak u tijek poštuje
 * `MAX_ACTIVE_QUESTS` (`QuestLimitError`) i skida bedž (dan ostvarenja).
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

/** Obriši quest. XP koji je quest dao prije koraka 34c ostaje (bez kazni). */
export function deleteQuest(db: RitamDb, userId: string, id: string): boolean {
  return db.transaction((tx) => {
    if (readQuest(tx, userId, id) === null) return false;
    tx.delete(quests).where(and(eq(quests.userId, userId), eq(quests.id, id))).run();
    return true;
  });
}
