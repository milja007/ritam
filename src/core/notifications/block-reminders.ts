/**
 * Podsjetnici blokova: obavijest na početku svakog planiranog bloka (osim sna) i odgoda za 15 min.
 * Čista logika: bez Reacta i bez expo-notifications.
 */
import type { ScheduleBlock } from '../domain';
import type { BlockAction } from './actions';
import { IOS_PENDING_NOTIFICATION_LIMIT, localDateTime } from './triggers';

/** Odgodi = podsjeti ponovo za 15 minuta (odluka 2026-11-09). */
export const SNOOZE_MINUTES = 15;

/** Mjesta u limitu iOS-a ostavljena za odgođene podsjetnike. */
export const SNOOZE_RESERVE = 4;

const BLOCK_PREFIX = 'block:';
const SNOOZE_PREFIX = 'snooze:';

export type BlockReminder = {
  /** `block:<blokId>@<dan>T<HH:MM>` — promjena dana ili početka daje novi id (stari se otkaže). */
  id: string;
  blockId: string;
  title: string;
  date: string;
  start: string;
  end: string;
  fireAt: Date;
};

export function blockReminderId(block: Pick<ScheduleBlock, 'id' | 'date' | 'start'>): string {
  return `${BLOCK_PREFIX}${block.id}@${block.date}T${block.start}`;
}

export function snoozeReminderId(blockId: string): string {
  return `${SNOOZE_PREFIX}${blockId}`;
}

const BLOCK_ID_PATTERN = /^block:([^@\s]+)@\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/;
const SNOOZE_ID_PATTERN = /^snooze:([^@\s]+)$/;

export function isBlockReminderId(id: string): boolean {
  return BLOCK_ID_PATTERN.test(id);
}

/** Id bloka iz id-ja odgode, ili `null` ako to nije naša odgoda. */
export function snoozedBlockId(id: string): string | null {
  return SNOOZE_ID_PATTERN.exec(id)?.[1] ?? null;
}

/** Blok dobiva podsjetnik ako je još planiran i nije san. */
export function needsReminder(block: Pick<ScheduleBlock, 'kind' | 'status'>): boolean {
  return block.kind !== 'sleep' && block.status === 'planned';
}

/** Koliko podsjetnika blokova stane uz `dailyCount` dnevnih obavijesti i rezervu za odgode. */
export function blockReminderBudget(dailyCount: number): number {
  const daily = Number.isFinite(dailyCount) ? Math.max(0, Math.floor(dailyCount)) : 0;
  return Math.max(0, IOS_PENDING_NOTIFICATION_LIMIT - daily - SNOOZE_RESERVE);
}

/**
 * Podsjetnici za blokove koji počinju strogo poslije `now`, sortirani po vremenu, najviše `limit`.
 * Blokovi s neispravnim danom/vremenom se preskaču.
 */
export function upcomingBlockReminders(
  blocks: readonly ScheduleBlock[],
  now: Date,
  limit: number,
): BlockReminder[] {
  if (Number.isNaN(now.getTime()) || !(limit > 0)) return [];
  const reminders: BlockReminder[] = [];
  for (const block of blocks) {
    if (!needsReminder(block)) continue;
    const fireAt = localDateTime(block.date, block.start);
    if (fireAt === null || Number.isNaN(fireAt.getTime()) || fireAt.getTime() <= now.getTime()) continue;
    reminders.push({
      id: blockReminderId(block),
      blockId: block.id,
      title: block.title,
      date: block.date,
      start: block.start,
      end: block.end,
      fireAt,
    });
  }
  reminders.sort((a, b) => a.fireAt.getTime() - b.fireAt.getTime() || a.id.localeCompare(b.id));
  return reminders.slice(0, Math.floor(limit));
}

export type BlockReschedulePlan = {
  toCancel: string[];
  toSchedule: BlockReminder[];
};

/**
 * Razlika između zakazanih i željenih podsjetnika. Gledaju se samo naši id-jevi podsjetnika i odgoda;
 * odgoda se otkazuje kad njezin blok više nije među `plannedBlockIds` (gotov, obrisan, premješten).
 */
export function planBlockReschedule(
  scheduledIds: readonly string[],
  desired: readonly BlockReminder[],
  plannedBlockIds: ReadonlySet<string>,
): BlockReschedulePlan {
  const desiredIds = new Set(desired.map((reminder) => reminder.id));
  const scheduledReminders = new Set(scheduledIds.filter(isBlockReminderId));
  const toCancel = [...scheduledReminders].filter((id) => !desiredIds.has(id));
  for (const id of scheduledIds) {
    const blockId = snoozedBlockId(id);
    if (blockId !== null && !plannedBlockIds.has(blockId)) toCancel.push(id);
  }
  return {
    toCancel,
    toSchedule: desired.filter((reminder) => !scheduledReminders.has(reminder.id)),
  };
}

/** Trenutak odgođenog podsjetnika. */
export function snoozeFireAt(now: Date): Date {
  return new Date(now.getTime() + SNOOZE_MINUTES * 60_000);
}

/** Što napraviti s blokom nakon akcije na podsjetniku. */
export type BlockActionEffect =
  | { type: 'markDone' }
  | { type: 'snooze'; fireAt: Date }
  | { type: 'openBlock' }
  | { type: 'none' };

/**
 * Učinak akcije. Obrisan blok → ništa. Gotovo i Odgodi vrijede samo dok je blok planiran
 * (ako je u međuvremenu riješen, ništa se ne mijenja). Iskrslo otvara blok u appu.
 */
export function blockActionEffect(
  block: Pick<ScheduleBlock, 'kind' | 'status'> | null,
  action: BlockAction,
  now: Date,
): BlockActionEffect {
  if (block === null) return { type: 'none' };
  if (action === 'cameUp') return { type: 'openBlock' };
  if (!needsReminder(block)) return { type: 'none' };
  return action === 'done' ? { type: 'markDone' } : { type: 'snooze', fireAt: snoozeFireAt(now) };
}
