/**
 * Zabrane unutar planova (korak 28): kad zabrana vrijedi, koje se vide u kojem razdoblju i niz po
 * zabrani. Čista logika, bez React importa. Niz se ne sprema — izvodi se iz `rule_logs`.
 */
import { isValidLocalDate } from '../domain/common';
import type { Rule, RuleLog, RulePeriod } from '../domain/rule';
import { addDays } from '../time/local-date';

/** Polja zabrane koja određuju kad vrijedi. */
export type RuleWhen = Pick<Rule, 'activeDays' | 'period' | 'periodStart'>;

/** Dan u tjednu (0 = nedjelja … 6 = subota) ili `null` za neispravan datum. */
function weekdayOf(date: string): number | null {
  if (!isValidLocalDate(date)) return null;
  const [y, m, d] = date.split('-').map(Number);
  return new Date(Date.UTC(y ?? 0, (m ?? 1) - 1, d ?? 1)).getUTCDay();
}

/** Prvi dan razdoblja u kojem je `date` (tjedan → ponedjeljak, mjesec → 1., godina → 1. 1.). */
export function rulePeriodStart(period: RulePeriod, date: string): string | null {
  const weekday = weekdayOf(date);
  if (weekday === null) return null;
  if (period === 'year') return `${date.slice(0, 4)}-01-01`;
  if (period === 'month') return `${date.slice(0, 7)}-01`;
  return addDays(date, -((weekday + 6) % 7));
}

/** Zadnji dan razdoblja koje počinje s `start`. */
export function rulePeriodEnd(period: RulePeriod, start: string): string | null {
  if (!isValidLocalDate(start)) return null;
  if (period === 'week') return addDays(start, 6);
  if (period === 'year') return `${start.slice(0, 4)}-12-31`;
  const year = Number(start.slice(0, 4));
  const month = Number(start.slice(5, 7));
  const next = month === 12 ? `${year + 1}-01-01` : `${year}-${String(month + 1).padStart(2, '0')}-01`;
  return addDays(next, -1);
}

/** Raspon dana u kojem zabrana vrijedi; `null` granice = stalna. */
export function ruleRange(rule: Pick<Rule, 'period' | 'periodStart'>): { from: string | null; to: string | null } {
  if (rule.period === null || rule.periodStart === null) return { from: null, to: null };
  return { from: rule.periodStart, to: rulePeriodEnd(rule.period, rule.periodStart) };
}

/** Vrijedi li zabrana na `date`: dan u tjednu je među njezinim danima i dan je unutar razdoblja. */
export function isRuleActiveOn(rule: RuleWhen, date: string): boolean {
  const weekday = weekdayOf(date);
  if (weekday === null || !rule.activeDays.includes(weekday)) return false;
  const { from, to } = ruleRange(rule);
  if (from !== null && date < from) return false;
  if (to !== null && date > to) return false;
  return true;
}

/** Zabrane koje vrijede na `date` (večernji upit pita samo njih). */
export function rulesActiveOn<T extends RuleWhen>(rules: readonly T[], date: string): T[] {
  return rules.filter((rule) => isRuleActiveOn(rule, date));
}

const PERIOD_RANK: Readonly<Record<RulePeriod, number>> = { week: 0, month: 1, year: 2 };

/** Kako se zabrana odnosi prema prikazanom razdoblju: njegova, šira (mjesec/godina) ili stalna. */
export type RuleScope = 'own' | 'wider' | 'always';

export type PeriodRule<T> = { rule: T; scope: RuleScope };

/**
 * Zabrane koje se vide u planu razdoblja: njegove, pa šire koje se s njim preklapaju (godina u
 * mjesecu i tjednu, mjesec u tjednu), pa stalne. Uže (tjedne u mjesecu) se ne prikazuju.
 */
