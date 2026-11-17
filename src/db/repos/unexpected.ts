import { and, eq, isNull } from 'drizzle-orm';

import { cleanText, movedBlockFields, otherDayOptions } from '@/core/checkin';
import { scheduleBlockSchema, xpEventSchema, type LocalDate, type ScheduleBlock } from '@/core/domain';
import { xpForRescheduledWithReason, XP_TABLE } from '@/core/gamification';
import { isRescheduleChoice, planUnexpected, type UnexpectedChoice, type UnexpectedDuration } from '@/core/schedule';
import { addDays } from '@/core/time/local-date';

import type { RitamDb } from '../db';
import { scheduleBlocks, xpEvents } from '../schema';
import { syncBlockTaskXp } from './block-xp';
import { defaultRepoDeps, type RepoDeps } from './deps';

export type UnexpectedAnswer = {
  choice: UnexpectedChoice;
  /** Dan za „drugi dan“ (prekosutra … +7); za ostale izbore se ne čita. */
  otherDate?: string | null;
};

export type UnexpectedInput = {
  date: LocalDate;
  /** Minute od ponoći kad je iskrslo (početak prozora). */
  nowMinutes: number;
  duration: UnexpectedDuration;
  /** Što se dogodilo — ide kao bilješka na pogođene aktivnosti (kontekst za dijagnozu). */
  what: string;
  /** Odgovor po id-ju pogođenog bloka; blok bez odgovora dobiva zadani izbor. */
  answers: Readonly<Record<string, UnexpectedAnswer>>;
};

export type UnexpectedResult = {
  laterToday: number;
  moved: number;
  skipped: number;
  /** Dodijeljeni XP („preraspoređeno s objašnjenjem“); 0 ako ga danas već ima ili ništa nije preraspoređeno. */
  xp: number;
};

/**
 * „Nešto je iskrslo“ (korak 27) u jednoj transakciji. Pogođeni blokovi i termini „kasnije danas“
 * računaju se ponovno iz baze (`planUnexpected`), ne vjeruje se ekranu:
 * - kasnije danas → isti blok dobiva novi termin (ako termina više nema → sutra);
 * - sutra / drugi dan → blok `moved` + novi planirani blok na taj dan (`movedBlockFields`);
 * - preskoči → `skipped` (bez XP-a).
 * Razlog postaje bilješka bloka ako je nema. Niz se ne dira (ovisi o večernjem upitu).
 *
 * XP „preraspoređeno s objašnjenjem“ (5) najviše jednom dnevno i samo kad je nešto preraspoređeno
 * i razlog nije prazan. Sprema se kao `task` bez `sourceId` — `syncBlockTaskXp` (rezerviran za
 * `task` + id bloka) ga tako ne briše kad se blok kasnije prijavi.
 */
export function applyUnexpected(
  db: RitamDb,
  userId: string,
  input: UnexpectedInput,
  deps: RepoDeps = defaultRepoDeps,
): UnexpectedResult {
  const now = deps.now().toISOString();
  const reason = cleanText(input.what);
  const tomorrow = addDays(input.date, 1);
  const otherDays = new Set(otherDayOptions(input.date));

  return db.transaction((tx) => {
    const blocks = tx
      .select()
      .from(scheduleBlocks)
      .where(and(eq(scheduleBlocks.userId, userId), eq(scheduleBlocks.date, input.date)))
      .all()
      .map((row) => scheduleBlockSchema.parse(row));
    const plan = planUnexpected(blocks, input.nowMinutes, input.duration);
    const result: UnexpectedResult = { laterToday: 0, moved: 0, skipped: 0, xp: 0 };
    if (plan === null) return result;

    const save = (next: ScheduleBlock, statusChanged: boolean) => {
      const { id: _id, userId: _owner, createdAt: _created, ...changes } = next;
      tx.update(scheduleBlocks)
        .set(changes)
        .where(and(eq(scheduleBlocks.userId, userId), eq(scheduleBlocks.id, next.id)))
        .run();
      if (statusChanged) syncBlockTaskXp(tx, next, deps);
    };

    let rescheduled = false;
    for (const { block, laterToday } of plan.affected) {
      const answer = input.answers[block.id];
      let choice: UnexpectedChoice = answer?.choice ?? (laterToday !== null ? 'laterToday' : 'tomorrow');
      if (choice === 'laterToday' && laterToday === null) choice = 'tomorrow';
      const note = block.note ?? reason;

      if (choice === 'laterToday' && laterToday !== null) {
        save(scheduleBlockSchema.parse({ ...block, ...laterToday, note, updatedAt: now }), false);
        result.laterToday += 1;
      } else if (choice === 'skip') {
        save(scheduleBlockSchema.parse({ ...block, status: 'skipped', note, updatedAt: now }), true);
        result.skipped += 1;
      } else {
        const target =
          choice === 'other' && answer?.otherDate != null && otherDays.has(answer.otherDate)
            ? answer.otherDate
            : tomorrow;
        if (target === null) continue;
        save(scheduleBlockSchema.parse({ ...block, status: 'moved', note, updatedAt: now }), true);
        const copy = scheduleBlockSchema.parse({
          ...movedBlockFields(block, target),
          id: deps.newId(),
          userId,
          createdAt: now,
          updatedAt: now,
        });
        tx.insert(scheduleBlocks).values(copy).run();
        result.moved += 1;
      }
      if (isRescheduleChoice(choice)) rescheduled = true;
    }

    if (rescheduled && reason !== null) {
      const award = xpForRescheduledWithReason();
      const already = tx
        .select()
        .from(xpEvents)
        .where(
          and(
            eq(xpEvents.userId, userId),
            eq(xpEvents.date, input.date),
            eq(xpEvents.source, award.source),
            isNull(xpEvents.sourceId),
            eq(xpEvents.amount, XP_TABLE.rescheduledWithReason),
          ),
        )
        .get();
      if (!already) {
        const event = xpEventSchema.parse({
          id: deps.newId(),
          userId,
          createdAt: now,
          updatedAt: now,
          date: input.date,
          source: award.source,
          sourceId: null,
          amount: award.amount,
        });
        tx.insert(xpEvents).values(event).run();
        result.xp = award.amount;
      }
    }
    return result;
  });
}
