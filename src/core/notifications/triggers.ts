/**
 * Notifikacijski okidači: kad stižu jutarnja obavijest, večernji upit i wind-down.
 * Čista logika: bez React importa i bez expo-notifications (zakazivanje je korak 10).
 */
import type { Settings } from '../domain';
import { bedtimeFor, shiftClock } from '../onboarding/onboarding';
import { isWeekend, wakeTimeFor, weekendShiftMinutes } from '../schedule/wake';
import { formatClock, MINUTES_PER_DAY, parseClock } from '../time/clock';
import { addDays, localDateOf } from '../time/local-date';

/** Vrste dnevnih obavijesti, redom kroz dan. */
export const NOTIFICATION_KINDS = ['morning', 'evening', 'windDown'] as const;
export type NotificationKind = (typeof NOTIFICATION_KINDS)[number];

/** iOS drži najviše 64 zakazane lokalne obavijesti po appu. */
export const IOS_PENDING_NOTIFICATION_LIMIT = 64;
/**
 * Zadani horizont zakazivanja (dana, uključujući danas; Bornova odluka: 7). App ga osvježava pri
 * svakom otvaranju. 7 × 3 dnevne = 21 obavijest, ostatak limita iOS-a ide podsjetnicima blokova.
 */
export const DEFAULT_SCHEDULE_DAYS = 7;
/** Najveći horizont tako da sve vrste stanu u limit iOS-a. */
export const MAX_SCHEDULE_DAYS = Math.floor(IOS_PENDING_NOTIFICATION_LIMIT / NOTIFICATION_KINDS.length);

export type NotificationSettings = Pick<
  Settings,
  | 'wakeTime'
  | 'weekendWakeTime'
  | 'sleepHours'
  | 'morningNotifTime'
  | 'eveningNotifTime'
  | 'windDownMinutes'
  | 'morningNotifEnabled'
  | 'eveningNotifEnabled'
  | 'windDownNotifEnabled'
>;

/** Je li vrsta obavijesti uključena u postavkama. */
export function isKindEnabled(settings: NotificationSettings, kind: NotificationKind): boolean {
  switch (kind) {
    case 'morning':
      return settings.morningNotifEnabled;
    case 'evening':
      return settings.eveningNotifEnabled;
    case 'windDown':
      return settings.windDownNotifEnabled;
  }
}

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

/**
 * "HH:MM" za svaku vrstu obavijesti **radnim danom** (vikend buđenje se ne gleda);
 * wind-down = krevet − `windDownMinutes`. Neispravan ulaz → `null`. Za konkretan dan vidi
 * `dayNotificationTimes` i `windDownOfNight`.
 */
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

/**
 * Jutarnja obavijest i večernji upit za kalendarski dan (odluka P29, 2026-11-10).
 * Jutarnja se pomiče za razliku vikend − radni dan buđenja kad je *taj* dan vikend (subota, nedjelja).
 * Večernji upit prati noć kao wind-down: pomiče se kad je *sljedeći* dan vikend (petak i subota
 * navečer), da nedjeljni upit ne padne iza wind-downa prije ponedjeljka. Neispravan ulaz → `null`.
 */
export function dayNotificationTimes(
  settings: NotificationSettings,
  date: string,
): Pick<DailyNotificationTimes, 'morning' | 'evening'> | null {
  const base = dailyNotificationTimes(settings);
  const next = addDays(date, 1);
  if (base === null || next === null) return null;
  const shift = weekendShiftMinutes(settings);
  const morning = isWeekend(date) ? shiftClock(base.morning, shift) : base.morning;
  const evening = isWeekend(next) ? shiftClock(base.evening, shift) : base.evening;
  if (morning === null || evening === null) return null;
  return { morning, evening };
}

/**
 * Wind-down za noć koja počinje navečer dana `night`: buđenje *sljedećeg* dana (vikend ili radni)
 * − sati sna − `windDownMinutes`. Može pasti i iza ponoći, pa vraća i kalendarski dan okidanja.
 * Neispravan ulaz → `null`.
 */
export function windDownOfNight(
  settings: NotificationSettings,
  night: string,
): { date: string; time: string } | null {
  const next = addDays(night, 1);
  if (next === null) return null;
  const wake = parseClock(wakeTimeFor(settings, next));
  if (wake === null || !Number.isFinite(settings.sleepHours)) return null;
  const minutes = wake - Math.round(settings.sleepHours * 60) - settings.windDownMinutes;
  // Od ponoći dana buđenja: ≥ 0 → isti dan kao buđenje (iza ponoći), < 0 → večer prije.
  const date = minutes >= 0 ? next : addDays(next, Math.floor(minutes / MINUTES_PER_DAY));
  const time = formatClock(((minutes % MINUTES_PER_DAY) + MINUTES_PER_DAY) % MINUTES_PER_DAY);
  if (date === null || time === null) return null;
  return { date, time };
}

