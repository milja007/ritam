import { and, asc, eq, inArray, or } from 'drizzle-orm';

import {
  blockStatusAfterCheckin,
  cleanText,
  eveningXpAwards,
  isEveningDraftComplete,
  isMorningDraftValid,
  morningXpAwards,
  movedBlockFields,
  resolveLaterDate,
  sumAwards,
  type EveningDraft,
  type MorningDraft,
  type MorningSleepSettings,
  type SavedEveningCheckin,
} from '@/core/checkin';
import {
  checkinItemSchema,
  checkinSchema,
  ruleLogSchema,
  ruleSchema,
  scheduleBlockSchema,
  xpEventSchema,
  type Checkin,
  type LocalDate,
  selectedScoreAreas,
  settingsSchema,
} from '@/core/domain';

import type { RitamDb } from '../db';
import { checkinItems, checkins, ruleLogs, rules, scheduleBlocks, settings, xpEvents } from '../schema';
import { syncBlockTaskXp } from './block-xp';
import { defaultRepoDeps, type RepoDeps } from './deps';

export class IncompleteEveningCheckinError extends Error {
  constructor() {
    super('Evening check-in draft is incomplete');
    this.name = 'IncompleteEveningCheckinError';
  }
}

const eveningOf = (userId: string, date: LocalDate) =>
  and(eq(checkins.userId, userId), eq(checkins.date, date), eq(checkins.kind, 'evening'));

/** Večernji upit zadanog dana sa stavkama i zapisima zabrana, ili `null` ako još nije spremljen. */
export async function getEveningCheckin(
  db: RitamDb,
  userId: string,
  date: LocalDate,
): Promise<SavedEveningCheckin | null> {
  const row = await db.select().from(checkins).where(eveningOf(userId, date)).get();
  if (!row) return null;
  const checkin = checkinSchema.parse(row);
  const items = await db
    .select()
    .from(checkinItems)
    .where(and(eq(checkinItems.userId, userId), eq(checkinItems.checkinId, checkin.id)))
    .all();
  const logs = await db
    .select()
    .from(ruleLogs)
    .where(and(eq(ruleLogs.userId, userId), eq(ruleLogs.checkinId, checkin.id)))
    .all();
  return {
    checkin,
    items: items.map((item) => checkinItemSchema.parse(item)),
    ruleLogs: logs.map((log) => ruleLogSchema.parse(log)),
  };
}

export type SavedEveningResult = { checkin: Checkin; xpEarned: number };

/**
 * Sprema večernji upit dana `draft.date` u jednoj transakciji (sve ili ništa): checkin (jedan
 * večernji po danu), stavke checkliste (`checkin_items`), zapise zabrana (`rule_logs`, jedan po
 * zabrani po danu), statuse blokova, premještene blokove ("kad kasnije?") i XP (`xp_events`).
 * XP zadataka ide preko statusa bloka (`syncBlockTaskXp`) — isti put kao kvačica na timelineu,
 * pa se ne duplicira. Ponovno spremanje istog dana zamjenjuje stavke, zapise i XP tog upita;
 * premješteni blok se ponovo koristi (ili obriše ako više ne treba, dok je još neodrađen).
 * Odgovori na blokove/zabrane kojih (više) nema se preskaču.
 */
