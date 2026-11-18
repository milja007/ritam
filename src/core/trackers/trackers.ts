/**
 * Opcionalni trackeri (korak 31b): kalorije i novac. Čista logika bez React importa.
 *
 * Koncept: kalorije — dnevni cilj, unos po obroku ili zbroj → večernja provjera unutar / iznad /
 * ispod i koliko; upozorenje ako je cilj neuobičajeno nizak. Novac — limit potrošnje za dan,
 * tjedan ili mjesec, po želji trenutno stanje; unos potrošnje → koliko je ostalo, tjedni i
 * mjesečni zbroj. Što se ne bilježi, ne ulazi.
 */
import type { MoneyPeriod, TrackerEntry, TrackerKind } from '../domain';
import { weekStart } from '../progress/compare';
import { addDays } from '../time/local-date';

/** „Unutar cilja“ = najviše ±10 % od cilja (nije u konceptu — pitanje 90). */
export const CALORIE_TOLERANCE = 0.1;
/** Cilj ispod ovoga je neuobičajeno nizak → upozorenje (ne zabrana). */
export const LOW_CALORIE_GOAL = 1200;

type Entry = Pick<TrackerEntry, 'date' | 'kind' | 'amount'>;

/** Zbroj unosa jedne vrste za dane `from`–`to` (uključivo). */
export function trackerTotal(entries: readonly Entry[], kind: TrackerKind, from: string, to: string): number {
  return entries
    .filter((entry) => entry.kind === kind && entry.date >= from && entry.date <= to)
    .reduce((sum, entry) => sum + entry.amount, 0);
}

export type CalorieStatus = 'within' | 'over' | 'under';

export type CalorieCheck = {
  status: CalorieStatus;
  total: number;
  goal: number;
  /** Koliko iznad (pozitivno) ili ispod (negativno) cilja; 0 kad je točno na cilju. */
  difference: number;
};

/**
 * Večernja provjera kalorija: `null` kad nema cilja ili ništa nije uneseno (ne bilježi se → ne
 * ulazi). Unutar ±10 % je „unutar“.
 */
export function calorieCheck(total: number, goal: number | null): CalorieCheck | null {
  if (goal === null || goal <= 0 || total <= 0) return null;
  const difference = total - goal;
  const status: CalorieStatus =
    Math.abs(difference) <= goal * CALORIE_TOLERANCE ? 'within' : difference > 0 ? 'over' : 'under';
  return { status, total, goal, difference };
}

export const isLowCalorieGoal = (goal: number | null): boolean => goal !== null && goal < LOW_CALORIE_GOAL;

/** Dani razdoblja limita koje sadrži `date` (tjedan pon–ned, mjesec 1.–zadnji). */
export function moneyWindow(period: MoneyPeriod, date: string): { start: string; end: string } | null {
  if (period === 'day') return addDays(date, 0) === null ? null : { start: date, end: date };
  if (period === 'week') {
    const start = weekStart(date);
    const end = start === null ? null : addDays(start, 6);
    return start !== null && end !== null ? { start, end } : null;
  }
  const start = `${date.slice(0, 7)}-01`;
  const nextMonth = addDays(start, 32);
  const end = nextMonth === null ? null : addDays(`${nextMonth.slice(0, 7)}-01`, -1);
  return addDays(start, 0) !== null && end !== null ? { start, end } : null;
}

export type MoneySettings = {
  moneyLimitCents: number | null;
  moneyPeriod: MoneyPeriod | null;
  moneyBalanceCents: number | null;
  moneyBalanceOn: string | null;
};

export type MoneySummary = {
  /** Limit i potrošnja u tekućem razdoblju limita; `null` bez limita. */
  limit: { period: MoneyPeriod; cents: number; spent: number; remaining: number; start: string; end: string } | null;
  /** Potrošnja danas, ovaj tjedan (pon–ned) i ovaj mjesec. */
  today: number;
  week: number;
  month: number;
  /** Trenutno stanje = zadano stanje − potrošnja od tog dana; `null` bez stanja. */
  balance: number | null;
};

/** Pregled novca na dan `date` (koliko je ostalo, tjedni i mjesečni zbroj, stanje); broji se do `date`. */
export function moneySummary(entries: readonly Entry[], settings: MoneySettings, date: string): MoneySummary {
  const week = moneyWindow('week', date);
  const month = moneyWindow('month', date);
  // Do dana `date` uključivo: unos za budući dan još nije potrošnja.
  const spentIn = (window: { start: string; end: string } | null) =>
    window === null ? 0 : trackerTotal(entries, 'money', window.start, window.end < date ? window.end : date);
  let limit: MoneySummary['limit'] = null;
  if (settings.moneyLimitCents !== null && settings.moneyPeriod !== null) {
    const window = moneyWindow(settings.moneyPeriod, date);
    if (window !== null) {
      const spent = spentIn(window);
      limit = {
        period: settings.moneyPeriod,
        cents: settings.moneyLimitCents,
        spent,
        remaining: settings.moneyLimitCents - spent,
        ...window,
      };
    }
  }
  const balance =
    settings.moneyBalanceCents === null || settings.moneyBalanceOn === null
      ? null
      : settings.moneyBalanceCents -
        (settings.moneyBalanceOn > date ? 0 : trackerTotal(entries, 'money', settings.moneyBalanceOn, date));
  return {
    limit,
    today: trackerTotal(entries, 'money', date, date),
    week: spentIn(week),
    month: spentIn(month),
    balance,
  };
}

export type TrackerSettings = MoneySettings & {
  trackCalories: boolean;
  calorieGoal: number | null;
  trackMoney: boolean;
};

export type TrackerDay = {
  /** Zbroj kcal dana i cilj; `null` kad tracker nije uključen, nema cilja ili taj dan nema unosa. */
  calories: { total: number; goal: number } | null;
  /** Potrošnja dana i dnevni dio limita; `null` bez uključenog trackera, limita ili unosa taj dan. */
  money: { spent: number; dailyBudget: number } | null;
};

/**
 * Podaci trackera jednog dana za dnevni rezultat i dijagnozu (korak 31b). Ulaze samo uključeni
 * trackeri s ciljem/limitom i samo kad taj dan ima unosa („što se ne bilježi, ne ulazi“). Dnevni
 * dio limita = limit / broj dana razdoblja (tjedan 7, mjesec njegovi dani).
 */
export function trackerDay(entries: readonly Entry[], settings: TrackerSettings | null, date: string): TrackerDay {
  if (settings === null) return { calories: null, money: null };
  const has = (kind: TrackerKind) => entries.some((entry) => entry.kind === kind && entry.date === date);
  const calories =
    settings.trackCalories && settings.calorieGoal !== null && has('calories')
      ? { total: trackerTotal(entries, 'calories', date, date), goal: settings.calorieGoal }
      : null;
  let money: TrackerDay['money'] = null;
  if (settings.trackMoney && settings.moneyLimitCents !== null && settings.moneyPeriod !== null && has('money')) {
    const window = moneyWindow(settings.moneyPeriod, date);
    const days = window === null ? null : daysInclusive(window.start, window.end);
    if (days !== null) {
      money = { spent: trackerTotal(entries, 'money', date, date), dailyBudget: Math.round(settings.moneyLimitCents / days) };
    }
  }
  return { calories, money };
}

function daysInclusive(start: string, end: string): number | null {
  const from = Date.parse(`${start}T00:00:00Z`);
  const to = Date.parse(`${end}T00:00:00Z`);
  return Number.isNaN(from) || Number.isNaN(to) ? null : Math.round((to - from) / 86_400_000) + 1;
}
