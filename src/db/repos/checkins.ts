import { and, eq, inArray, or } from 'drizzle-orm';

import {
  blockStatusAfterCheckin,
  cleanText,
  eveningXpAwards,
  isEveningDraftComplete,
  sumAwards,
  type EveningDraft,
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
} from '@/core/domain';

import type { RitamDb } from '../db';
import { checkinItems, checkins, ruleLogs, rules, scheduleBlocks, xpEvents } from '../schema';
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
 * Sprema večernji upit u jednoj transakciji (sve ili ništa): checkin (jedan večernji po danu),
 * stavke checkliste (`checkin_items`), zapise zabrana (`rule_logs`), statuse blokova i XP
 * (`xp_events`). Ponovno spremanje istog dana zamjenjuje stavke, zapise i XP tog upita —
 * XP se ne duplicira. Odgovori na blokove/zabrane kojih (više) nema se preskaču.
 */
export function saveEveningCheckin(
  db: RitamDb,
  userId: string,
  date: LocalDate,
  draft: EveningDraft,
  deps: RepoDeps = defaultRepoDeps,
): SavedEveningResult {
  if (!isEveningDraftComplete(draft)) throw new IncompleteEveningCheckinError();
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
    });

    if (existing) {
      const oldItems = tx.select().from(checkinItems).where(eq(checkinItems.checkinId, existing.id)).all();
      const oldLogs = tx.select().from(ruleLogs).where(eq(ruleLogs.checkinId, existing.id)).all();
      const oldBlockIds = oldItems.flatMap((item) => (item.refId === null ? [] : [item.refId]));
      const oldRuleIds = oldLogs.map((log) => log.ruleId);
      tx.delete(xpEvents)
        .where(
          and(
            eq(xpEvents.userId, userId),
            eq(xpEvents.date, date),
            or(
              and(eq(xpEvents.source, 'checkin'), eq(xpEvents.sourceId, existing.id)),
              and(eq(xpEvents.source, 'task'), inArray(xpEvents.sourceId, oldBlockIds)),
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

    for (const answer of answeredItems) {
      const ok = answer.ok === true;
      const item = checkinItemSchema.parse({
        ...stamp,
        id: deps.newId(),
        checkinId: checkin.id,
        kind: 'task',
        refId: answer.blockId,
        ok,
        comment: ok ? null : cleanText(answer.comment),
      });
      tx.insert(checkinItems).values(item).run();

      const block = blocksById.get(answer.blockId);
      const status = block ? blockStatusAfterCheckin(block.status, ok) : null;
      if (block && status !== block.status) {
        tx.update(scheduleBlocks)
          .set({ status: status ?? block.status, updatedAt: now })
          .where(eq(scheduleBlocks.id, block.id))
          .run();
      }
    }

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

    const awards = eveningXpAwards(
      { ...draft, items: answeredItems, rules: answeredRules },
      dayBlocks,
      userRules,
      checkin.id,
    );
    for (const award of awards) {
      const event = xpEventSchema.parse({ ...stamp, id: deps.newId(), date, ...award });
      tx.insert(xpEvents).values(event).run();
    }

    return { checkin, xpEarned: sumAwards(awards) };
  });
}

/** Svi XP eventovi korisnika (za zbrojeve; mala tablica — jedan red po nagradi). */
export async function listXpEvents(db: RitamDb, userId: string) {
  const rows = await db.select().from(xpEvents).where(eq(xpEvents.userId, userId)).all();
  return rows.map((row) => xpEventSchema.parse(row));
}