export function saveEveningCheckin(
  db: RitamDb,
  userId: string,
  draft: EveningDraft,
  deps: RepoDeps = defaultRepoDeps,
): SavedEveningResult {
  if (!isEveningDraftComplete(draft)) throw new IncompleteEveningCheckinError();
  const { date } = draft;
  const now = deps.now().toISOString();
  const stamp = { userId, createdAt: now, updatedAt: now };

  // Drizzle expo-sqlite driver je sinkron: callback transakcije mora biti sinkron.
  return db.transaction((tx) => {
    const dayBlocks = tx
      .select()
      .from(scheduleBlocks)
      .where(and(eq(scheduleBlocks.userId, userId), eq(scheduleBlocks.date, date)))
      .all()
      .map((row) => scheduleBlockSchema.parse(row));
    const userRules = tx
      .select()
      .from(rules)
      .where(eq(rules.userId, userId))
      .all()
      .map((row) => ruleSchema.parse(row));
    const blocksById = new Map(dayBlocks.map((block) => [block.id, block]));
    const ruleIds = new Set(userRules.map((rule) => rule.id));
    const answeredItems = draft.items.filter((item) => blocksById.has(item.blockId));
    const answeredRules = draft.rules.filter((answer) => ruleIds.has(answer.ruleId));

    // Checkin: novi ili ažuriranje postojećeg (isti id, stavke/zapisi/XP se zamjenjuju).
    const existing = tx.select().from(checkins).where(eveningOf(userId, date)).get();
    // Snimka područja rezultata (P48): prvo spremanje upita zaključuje dan s trenutnim odabirom;
    // kasnije uređivanje upita zadržava snimku tog dana.
    const settingsRow = tx.select().from(settings).where(eq(settings.userId, userId)).get();
    const scoreAreas =
      existing?.scoreAreas ?? (settingsRow ? selectedScoreAreas(settingsSchema.parse(settingsRow)) : ['plan']);
    const checkin = checkinSchema.parse({
      id: existing?.id ?? deps.newId(),
      userId,
      createdAt: existing?.createdAt ?? now,
      updatedAt: now,
      date,
      kind: 'evening',
      sleepStart: existing?.sleepStart ?? null,
      wakeTime: existing?.wakeTime ?? null,
      mood: existing?.mood ?? null,
      dayRating: draft.rating,
      note: cleanText(draft.note),
      scoreAreas,
    });

    const oldItems = existing
      ? tx.select().from(checkinItems).where(eq(checkinItems.checkinId, existing.id)).all()
      : [];
    const oldMovedByBlock = new Map(
      oldItems.flatMap((item) =>
        item.refId !== null && item.movedBlockId !== null ? [[item.refId, item.movedBlockId] as const] : [],
      ),
    );

    if (existing) {
      const oldRuleIds = tx
        .select()
        .from(ruleLogs)
        .where(eq(ruleLogs.checkinId, existing.id))
        .all()
        .map((log) => log.ruleId);
      tx.delete(xpEvents)
        .where(
          and(
            eq(xpEvents.userId, userId),
            eq(xpEvents.date, date),
            or(
              and(eq(xpEvents.source, 'checkin'), eq(xpEvents.sourceId, existing.id)),
              and(eq(xpEvents.source, 'rule'), inArray(xpEvents.sourceId, oldRuleIds)),
            ),
          ),
        )
        .run();
      tx.delete(checkinItems).where(eq(checkinItems.checkinId, existing.id)).run();
      tx.delete(ruleLogs).where(eq(ruleLogs.checkinId, existing.id)).run();
      const { id, userId: _owner, createdAt: _created, ...changes } = checkin;
      tx.update(checkins).set(changes).where(eq(checkins.id, id)).run();
    } else {
      tx.insert(checkins).values(checkin).run();
    }

    let taskXp = 0;
    for (const answer of answeredItems) {
      const block = blocksById.get(answer.blockId);
      if (!block || answer.outcome === null) continue;
      const outcome = answer.outcome;
      const laterDate = resolveLaterDate(answer, date);

      // "Kad kasnije?": premješteni blok (novi, ili onaj iz prošlog spremanja).
      const oldMovedId = oldMovedByBlock.get(block.id);
      const oldMovedRow = oldMovedId
        ? tx
            .select()
            .from(scheduleBlocks)
            .where(and(eq(scheduleBlocks.userId, userId), eq(scheduleBlocks.id, oldMovedId)))
            .get()
        : undefined;
      const oldMoved = oldMovedRow ? scheduleBlockSchema.parse(oldMovedRow) : null;
      let movedBlockId: string | null = null;
      if (laterDate !== null) {
        if (oldMoved) {
          movedBlockId = oldMoved.id;
          // Još neodrađen premješteni blok prati novi odabrani dan; odrađen ostaje gdje je.
          if (oldMoved.status === 'planned' && oldMoved.date !== laterDate) {
            tx.update(scheduleBlocks)
              .set({ date: laterDate, updatedAt: now })
              .where(eq(scheduleBlocks.id, oldMoved.id))
              .run();
          }
        } else {
          const moved = scheduleBlockSchema.parse({
            ...stamp,
            id: deps.newId(),
            ...movedBlockFields(block, laterDate),
          });
          tx.insert(scheduleBlocks).values(moved).run();
          movedBlockId = moved.id;
        }
      } else if (oldMoved && oldMoved.status === 'planned') {
        // Više se ne premješta — ukloni neodrađeni premješteni blok (dirnuti ostaje).
        tx.delete(scheduleBlocks).where(eq(scheduleBlocks.id, oldMoved.id)).run();
      }

      const item = checkinItemSchema.parse({
        ...stamp,
        id: deps.newId(),
        checkinId: checkin.id,
        kind: 'task',
        refId: block.id,
        ok: outcome === 'ok',
        outcome,
        comment: outcome === 'ok' ? null : cleanText(answer.comment),
        laterDate,
        movedBlockId,
      });
      tx.insert(checkinItems).values(item).run();

      const status = blockStatusAfterCheckin(outcome, laterDate);
      if (status !== block.status) {
        tx.update(scheduleBlocks).set({ status, updatedAt: now }).where(eq(scheduleBlocks.id, block.id)).run();
      }
      taskXp += syncBlockTaskXp(tx, { ...block, status }, deps)?.amount ?? 0;
    }

    // Jedan zapis po zabrani po danu: zamijeni i zapis istog dana koji nije iz ovog upita.
    const answeredRuleIds = answeredRules.map((answer) => answer.ruleId);
    tx.delete(ruleLogs)
      .where(and(eq(ruleLogs.userId, userId), eq(ruleLogs.date, date), inArray(ruleLogs.ruleId, answeredRuleIds)))
      .run();
    for (const answer of answeredRules) {
      const kept = answer.kept === true;
      const log = ruleLogSchema.parse({
        ...stamp,
        id: deps.newId(),
        ruleId: answer.ruleId,
        date,
        kept,
        trigger: kept ? null : cleanText(answer.trigger),
        checkinId: checkin.id,
      });
      tx.insert(ruleLogs).values(log).run();
    }

    const awards = eveningXpAwards({ rules: answeredRules }, userRules, checkin.id);
    for (const award of awards) {
      const event = xpEventSchema.parse({ ...stamp, id: deps.newId(), date, ...award });
      tx.insert(xpEvents).values(event).run();
    }

    return { checkin, xpEarned: sumAwards(awards) + taskXp };
  });
}