export function triggerId(kind: NotificationKind, date: string, time: string): string {
  return `${kind}:${date}@${time}`;
}

/** Id okidača s ključem sadržaja (`kind:YYYY-MM-DD@HH:MM#ključ`) — za obavijesti s tekstom po danu. */
export function triggerIdWithContent(id: string, key: string): string {
  return `${id}#${key}`;
}

const TRIGGER_ID_PATTERN = new RegExp(
  `^(?:${NOTIFICATION_KINDS.join('|')}):\\d{4}-\\d{2}-\\d{2}@\\d{2}:\\d{2}(?:#[0-9a-z]+)?$`,
);

/**
 * Je li id zakazane obavijesti naš dnevni okidač (`kind:YYYY-MM-DD@HH:MM`, po želji `#ključ`
 * sadržaja). Pri ponovnom zakazivanju otkazujemo samo takve — podsjetnici blokova i tuđe obavijesti ostaju.
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
 * Isključene vrste se preskaču. Neispravne postavke → `null`.
 */
export function upcomingTriggers(
  settings: NotificationSettings,
  now: Date,
  options: UpcomingOptions = {},
): NotificationTrigger[] | null {
  if (dailyNotificationTimes(settings) === null || Number.isNaN(now.getTime())) return null;

  const requested =
    options.days !== undefined && Number.isFinite(options.days)
      ? Math.floor(options.days)
      : DEFAULT_SCHEDULE_DAYS;
  const days = Math.min(MAX_SCHEDULE_DAYS, Math.max(1, requested));
  const today = localDateOf(now);

  const last = addDays(today, days - 1);
  if (last === null) return null;

  const candidates: { kind: NotificationKind; date: string; time: string }[] = [];
  for (let offset = 0; offset < days; offset += 1) {
    const date = addDays(today, offset);
    if (date === null) return null;
    const times = dayNotificationTimes(settings, date);
    if (times === null) return null;
    candidates.push({ kind: 'morning', date, time: times.morning });
    candidates.push({ kind: 'evening', date, time: times.evening });
  }
  // Noći od jučer navečer (wind-down iza ponoći pada danas) do zadnjeg dana horizonta.
  for (let offset = -1; offset < days; offset += 1) {
    const night = addDays(today, offset);
    if (night === null) return null;
    const windDown = windDownOfNight(settings, night);
    if (windDown === null) return null;
    if (windDown.date < today || windDown.date > last) continue;
    candidates.push({ kind: 'windDown', ...windDown });
  }

  const triggers: NotificationTrigger[] = [];
  for (const { kind, date, time } of candidates) {
    if (!isKindEnabled(settings, kind)) continue;
    const fireAt = localDateTime(date, time);
    if (fireAt === null) return null;
    if (fireAt.getTime() <= now.getTime()) continue;
    triggers.push({ id: triggerId(kind, date, time), kind, date, time, fireAt });
  }

  triggers.sort(
    (a, b) =>
      a.fireAt.getTime() - b.fireAt.getTime() ||
      NOTIFICATION_KINDS.indexOf(a.kind) - NOTIFICATION_KINDS.indexOf(b.kind),
  );
  return triggers.slice(0, IOS_PENDING_NOTIFICATION_LIMIT);
}

export type ReschedulePlan<T extends NotificationTrigger = NotificationTrigger> = {
  /** Zakazani id-jevi kojih više nema u željenom popisu. */
  toCancel: string[];
  /** Željeni okidači koji još nisu zakazani. */
  toSchedule: T[];
};

/**
 * Razlika između već zakazanih obavijesti i željenih okidača, da se pri otvaranju appa
 * ne briše i ponovno zakazuje sve. Gledaju se samo naši dnevni okidači (`isDailyTriggerId`). Id sadrži vrijeme, pa promjena postavki otkazuje stare okidače.
 */
export function planReschedule<T extends NotificationTrigger>(
  scheduledIds: readonly string[],
  desired: readonly T[],
): ReschedulePlan<T> {
  const scheduled = new Set(scheduledIds.filter(isDailyTriggerId));
  const desiredIds = new Set(desired.map((trigger) => trigger.id));
  return {
    toCancel: [...scheduled].filter((id) => !desiredIds.has(id)),
    toSchedule: desired.filter((trigger) => !scheduled.has(trigger.id)),
  };
}
