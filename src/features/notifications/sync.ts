/**
 * Ponovno zakazivanje dnevnih obavijesti (jutro, večer, wind-down) i podsjetnika blokova. Bez Reacta
 * i bez izravnog importa expo-notifications — sve ide kroz `NotificationScheduler` adapter, pa je testabilno.
 */
import type { ScheduleBlock } from '@/core/domain';
import {
  BLOCK_CATEGORY_ID,
  blockNotificationData,
  dailyNotificationData,
  needsReminder,
  planBlockReschedule,
  planReschedule,
  snoozeReminderId,
  contentKey,
  triggerIdWithContent,
  upcomingBlockReminders,
  upcomingTriggers,
  type BlockReminder,
  type DailyNotificationData,
  type NotificationData,
  type NotificationKind,
  type NotificationSettings,
} from '@/core/notifications';

/** Android kanal za dnevne obavijesti. */
export const DAILY_CHANNEL_ID = 'daily';
/** Android kanal za podsjetnike blokova (korisnik ga može zasebno utišati). */
export const BLOCKS_CHANNEL_ID = 'blocks';

export type NotificationText = { title: string; body: string };
export type DailyNotificationTexts = Record<NotificationKind, NotificationText>;

export type NotificationRequest<D extends NotificationData = NotificationData> = NotificationText & {
  identifier: string;
  fireAt: Date;
  channelId: string;
  /** Kategorija akcija (gumbi na obavijesti); bez nje obična obavijest. */
  categoryId?: string;
  data: D;
};

export type DailyNotificationRequest = NotificationRequest<DailyNotificationData>;

/** Tanki sloj oko expo-notifications (stvarna izvedba u `expo-scheduler.ts`). */
export type NotificationScheduler = {
  scheduledIds(): Promise<string[]>;
  cancel(identifier: string): Promise<void>;
  schedule(request: NotificationRequest): Promise<void>;
};

export type SyncResult = { cancelled: number; scheduled: number };

/** Tekst jutarnje obavijesti za dan (pregled plana); `null` → opći tekst iz `DailyNotificationTexts`. */
export type MorningText = (date: string) => NotificationText | null;

/**
 * Uskladi zakazane dnevne obavijesti s postavkama: otkaži zastarjele, zakaži nedostajuće.
 * Jutarnja s tekstom po danu (`morningText`) dobiva ključ sadržaja u id-ju, pa se nakon promjene plana
 * ponovo zakaže s novim tekstom. Tuđe obavijesti i podsjetnici blokova se ne diraju.
 * Neispravne postavke → ništa se ne mijenja.
 */
export async function syncDailyNotifications(
  scheduler: NotificationScheduler,
  settings: NotificationSettings,
  now: Date,
  texts: DailyNotificationTexts,
  morningText?: MorningText,
): Promise<SyncResult> {
  const triggers = upcomingTriggers(settings, now);
  if (triggers === null) return { cancelled: 0, scheduled: 0 };

  const desired = triggers.map((trigger) => {
    const custom = trigger.kind === 'morning' && morningText ? morningText(trigger.date) : null;
    if (custom === null) return { ...trigger, text: texts[trigger.kind] };
    const id = triggerIdWithContent(trigger.id, contentKey(`${custom.title}\n${custom.body}`));
    return { ...trigger, id, text: custom };
  });

  const plan = planReschedule(await scheduler.scheduledIds(), desired);
  for (const id of plan.toCancel) await scheduler.cancel(id);
  for (const trigger of plan.toSchedule) {
    await scheduler.schedule({
      identifier: trigger.id,
      fireAt: trigger.fireAt,
      channelId: DAILY_CHANNEL_ID,
      data: dailyNotificationData(trigger.kind, trigger.id),
      ...trigger.text,
    });
  }
  return { cancelled: plan.toCancel.length, scheduled: plan.toSchedule.length };
}

/** Otkaži sve naše dnevne obavijesti (npr. kad korisnik ukine dopuštenje). */
export async function cancelDailyNotifications(scheduler: NotificationScheduler): Promise<number> {
  const plan = planReschedule(await scheduler.scheduledIds(), []);
  for (const id of plan.toCancel) await scheduler.cancel(id);
  return plan.toCancel.length;
}

/** Tekst podsjetnika bloka (naziv bloka je naslov). */
export type BlockReminderTexts = {
  /** Tijelo podsjetnika na početku bloka. */
  body(reminder: Pick<BlockReminder, 'start' | 'end'>): string;
  /** Tijelo odgođenog podsjetnika. */
  snoozedBody(block: Pick<ScheduleBlock, 'start' | 'end'>): string;
};

/**
 * Uskladi podsjetnike blokova s blokovima iz horizonta: otkaži zastarjele (blok gotov, obrisan, pomaknut),
 * zakaži nedostajuće, najviše `limit` (budžet unutar limita iOS-a). Odgode riješenih blokova se otkazuju.
 */
export async function syncBlockReminders(
  scheduler: NotificationScheduler,
  blocks: readonly ScheduleBlock[],
  now: Date,
  limit: number,
  texts: BlockReminderTexts,
): Promise<SyncResult> {
  const desired = upcomingBlockReminders(blocks, now, limit);
  const planned = new Set(blocks.filter(needsReminder).map((block) => block.id));
  const plan = planBlockReschedule(await scheduler.scheduledIds(), desired, planned);
  for (const id of plan.toCancel) await scheduler.cancel(id);
  for (const reminder of plan.toSchedule) {
    await scheduler.schedule({
      identifier: reminder.id,
      fireAt: reminder.fireAt,
      channelId: BLOCKS_CHANNEL_ID,
      categoryId: BLOCK_CATEGORY_ID,
      data: blockNotificationData(reminder.blockId),
      title: reminder.title,
      body: texts.body(reminder),
    });
  }
  return { cancelled: plan.toCancel.length, scheduled: plan.toSchedule.length };
}

/** Zakaži odgođeni podsjetnik bloka (zamjenjuje prethodnu odgodu istog bloka). */
export async function scheduleSnooze(
  scheduler: NotificationScheduler,
  block: Pick<ScheduleBlock, 'id' | 'title' | 'start' | 'end'>,
  fireAt: Date,
  texts: BlockReminderTexts,
): Promise<void> {
  const identifier = snoozeReminderId(block.id);
  await scheduler.cancel(identifier);
  await scheduler.schedule({
    identifier,
    fireAt,
    channelId: BLOCKS_CHANNEL_ID,
    categoryId: BLOCK_CATEGORY_ID,
    data: blockNotificationData(block.id),
    title: block.title,
    body: texts.snoozedBody(block),
  });
}

/** Otkaži sve podsjetnike blokova i odgode (npr. kad korisnik ukine dopuštenje). */
export async function cancelBlockReminders(scheduler: NotificationScheduler): Promise<number> {
  const plan = planBlockReschedule(await scheduler.scheduledIds(), [], new Set());
  for (const id of plan.toCancel) await scheduler.cancel(id);
  return plan.toCancel.length;
}
