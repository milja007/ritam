/**
 * XP: iznosi po akcijama (tablica iz koncepta) i zbrojevi iz `xp_events`.
 * Čista logika: bez React importa, bez pisanja u bazu. Koncept: XP po akcijama, bez kazni —
 * svaki iznos je pozitivan, a ukupni XP se računa iz eventova (izvedeno, ne spremljeno).
 */
import type { RuleWeight } from '../domain/rule';
import type { XpEvent, XpSource } from '../domain/xp-event';
import { MINUTES_PER_DAY, parseClock } from '../time/clock';

export const TASK_DIFFICULTIES = ['easy', 'medium', 'hard'] as const;
export type TaskDifficulty = (typeof TASK_DIFFICULTIES)[number];

/** Tablica XP-a iz koncepta (Gamifikacija → XP sustav). */
export const XP_TABLE = {
  task: { easy: 10, medium: 25, hard: 50 },
  /** Bonus kad je zadatak odrađen u planiranom terminu. */
  taskOnTimeBonus: 5,
  /** Zabrana poštovana, po težini (1 lagana, 2 srednja, 3 ozbiljna). */
  ruleKept: { 1: 5, 2: 10, 3: 20 },
  eveningCheckin: 15,
  /** Otišao u krevet unutar ±30 min od cilja. */
  bedtimeOnTarget: 20,
  wokeWithoutSnooze: 10,
  /** Preraspoređeno s objašnjenjem ("Nešto je iskrslo") — iskrenost se nagrađuje. */
  rescheduledWithReason: 5,
} as const satisfies {
  task: Record<TaskDifficulty, number>;
  taskOnTimeBonus: number;
  ruleKept: Record<RuleWeight, number>;
  eveningCheckin: number;
  bedtimeOnTarget: number;
  wokeWithoutSnooze: number;
  rescheduledWithReason: number;
};

/** Tolerancija za krevet na vrijeme (± minute). */
export const BEDTIME_TOLERANCE_MINUTES = 30;

/** Dodjela XP-a prije spremanja kao `xp_events` (repo dodaje id, userId, datum, vremena). */
export type XpAward = { source: XpSource; amount: number };

export function xpForTaskDone(difficulty: TaskDifficulty, onTime: boolean): XpAward {
  return {
    source: 'task',
    amount: XP_TABLE.task[difficulty] + (onTime ? XP_TABLE.taskOnTimeBonus : 0),
  };
}

/** Djelomično odrađen zadatak: pola XP-a zadatka, zaokruženo naviše (15 → 8). */
export function xpForTaskPartial(difficulty: TaskDifficulty, onTime: boolean): XpAward {
  const full = xpForTaskDone(difficulty, onTime);
  return { source: 'task', amount: Math.ceil(full.amount / 2) };
}

export function xpForRuleKept(weight: RuleWeight): XpAward {
  return { source: 'rule', amount: XP_TABLE.ruleKept[weight] };
}

export function xpForEveningCheckin(): XpAward {
  return { source: 'checkin', amount: XP_TABLE.eveningCheckin };
}

export function xpForWakeWithoutSnooze(): XpAward {
  return { source: 'sleep', amount: XP_TABLE.wokeWithoutSnooze };
}

export function xpForRescheduledWithReason(): XpAward {
  return { source: 'task', amount: XP_TABLE.rescheduledWithReason };
}

/**
 * Razlika u minutama između stvarnog i ciljanog vremena kreveta ("HH:MM"), najkraća preko ponoći
 * (cilj 23:45, stvarno 00:10 → 25). `null` za neispravan unos.
 */
export function bedtimeDeviationMinutes(target: string, actual: string): number | null {
  const t = parseClock(target);
  const a = parseClock(actual);
  if (t === null || a === null) return null;
  const diff = Math.abs(a - t) % MINUTES_PER_DAY;
  return Math.min(diff, MINUTES_PER_DAY - diff);
}

/** XP za krevet na vrijeme, ili `null` ako je izvan ±30 min (nema kazne, samo nema bonusa). */
export function xpForBedtime(target: string, actual: string): XpAward | null {
  const deviation = bedtimeDeviationMinutes(target, actual);
  if (deviation === null || deviation > BEDTIME_TOLERANCE_MINUTES) return null;
  return { source: 'sleep', amount: XP_TABLE.bedtimeOnTarget };
}

type XpEventLike = Pick<XpEvent, 'date' | 'amount'>;

/** Ukupni XP iz svih eventova. */
export function totalXp(events: readonly XpEventLike[]): number {
  return events.reduce((sum, event) => sum + event.amount, 0);
}

/** XP zarađen na zadani dan ("XP dana" u dnevnom izvještaju). */
export function xpForDate(events: readonly XpEventLike[], date: string): number {
  return events.reduce((sum, event) => (event.date === date ? sum + event.amount : sum), 0);
}

/** XP po danu, ključevi sortirani uzlazno. */
export function xpByDate(events: readonly XpEventLike[]): Map<string, number> {
  const totals = new Map<string, number>();
  for (const event of events) {
    totals.set(event.date, (totals.get(event.date) ?? 0) + event.amount);
  }
  return new Map([...totals.entries()].sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0)));
}

/**
 * Koliko je XP-a upravo dobiveno (za „+N XP“ animaciju, korak 35): razlika ukupnog XP-a između
 * dva crtanja. Prvo crtanje (`previous === null`) i pad ukupnog XP-a (poništena radnja) daju 0 —
 * animira se samo stvaran dobitak dok je ekran otvoren. Neispravni brojevi daju 0.
 */
export function xpGain(previous: number | null, next: number): number {
  if (previous === null || !Number.isFinite(previous) || !Number.isFinite(next)) return 0;
  return Math.max(0, Math.floor(next) - Math.floor(previous));
}
