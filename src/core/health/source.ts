/**
 * Korak 39: pretvorba sirovih zapisa iz Apple Healtha (HealthKit) i Health Connecta u
 * `SleepSample` te rasponi upita. Čista logika — bez paketa i bez Reacta; adapter
 * (`src/features/health`) samo dohvaća podatke i predaje ih ovamo.
 */

import type { SleepSample, SleepStage } from './health';

/**
 * HealthKit `HKCategoryValueSleepAnalysis`: 0 inBed, 1 asleepUnspecified, 2 awake,
 * 3 asleepCore, 4 asleepDeep, 5 asleepREM. Nepoznata vrijednost otpada.
 */
export function sleepStageFromHealthKit(value: number): SleepStage | null {
  switch (value) {
    case 0:
      return 'inBed';
    case 1:
    case 3:
    case 4:
    case 5:
      return 'asleep';
    case 2:
      return 'awake';
    default:
      return null;
  }
}

/**
 * Health Connect `SleepStageType`: 0 unknown, 1 awake, 2 sleeping, 3 outOfBed, 4 light,
 * 5 deep, 6 REM. „Nepoznato“ i „izvan kreveta“ ne znače san.
 */
export function sleepStageFromHealthConnect(stage: number): SleepStage | null {
  switch (stage) {
    case 1:
      return 'awake';
    case 2:
    case 4:
    case 5:
    case 6:
      return 'asleep';
    default:
      return null;
  }
}

export interface HealthKitSleepRecord {
  startDate: Date;
  endDate: Date;
  value: number;
}

export function sleepSamplesFromHealthKit(records: readonly HealthKitSleepRecord[]): SleepSample[] {
  return records.flatMap((record) => {
    const stage = sleepStageFromHealthKit(record.value);
    return stage ? [{ start: record.startDate, end: record.endDate, stage }] : [];
  });
}

export interface HealthConnectSleepSession {
  startTime: string;
  endTime: string;
  stages?: readonly { startTime: string; endTime: string; stage: number }[];
}

/**
 * Sesija bez faza (samo „spavao od–do“, npr. ručni unos u Health Connectu) cijela je san.
 * Sesija s fazama daje samo faze — tako se buđenja usred noći ne broje kao san.
 */
export function sleepSamplesFromHealthConnect(sessions: readonly HealthConnectSleepSession[]): SleepSample[] {
  return sessions.flatMap((session) => {
    const stages = session.stages ?? [];
    if (stages.length === 0) {
      return [{ start: new Date(session.startTime), end: new Date(session.endTime), stage: 'asleep' as const }];
    }
    return stages.flatMap((part) => {
      const stage = sleepStageFromHealthConnect(part.stage);
      return stage ? [{ start: new Date(part.startTime), end: new Date(part.endTime), stage }] : [];
    });
  });
}

export interface HealthRange {
  start: Date;
  end: Date;
}

function parts(date: string): [number, number, number] | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(date);
  if (!match) return null;
  const year = Number(match[1]);
  const month = Number(match[2]) - 1;
  const day = Number(match[3]);
  const check = new Date(year, month, day);
  if (check.getFullYear() !== year || check.getMonth() !== month || check.getDate() !== day) return null;
  return [year, month, day];
}

/**
 * Raspon upita za noć koja završava jutrom `wakeDate`: od 12:00 prethodnog dana do 14:00 tog
 * dana — šire od prozora `healthNight` (18–14) da uzorak koji počinje prije 18:00 i traje u noć
 * stigne i bude odrezan tamo, a ne izgubljen u upitu.
 */
export function nightQueryRange(wakeDate: string): HealthRange | null {
  const p = parts(wakeDate);
  if (!p) return null;
  const [year, month, day] = p;
  return { start: new Date(year, month, day - 1, 12), end: new Date(year, month, day, 14) };
}

/** Lokalni dan `date`: od ponoći do sljedeće ponoći (DST prati uređaj). */
export function dayQueryRange(date: string): HealthRange | null {
  const p = parts(date);
  if (!p) return null;
  const [year, month, day] = p;
  return { start: new Date(year, month, day), end: new Date(year, month, day + 1) };
}

/** Zbroj iz Healtha za prikaz: nenegativan cijeli broj ili `null` kad podatka nema. */
export function healthAmount(value: number | null | undefined): number | null {
  if (value === null || value === undefined || !Number.isFinite(value) || value < 0) return null;
  return Math.round(value);
}
