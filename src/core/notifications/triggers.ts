/**
 * Notifikacijski okidači: kad stižu jutarnja obavijest, večernji upit i wind-down.
 * Čista logika: bez React importa i bez expo-notifications (zakazivanje je korak 10).
 */
import type { Settings } from '../domain';
import { bedtimeFor, shiftClock } from '../onboarding/onboarding';
import { parseClock } from '../time/clock';
import { addDays, localDateOf } from '../time/local-date';

/** Vrste dnevnih obavijesti, redom kroz dan. */
export const NOTIFICATION_KINDS = ['morning', 'evening', 'windDown'] as const;
export type NotificationKind = (typeof NOTIFICATION_KINDS)[number];

/** iOS drži najviše 64 zakazane lokalne obavijesti po appu. */
export const IOS_PENDING_NOTIFICATION_LIMIT = 64;
/** Zadani horizont zakazivanja (dana, uključujući danas). App ga osvježava pri svakom otvaranju. */
export const DEFAULT_SCHEDULE_DAYS = 3;
/** Najveći horizont tako da sve vrste stanu u limit iOS-a. */
export const MAX_SCHEDULE_DAYS = Math.floor(IOS_PENDING_NOTIFICATION_LIMIT / NOTIFICATION_KINDS.length);

export type NotificationSettings = Pick<
  Settings,
  'wakeTime' | 'sleepHours' | 'morningNotifTime' | 'eveningNotifTime' | 'windDownMinutes'
>;

export type DailyNotificationTimes = Record<NotificationKind, string>;

export type NotificationTrigger = {
  /**
   * Stabilan identifikator `kind:YYYY-MM-DD@HH:MM` — isti okidač ima isti id pri svakom računanju,
   * a promjena vremena u postavkama daje novi id (pa se stari otkaže).
   */
  id: string;
  kind: NotificationKind;
  /** Lokalni kalendarski dan na koji obavijest stiže. */
  date: string;
  /** Lokalno vrijeme "HH:MM". */
  time: string;
  /** Trenutak okidanja po vremenskoj zoni uređaja. */
  fireAt: Date;
};

/** "HH:MM" za svaku vrstu obavijesti; wind-down = krevet − `windDownMinutes`. Neispravan ulaz → `null`. */
export function dailyNotificationTimes(settings: NotificationSettings): DailyNotificationTimes | null {
  const morning = shiftClock(settings.morningNotifTime, 0);
  const evening = shiftClock(settings.eveningNotifTime, 0);
  const bedtime = bedtimeFor(settings.wakeTime, settings.sleepHours);
  if (morning === null || evening === null || bedtime === null) return null;
  const { windDownMinutes } = settings;
  if (!Number.isInteger(windDownMinutes) || windDownMinutes < 0) return null;
  const windDown = shiftClock(bedtime, -windDownMinutes);
  if (windDown === null) return null;
  return { morning, evening, windDown };
}

export function triggerId(kind: NotificationKind, date: string, time: string): string {
  return `${kind}:${date}@${time}`;
}

const TRIGGER_ID_PATTERN = new RegExp(
  `^(?:${NOTIFICATION_KINDS.join('|')}):\\d{4}-\\d{2}-\\d{2}@\\d{2}:\\d{2}$`,
);

/**
 * Je li id zakazane obavijesti naš dnevni okidač (`kind:YYYY-MM-DD@HH:MM`). Pri ponovnom
 * zakazivanju otkazujemo samo takve — podsjetnici blokova i tuđe obavijesti ostaju.
 */
export function isDailyTriggerId(id: string): boolean {
  return TRIGGER_ID_PATTERN.test(id);
}

/** Lokalni `Date` za dan "YYYY-MM-DD" i vrijeme "HH:MM" (DST prijelaze rješava `Date`). */
export function localDateTime(date: string, time: string): Date | null {
  const minutes = parseClock(time);
  const [year, month, day] = date.split('-').map(Number);
  if (minutes === null || year === undefined || month === undefined || day === undefined) return null;
  return new Date(year, month - 1, day, Math.floor(minutes / 60), minutes % 60, 0, 0);
}

export type UpcomingOptions = {
  /** Koliko dana unaprijed, uključujući danas (ograničeno na [1, MAX_SCHEDULE_DAYS]). */
  days?: number;
};

/**
 * Sljedeći okidači od `now` (strogo nakon), za danas i idućih `days − 1` dana, sortirani po vremenu.
 * Neispravne postavke → `null`.
 */
export function upcomingTriggers(
  settings: NotificationSettings,
  now: Date,
  options: UpcomingOptions = {},
): NotificationTrigger[] | null {
  const times = dailyNotificationTimes(settings);
  if (times === null || Number.isNaN(now.getTime())) return null;

  const requested =
    options.days !== undefined && Number.isFinite(options.days)
      ? Math.floor(options.days)
      : DEFAULT_SCHEDULE_DAYS;
  const days = Math.min(MAX_SCHEDULE_DAYS, Math.max(1, requested));
  const today = localDateOf(now);

  const triggers: NotificationTrigger[] = [];
  for (let offset = 0; offset < days; offset += 1) {
    const date = addDays(today, offset);
    if (date === null) return null;
    for (const kind of NOTIFICATION_KINDS) {
      const time = times[kind];
      const fireAt = localDateTime(date, time);
      if (fireAt === null) return null;
      if (fireAt.getTime() <= now.getTime()) continue;
      triggers.push({ id: triggerId(kind, date, time), kind, date, time, fireAt });
    }
  }

  triggers.sort(
    (a, b) =>
      a.fireAt.getTime() - b.fireAt.getTime() ||
      NOTIFICATION_KINDS.indexOf(a.kind) - NOTIFICATION_KINDS.indexOf(b.kind),
  );
  return triggers.slice(0, IOS_PENDING_NOTIFICATION_LIMIT);
}

export type ReschedulePlan = {
  /** Zakazani id-jevi kojih više nema u željenom popisu. */
  toCancel: string[];
  /** Željeni okidači koji još nisu zakazani. */
  toSchedule: NotificationTrigger[];
};

/**
 * Razlika između već zakazanih obavijesti i željenih okidača, da se pri otvaranju appa
 * ne briše i ponovno zakazuje sve. Gledaju se samo naši dnevni okidači (`isDailyTriggerId`). Id sadrži vrijeme, pa promjena postavki otkazuje stare okidače.
 */
export function planReschedule(
  scheduledIds: readonly string[],
  desired: readonly NotificationTrigger[],
): ReschedulePlan {
  const scheduled = new Set(scheduledIds.filter(isDailyTriggerId));
  const desiredIds = new Set(desired.map((trigger) => trigger.id));
  return {
    toCancel: [...scheduled].filter((id) => !desiredIds.has(id)),
    toSchedule: desired.filter((trigger) => !scheduled.has(trigger.id)),
  };
}