export function rulesForPeriod<T extends Pick<Rule, 'period' | 'periodStart' | 'createdAt' | 'id'>>(
  rules: readonly T[],
  period: RulePeriod,
  periodStart: string,
): PeriodRule<T>[] {
  const end = rulePeriodEnd(period, periodStart);
  if (end === null) return [];
  const result: PeriodRule<T>[] = [];
  for (const rule of rules) {
    if (rule.period === null || rule.periodStart === null) {
      result.push({ rule, scope: 'always' });
      continue;
    }
    if (rule.period === period) {
      if (rule.periodStart === periodStart) result.push({ rule, scope: 'own' });
      continue;
    }
    if (PERIOD_RANK[rule.period] < PERIOD_RANK[period]) continue;
    const { from, to } = ruleRange(rule);
    if (from !== null && to !== null && from <= end && to >= periodStart) result.push({ rule, scope: 'wider' });
  }
  const order: Readonly<Record<RuleScope, number>> = { own: 0, wider: 1, always: 2 };
  return result.sort(
    (a, b) =>
      order[a.scope] - order[b.scope] ||
      (b.rule.period ? PERIOD_RANK[b.rule.period] : 0) - (a.rule.period ? PERIOD_RANK[a.rule.period] : 0) ||
      (a.rule.periodStart ?? '').localeCompare(b.rule.periodStart ?? '') ||
      a.rule.createdAt.localeCompare(b.rule.createdAt) ||
      a.rule.id.localeCompare(b.rule.id),
  );
}

export type RuleStreak = {
  /** Dani zaredom (kad zabrana vrijedi) u kojima si se držao, do danas. */
  current: number;
  /** Najduži takav niz. */
  best: number;
  /** Koliko je dana zapisano kao „Držao sam se“ / „Prekršio sam“. */
  kept: number;
  broken: number;
  /** Je li današnji dan već zapisan. */
  answeredToday: boolean;
};

/** Najviše dana unatrag koje niz gleda (stalne zabrane s dugom poviješću). */
const MAX_STREAK_DAYS = 3660;

/**
 * Niz po zabrani. Dani kad zabrana ne vrijedi se preskaču (ne prekidaju niz). „Držao sam se“
 * povećava niz, „Prekršio sam“ ga prekida. Prošli dan kad je vrijedila, a nije zapisan, prekida
 * niz; današnji nezapisani dan ne prekida (večernji upit još nije stigao). Bez kazni: prekid samo
 * vraća tekući niz na nulu, najbolji ostaje.
 */
export function ruleStreak(
  rule: RuleWhen,
  logs: readonly Pick<RuleLog, 'date' | 'kept'>[],
  today: string,
): RuleStreak {
  const empty: RuleStreak = { current: 0, best: 0, kept: 0, broken: 0, answeredToday: false };
  if (!isValidLocalDate(today)) return empty;
  const byDate = new Map<string, boolean>();
  for (const log of logs) {
    if (isValidLocalDate(log.date) && log.date <= today) byDate.set(log.date, log.kept);
  }
  const { from, to } = ruleRange(rule);
  const firstLog = [...byDate.keys()].sort()[0] ?? null;
  const earliest = addDays(today, -(MAX_STREAK_DAYS - 1));
  const rawStart = from ?? firstLog;
  if (rawStart === null || rawStart > today || earliest === null) return empty;
  const start = rawStart < earliest ? earliest : rawStart;
  const last = to !== null && to < today ? to : today;

  let run = 0;
  let best = 0;
  let kept = 0;
  let broken = 0;
  let date: string | null = start;
  while (date !== null && date <= last) {
    if (isRuleActiveOn(rule, date)) {
      const answer = byDate.get(date);
      if (answer === true) {
        run += 1;
        kept += 1;
      } else if (answer === false) {
        run = 0;
        broken += 1;
      } else if (date !== today) {
        run = 0;
      }
      best = Math.max(best, run);
    }
    date = addDays(date, 1);
  }
  return { current: run, best, kept, broken, answeredToday: byDate.has(today) };
}

/** Donje granice niza (dani) za svjetlinu žara zabrane: `faint`, `low`, `warm`, `bright`. */
export const RULE_EMBER_STEPS = { faint: 1, low: 3, warm: 7, bright: 14 } as const;

/** Žar zabrane raste s nizom; bez niza je ugašen (bez kazne, samo tišina). */
export function ruleEmberLevel(current: number): 'unlit' | 'faint' | 'low' | 'warm' | 'bright' {
  if (!Number.isFinite(current) || current < RULE_EMBER_STEPS.faint) return 'unlit';
  if (current >= RULE_EMBER_STEPS.bright) return 'bright';
  if (current >= RULE_EMBER_STEPS.warm) return 'warm';
  if (current >= RULE_EMBER_STEPS.low) return 'low';
  return 'faint';
}
