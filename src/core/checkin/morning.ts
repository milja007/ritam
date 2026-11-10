/**
 * Jutarnji brief: prijava sna (zaspao / probudio) i sažetak dana. Čista logika, bez Reacta.
 * Koncept: "Kad si zaspao? Kad si se probudio?" — unaprijed popunjeno iz ciljeva sna, pa je
 * prijava "dva taba". Raspoloženje se ne prati (odluka 2026-11-09), pa ga brief ne pita.
 */
import type { Checkin, ScheduleBlock, Settings } from '../domain';
import { xpForBedtime, type XpAward } from '../gamification/xp';
import { bedtimeOn, wakeTimeFor } from '../schedule/wake';
import { blockPhase, blockRange } from '../schedule/timeline';
import { MINUTES_PER_DAY, parseClock } from '../time/clock';
import { addDays } from '../time/local-date';

export type MorningDraft = {
  date: string;
  /** Kad je zaspao ("HH:MM", obično prethodne večeri). */
  sleepStart: string;
  /** Kad se probudio ("HH:MM", dan `date`). */
  wakeTime: string;
};

export type MorningSleepSettings = Pick<Settings, 'wakeTime' | 'weekendWakeTime' | 'sleepHours'>;

/** Ciljani krevet za noć prije dana `date` (večer `date − 1`, prati buđenje dana `date`). */
export function targetBedtimeFor(settings: MorningSleepSettings, date: string): string | null {
  const previous = addDays(date, -1);
  return previous === null ? null : bedtimeOn(settings, previous);
}

/**
 * Nacrt prijave sna: spremljena prijava, inače ciljevi iz postavki (krevet prethodne večeri,
 * buđenje tog dana — vikendom vikend vrijeme).
 */
export function createMorningDraft(
  settings: MorningSleepSettings,
  date: string,
  saved: Pick<Checkin, 'sleepStart' | 'wakeTime'> | null,
): MorningDraft {
  const wakeTarget = wakeTimeFor(settings, date);
  const bedTarget = targetBedtimeFor(settings, date) ?? wakeTarget;
  return {
    date,
    sleepStart: saved?.sleepStart ?? bedTarget,
    wakeTime: saved?.wakeTime ?? wakeTarget,
  };
}

/**
 * Trajanje sna u minutama od `sleepStart` do `wakeTime` (preko ponoći: 23:30 → 07:00 = 450).
 * Isto vrijeme = 0. Neispravno → `null`.
 */
export function sleepDurationMinutes(sleepStart: string, wakeTime: string): number | null {
  const start = parseClock(sleepStart);
  const end = parseClock(wakeTime);
  if (start === null || end === null) return null;
  return (((end - start) % MINUTES_PER_DAY) + MINUTES_PER_DAY) % MINUTES_PER_DAY;
}

/** Prijava je ispravna kad su oba vremena ispravna i san traje više od 0 min. */
export function isMorningDraftValid(draft: MorningDraft): boolean {
  const duration = sleepDurationMinutes(draft.sleepStart, draft.wakeTime);
  return duration !== null && duration > 0;
}

/**
 * XP jutarnje prijave: krevet unutar ±30 min od cilja → bonus (tablica koncepta). "Buđenje bez
 * snooze" app ne može znati, pa se ne dodjeljuje. Bez kazni — izvan tolerancije nema XP-a.
 */
export function morningXpAwards(settings: MorningSleepSettings, draft: MorningDraft): XpAward[] {
  if (!isMorningDraftValid(draft)) return [];
  const target = targetBedtimeFor(settings, draft.date);
  if (target === null) return [];
  const award = xpForBedtime(target, draft.sleepStart);
  return award === null ? [] : [award];
}

export const GREETINGS = ['morning', 'afternoon', 'evening'] as const;
export type Greeting = (typeof GREETINGS)[number];

/** Pozdrav prema dobu dana: 04–12 jutro, 12–18 dan, inače večer. */
export function greetingFor(minutes: number): Greeting {
  const hour = Math.floor((((minutes % MINUTES_PER_DAY) + MINUTES_PER_DAY) % MINUTES_PER_DAY) / 60);
  if (hour >= 4 && hour < 12) return 'morning';
  if (hour >= 12 && hour < 18) return 'afternoon';
  return 'evening';
}

type BriefBlock = Pick<ScheduleBlock, 'id' | 'kind' | 'start' | 'end' | 'status'>;

/** Blokovi koje brief prikazuje kao kartice: svi osim sna, redom po početku. */
export function briefBlocks<T extends BriefBlock>(blocks: readonly T[]): T[] {
  return blocks
    .filter((block) => block.kind !== 'sleep')
    .slice()
    .sort((a, b) => (blockRange(a)?.start ?? 0) - (blockRange(b)?.start ?? 0));
}

export type BriefSummary = {
  /** Broj blokova dana (bez sna). */
  blocks: number;
  /** Od toga zadataka. */
  tasks: number;
  /** Prvi blok koji je u tijeku ili tek dolazi i još nije riješen; `null` ako ga nema. */
  next: { id: string; start: string } | null;
};

/** Sažetak za pozdrav: "Danas 4 bloka i 2 zadatka. Prvi: posao u 9:00." */
export function briefSummary(blocks: readonly BriefBlock[], nowMinutes: number): BriefSummary {
  const shown = briefBlocks(blocks);
  const next =
    shown.find((block) => block.status === 'planned' && blockPhase(block, nowMinutes) !== 'past') ??
    null;
  return {
    blocks: shown.length,
    tasks: shown.filter((block) => block.kind === 'task').length,
    next: next === null ? null : { id: next.id, start: next.start },
  };
}

/** Kartica od koje brief kreće: trenutni ili sljedeći neriješeni blok, inače prva. */
export function briefStartIndex(blocks: readonly BriefBlock[], nowMinutes: number): number {
  const shown = briefBlocks(blocks);
  const { next } = briefSummary(shown, nowMinutes);
  if (next === null) return 0;
  return Math.max(0, shown.findIndex((block) => block.id === next.id));
}
