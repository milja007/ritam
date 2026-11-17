/**
 * San (korak 29): ocjena noći prema cilju, zadnjih 7 noći za karticu sna i postupni pomak kreveta.
 * Čista logika, bez Reacta. Koncept: „ciljano buđenje + sati sna → vrijeme kreveta; raspored se
 * prilagođava lošem snu; postupni pomaci po 15 min“.
 */
import { sleepDurationMinutes, targetBedtimeFor, type MorningSleepSettings } from '../checkin/morning';
import type { Checkin } from '../domain';
import { bedtimeOn, shiftClockBy, wakeShiftMinutes } from '../schedule/wake';
import { addDays } from '../time/local-date';

/** Kratko = barem sat manje od cilja; jako kratko = barem dva sata manje. */
export const SHORT_SLEEP_MINUTES = 60;
export const VERY_SHORT_SLEEP_MINUTES = 120;
/** Korak postupnog pomaka kreveta (koncept). */
export const BEDTIME_STEP_MINUTES = 15;
/** Najmanje noći s prijavom u zadnjih 7 da bi se predložio korak kreveta. */
export const BEDTIME_MIN_NIGHTS = 3;
export const SLEEP_WEEK_NIGHTS = 7;

export type NightLevel = 'rested' | 'short' | 'veryShort';

export type NightAssessment = {
  level: NightLevel;
  /** Trajanje sna u minutama. */
  minutes: number;
  /** Koliko je manje od cilja (0 ako je cilj dosegnut). */
  deficit: number;
};

/** Ciljani san u minutama (sati iz postavki, zaokruženo). */
export function targetSleepMinutes(settings: Pick<MorningSleepSettings, 'sleepHours'>): number {
  return Math.round(settings.sleepHours * 60);
}

/** Ocjena jedne noći iz prijave; neispravna ili prazna prijava → `null`. */
export function assessNight(
  settings: Pick<MorningSleepSettings, 'sleepHours'>,
  night: Pick<Checkin, 'sleepStart' | 'wakeTime'> | null,
): NightAssessment | null {
  if (night?.sleepStart == null || night.wakeTime == null) return null;
  const minutes = sleepDurationMinutes(night.sleepStart, night.wakeTime);
  if (minutes === null || minutes <= 0) return null;
  const deficit = Math.max(0, targetSleepMinutes(settings) - minutes);
  const level: NightLevel =
    deficit >= VERY_SHORT_SLEEP_MINUTES ? 'veryShort' : deficit >= SHORT_SLEEP_MINUTES ? 'short' : 'rested';
  return { level, minutes, deficit };
}

export type SleepNight = {
  /** Dan buđenja (datum jutarnje prijave). */
  date: string;
  /** Trajanje u minutama; `null` = bez prijave. */
  minutes: number | null;
  sleepStart: string | null;
  /** Ciljani krevet te noći. */
  targetBedtime: string | null;
  /** Minute kasnije (+) ili ranije (−) od ciljanog kreveta; `null` bez prijave. */
  lateBy: number | null;
  level: NightLevel | null;
};

type MorningRow = Pick<Checkin, 'date' | 'sleepStart' | 'wakeTime'>;

/**
 * Zadnjih `count` noći, od najstarije do noći prije `today` (uključujući jutro `today`).
 * Noć bez prijave ima `minutes: null` (ugašen stupac, ne kazna).
 */
export function sleepNights(
  settings: MorningSleepSettings,
  mornings: readonly MorningRow[],
  today: string,
  count: number = SLEEP_WEEK_NIGHTS,
): SleepNight[] {
  const byDate = new Map(mornings.map((row) => [row.date, row]));
  const nights: SleepNight[] = [];
  for (let offset = count - 1; offset >= 0; offset -= 1) {
    const date = addDays(today, -offset);
    if (date === null) continue;
    const row = byDate.get(date) ?? null;
    const assessment = assessNight(settings, row);
    const targetBedtime = targetBedtimeFor(settings, date);
    const lateBy =
      assessment !== null && row?.sleepStart != null && targetBedtime !== null
        ? wakeShiftMinutes(targetBedtime, row.sleepStart)
        : null;
    nights.push({
      date,
      minutes: assessment?.minutes ?? null,
      sleepStart: assessment !== null ? (row?.sleepStart ?? null) : null,
      targetBedtime,
      lateBy,
      level: assessment?.level ?? null,
    });
  }
  return nights;
}

export type SleepSummary = {
  /** Noći s prijavom. */
  logged: number;
  /** Prosječno trajanje (min) prijavljenih noći; `null` bez prijava. */
  averageMinutes: number | null;
  /** Prosječno kašnjenje kreveta prema cilju (min, zaokruženo); `null` bez prijava. */
  averageLateBy: number | null;
  /** Noći s barem ciljanim snom (manjak < 1 h). */
  rested: number;
};

export function summarizeNights(nights: readonly SleepNight[]): SleepSummary {
  const logged = nights.filter((night) => night.minutes !== null);
  const late = logged.flatMap((night) => (night.lateBy === null ? [] : [night.lateBy]));
  const average = (values: readonly number[]) =>
    values.length === 0 ? null : Math.round(values.reduce((sum, value) => sum + value, 0) / values.length);
  return {
    logged: logged.length,
    averageMinutes: average(logged.map((night) => night.minutes ?? 0)),
    averageLateBy: average(late),
    rested: logged.filter((night) => night.level === 'rested').length,
  };
}

export type BedtimeStep = {
  /** Ciljani krevet večeras (iz postavki). */
  target: string;
  /** Večerašnji korak: cilj ili postupno kasnije od cilja dok se navika ne pomakne. */
  tonight: string;
  /** Koliko je večerašnji korak kasnije od cilja (0 = ravno na cilj). */
  laterThanTarget: number;
  /** Je li to stvarni korak (krevet zadnjih noći kasni više od jednog koraka). */
  stepping: boolean;
};

/**
 * Postupni pomak kreveta: ako je prosječni krevet zadnjih noći (najmanje 3 prijave) kasnije od
 * cilja za više od 15 min, večeras se cilja 15 min ranije od tog prosjeka (prosjek zaokružen na
 * 15 min naniže), nikad ranije od cilja. Inače večeras = cilj. Raniji krevet od cilja se ne
 * „ispravlja“ prema kasnije.
 */
export function bedtimeStep(
  settings: MorningSleepSettings,
  nights: readonly SleepNight[],
  today: string,
): BedtimeStep | null {
  const target = bedtimeOn(settings, today);
  if (target === null) return null;
  const summary = summarizeNights(nights);
  const late = summary.averageLateBy;
  if (summary.logged < BEDTIME_MIN_NIGHTS || late === null || late <= BEDTIME_STEP_MINUTES) {
    return { target, tonight: target, laterThanTarget: 0, stepping: false };
  }
  const later = Math.floor(late / BEDTIME_STEP_MINUTES) * BEDTIME_STEP_MINUTES - BEDTIME_STEP_MINUTES;
  const tonight = later > 0 ? shiftClockBy(target, later) : target;
  return {
    target,
    tonight: tonight ?? target,
    laterThanTarget: tonight === null ? 0 : Math.max(0, later),
    stepping: true,
  };
}