/** Svi XP eventovi korisnika (za zbrojeve; mala tablica — jedan red po nagradi). */
export async function listXpEvents(db: RitamDb, userId: string) {
  const rows = await db.select().from(xpEvents).where(eq(xpEvents.userId, userId)).all();
  return rows.map((row) => xpEventSchema.parse(row));
}

/** Dani večernjih upita s ocjenom (za glavni streak), uzlazno po datumu. */
export async function listEveningCheckins(
  db: RitamDb,
  userId: string,
): Promise<Pick<Checkin, 'date' | 'kind' | 'dayRating'>[]> {
  const rows = await db
    .select({ date: checkins.date, kind: checkins.kind, dayRating: checkins.dayRating })
    .from(checkins)
    .where(and(eq(checkins.userId, userId), eq(checkins.kind, 'evening')))
    .orderBy(asc(checkins.date))
    .all();
  return rows.map((row) =>
    checkinSchema.pick({ date: true, kind: true, dayRating: true }).parse(row),
  );
}

export class InvalidMorningCheckinError extends Error {
  constructor() {
    super('Morning check-in draft is invalid');
    this.name = 'InvalidMorningCheckinError';
  }
}

const morningOf = (userId: string, date: LocalDate) =>
  and(eq(checkins.userId, userId), eq(checkins.date, date), eq(checkins.kind, 'morning'));

/** Jutarnja prijava sna zadanog dana, ili `null` ako još nije spremljena. */
export async function getMorningCheckin(
  db: RitamDb,
  userId: string,
  date: LocalDate,
): Promise<Checkin | null> {
  const row = await db.select().from(checkins).where(morningOf(userId, date)).get();
  return row ? checkinSchema.parse(row) : null;
}

export type SavedMorningResult = { checkin: Checkin; xpEarned: number };

/**
 * Sprema jutarnju prijavu sna dana `draft.date` u jednoj transakciji: jutarnji checkin (jedan po
 * danu; ponovno spremanje ga ažurira) i XP sna (krevet na vrijeme) koji zamjenjuje XP prethodnog
 * spremanja istog checkina. Raspoloženje se ne prati — `mood` ostaje kakav je (`null`).
 */
export function saveMorningCheckin(
  db: RitamDb,
  userId: string,
  settings: MorningSleepSettings,
  draft: MorningDraft,
  deps: RepoDeps = defaultRepoDeps,
): SavedMorningResult {
  if (!isMorningDraftValid(draft)) throw new InvalidMorningCheckinError();
  const { date } = draft;
  const now = deps.now().toISOString();

  return db.transaction((tx) => {
    const existing = tx.select().from(checkins).where(morningOf(userId, date)).get();
    const checkin = checkinSchema.parse({
      id: existing?.id ?? deps.newId(),
      userId,
      createdAt: existing?.createdAt ?? now,
      updatedAt: now,
      date,
      kind: 'morning',
      sleepStart: draft.sleepStart,
      wakeTime: draft.wakeTime,
      mood: existing?.mood ?? null,
      dayRating: null,
      note: existing?.note ?? null,
    });

    if (existing) {
      tx.delete(xpEvents)
        .where(
          and(
            eq(xpEvents.userId, userId),
            eq(xpEvents.source, 'sleep'),
            eq(xpEvents.sourceId, existing.id),
          ),
        )
        .run();
      const { id, userId: _owner, createdAt: _created, ...changes } = checkin;
      tx.update(checkins).set(changes).where(eq(checkins.id, id)).run();
    } else {
      tx.insert(checkins).values(checkin).run();
    }

    const awards = morningXpAwards(settings, draft);
    for (const award of awards) {
      const event = xpEventSchema.parse({
        id: deps.newId(),
        userId,
        createdAt: now,
        updatedAt: now,
        date,
        source: award.source,
        sourceId: checkin.id,
        amount: award.amount,
      });
      tx.insert(xpEvents).values(event).run();
    }

    return { checkin, xpEarned: sumAwards(awards) };
  });
}
