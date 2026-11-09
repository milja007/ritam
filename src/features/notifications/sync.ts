/**
 * Ponovno zakazivanje dnevnih obavijesti (jutro, večer, wind-down). Bez Reacta i bez izravnog
 * importa expo-notifications — sve ide kroz `NotificationScheduler` adapter, pa je testabilno.
 */
import {
  dailyNotificationData,
  planReschedule,
  upcomingTriggers,
  type DailyNotificationData,
  type NotificationKind,
  type NotificationSettings,
} from '@/core/notifications';

/** Android kanal za dnevne obavijesti. */
export const DAILY_CHANNEL_ID = 'daily';

export type NotificationText = { title: string; body: string };
export type DailyNotificationTexts = Record<NotificationKind, NotificationText>;

export type DailyNotificationRequest = NotificationText & {
  identifier: string;
  fireAt: Date;
  channelId: string;
  data: DailyNotificationData;
};

/** Tanki sloj oko expo-notifications (stvarna izvedba u `expo-scheduler.ts`). */
export type NotificationScheduler = {
  scheduledIds(): Promise<string[]>;
  cancel(identifier: string): Promise<void>;
  schedule(request: DailyNotificationRequest): Promise<void>;
};

export type SyncResult = { cancelled: number; scheduled: number };

/**
 * Uskladi zakazane dnevne obavijesti s postavkama: otkaži zastarjele, zakaži nedostajuće.
 * Tuđe obavijesti i podsjetnici blokova se ne diraju. Neispravne postavke → ništa se ne mijenja.
 */
export async function syncDailyNotifications(
  scheduler: NotificationScheduler,
  settings: NotificationSettings,
  now: Date,
  texts: DailyNotificationTexts,
): Promise<SyncResult> {
  const desired = upcomingTriggers(settings, now);
  if (desired === null) return { cancelled: 0, scheduled: 0 };

  const plan = planReschedule(await scheduler.scheduledIds(), desired);
  for (const id of plan.toCancel) await scheduler.cancel(id);
  for (const trigger of plan.toSchedule) {
    await scheduler.schedule({
      identifier: trigger.id,
      fireAt: trigger.fireAt,
      channelId: DAILY_CHANNEL_ID,
      data: dailyNotificationData(trigger.kind, trigger.id),
      ...texts[trigger.kind],
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
