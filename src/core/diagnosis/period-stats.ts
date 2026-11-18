/**
 * Statistika razdoblja (tjedan, kasnije mjesec) za lokalnu dijagnozu: zbroj statistika zaključenih
 * dana razdoblja. Čista logika, bez React importa i bez baze — repo skupi dane, ovdje se broji.
 * Ulaze samo dani s ispunjenim večernjim upitom (kao i dnevni rezultat): bez njega statusi blokova
 * nisu potvrđeni.
 */
import { parseClock } from '../time/clock';
import { CALORIE_TOLERANCE } from '../trackers/trackers';
import { SHORT_SLEEP_MINUTES } from './day-diagnosis';
import type { DayStats } from './day-stats';

/** Zaključen dan razdoblja: statistika (već svedena na praćena područja) i dnevni rezultat. */
export type PeriodDay = { stats: DayStats; score: number | null };

export type DayPart = 'morning' | 'afternoon' | 'evening';

const MORNING_UNTIL_MINUTES = 12 * 60;
const EVENING_FROM_MINUTES = 17 * 60;
const MAX_PERIOD_COMMENTS = 6;

export type RuleSummary = {
  title: string;
  weight: number;
  /** Koliko je puta prekršena u razdoblju. */
  broken: number;
  /** Zapisani okidači, najčešći prvi (bez ponavljanja). */
  triggers: string[];
};

export type PeriodComment = { date: string; title: string; outcome: 'partial' | 'not'; comment: string };

export type PeriodStats = {
  start: string;
  end: string;
  /** Broj kalendarskih dana razdoblja. */
  length: number;
  /** Zaključeni dani (ispunjen večernji upit), uzlazno. */
  dates: string[];
  recorded: number;
  /** Prosjek dnevnih rezultata, zaokružen; `null` bez ijednog rezultata. */
  average: number | null;
  best: { date: string; score: number } | null;
  /** Najslabiji dan; `null` kad nema barem dva različita rezultata. */
  worst: { date: string; score: number } | null;
  plan: { total: number; done: number; partial: number; missed: number; moved: number; rate: number | null };
  rules: { active: number; kept: number; broken: number; byRule: RuleSummary[] };
  sleep: {
    nights: number;
    averageMinutes: number;
    shortNights: number;
    /** Noći s krevetom unutar tolerancije / noći s postavljenim ciljem. */
    onTarget: number;
    withTarget: number;
  } | null;
  xp: number;
  rating: { average: number; count: number } | null;
  gaveUpDays: number;
  /** Djelomično i neodrađeni blokovi po dobu dana. */
  misses: Record<DayPart, number>;
  /** Isti naslov propušten barem dvaput, najčešći prvi. */
  repeatedMisses: { title: string; count: number }[];
  comments: PeriodComment[];
  /** Prosjek rezultata nakon kratkog sna naspram ostalih dana; `null` bez obje skupine. */
  shortSleepEffect: { shortAverage: number; restAverage: number } | null;
  /**
   * Kalorije (korak 31c): samo dani s unosom (uključen tracker s ciljem) — koliko ih je bilo
   * unutar cilja (±10 %), iznad i ispod. `null` kad nijedan dan nema unosa. Stara spremljena
   * statistika nema polje.
   */
  calories?: { days: number; within: number; over: number; under: number } | null;
  /**
   * Potrošnja dana s unosom naspram zbroja dnevnih dijelova limita tih dana (centi) i koliko je
   * dana bilo iznad svog dijela. `null` bez ijednog dana s unosom.
   */
  money?: { days: number; spentCents: number; budgetCents: number; overDays: number } | null;
};

const mean = (values: readonly number[]): number | null =>
  values.length === 0 ? null : values.reduce((sum, value) => sum + value, 0) / values.length;

const roundedMean = (values: readonly number[]): number | null => {
  const value = mean(values);
  return value === null ? null : Math.round(value);
};

export function dayPartOf(start: string): DayPart | null {
  const minutes = parseClock(start);
  if (minutes === null) return null;
  if (minutes < MORNING_UNTIL_MINUTES) return 'morning';
  return minutes >= EVENING_FROM_MINUTES ? 'evening' : 'afternoon';
}

/** Vrijednosti poredane po učestalosti (najčešća prva), kod izjednačenja po prvom pojavljivanju. */
function byFrequency(values: readonly string[]): { value: string; count: number }[] {
  const counts = new Map<string, { value: string; count: number; first: number }>();
  values.forEach((raw, index) => {
    const key = raw.trim().toLocaleLowerCase();
    if (key.length === 0) return;
    const entry = counts.get(key);
    if (entry) entry.count += 1;
    else counts.set(key, { value: raw.trim(), count: 1, first: index });
  });
  return [...counts.values()]
    .sort((a, b) => b.count - a.count || a.first - b.first)
    .map(({ value, count }) => ({ value, count }));
}

/**
 * Statistika razdoblja `start`–`end` (uključivo, `length` dana). Dani izvan razdoblja se
 * zanemaruju, a isti dan dvaput → vrijedi zadnji.
 */
export function periodStats(start: string, end: string, length: number, input: readonly PeriodDay[]): PeriodStats {
  const byDate = new Map<string, PeriodDay>();
  for (const day of input) {
    if (day.stats.date >= start && day.stats.date <= end) byDate.set(day.stats.date, day);
  }
  const days = [...byDate.values()].sort((a, b) => a.stats.date.localeCompare(b.stats.date));

  const scored = days.flatMap((day) => (day.score === null ? [] : [{ date: day.stats.date, score: day.score }]));
  let best: PeriodStats['best'] = null;
  let worst: PeriodStats['worst'] = null;
  for (const day of scored) {
    if (best === null || day.score > best.score) best = day;
    if (worst === null || day.score < worst.score) worst = day;
  }
  if (best === null || worst === null || worst.score === best.score) worst = null;

  const sum = (pick: (stats: DayStats) => number) => days.reduce((total, day) => total + pick(day.stats), 0);
  const planTotal = sum((stats) => stats.plan.total);
  const planDone = sum((stats) => stats.plan.done);
  const planPartial = sum((stats) => stats.plan.partial);

  const ruleMap = new Map<string, { title: string; weight: number; broken: number; triggers: string[] }>();
  for (const day of days) {
    for (const rule of day.stats.rules.brokenRules) {
      const entry = ruleMap.get(rule.title) ?? { title: rule.title, weight: rule.weight, broken: 0, triggers: [] };
      entry.broken += 1;
      entry.weight = Math.max(entry.weight, rule.weight);
      if (rule.trigger !== null) entry.triggers.push(rule.trigger);
      ruleMap.set(rule.title, entry);
    }
  }
  const byRule = [...ruleMap.values()]
    .map((rule) => ({ ...rule, triggers: byFrequency(rule.triggers).map((trigger) => trigger.value) }))
    .sort((a, b) => b.broken - a.broken || b.weight - a.weight || a.title.localeCompare(b.title));

  const nights = days.flatMap((day) => (day.stats.sleep ? [day.stats.sleep] : []));
  const sleepAverage = roundedMean(nights.map((night) => night.minutes));

  const ratings = days.flatMap((day) => (day.stats.rating === null ? [] : [day.stats.rating]));
  const ratingMean = mean(ratings);

  const misses: Record<DayPart, number> = { morning: 0, afternoon: 0, evening: 0 };
  const missedTitles: string[] = [];
  for (const day of days) {
    for (const miss of day.stats.misses) {
      const part = dayPartOf(miss.start);
      if (part !== null) misses[part] += 1;
      missedTitles.push(miss.title);
    }
  }

  const comments: PeriodComment[] = days
    .flatMap((day) => day.stats.comments.map((comment) => ({ date: day.stats.date, ...comment })))
    .slice(0, MAX_PERIOD_COMMENTS);

  const isShort = (day: PeriodDay) => day.stats.sleep !== null && day.stats.sleep.minutes < SHORT_SLEEP_MINUTES;
  const withSleepAndScore = days.filter((day) => day.stats.sleep !== null && day.score !== null);
  const shortAverage = roundedMean(withSleepAndScore.filter(isShort).map((day) => day.score ?? 0));
  const restAverage = roundedMean(withSleepAndScore.filter((day) => !isShort(day)).map((day) => day.score ?? 0));

  const calorieDays = days.flatMap((day) => (day.stats.calories ? [day.stats.calories] : []));
  const calorieStatus = (c: { total: number; goal: number }) =>
    Math.abs(c.total - c.goal) <= c.goal * CALORIE_TOLERANCE ? 'within' : c.total > c.goal ? 'over' : 'under';
  const moneyDays = days.flatMap((day) => (day.stats.money ? [day.stats.money] : []));

  return {
    start,
    end,
    length,
    dates: days.map((day) => day.stats.date),
    recorded: days.length,
    average: roundedMean(scored.map((day) => day.score)),
    best,
    worst,
    plan: {
      total: planTotal,
      done: planDone,
      partial: planPartial,
      missed: sum((stats) => stats.plan.missed),
      moved: sum((stats) => stats.plan.moved),
      rate: planTotal > 0 ? (planDone + planPartial / 2) / planTotal : null,
    },
    rules: {
      active: sum((stats) => stats.rules.active),
      kept: sum((stats) => stats.rules.kept),
      broken: sum((stats) => stats.rules.broken),
      byRule,
    },
    sleep:
      sleepAverage === null
        ? null
        : {
            nights: nights.length,
            averageMinutes: sleepAverage,
            shortNights: nights.filter((night) => night.minutes < SHORT_SLEEP_MINUTES).length,
            onTarget: nights.filter((night) => night.onTarget === true).length,
            withTarget: nights.filter((night) => night.onTarget !== null).length,
          },
    xp: sum((stats) => stats.xp),
    rating: ratingMean === null ? null : { average: Math.round(ratingMean * 10) / 10, count: ratings.length },
    gaveUpDays: days.filter((day) => day.stats.gaveUp === true).length,
    misses,
    repeatedMisses: byFrequency(missedTitles)
      .filter((entry) => entry.count >= 2)
      .map((entry) => ({ title: entry.value, count: entry.count })),
    comments,
    shortSleepEffect:
      shortAverage === null || restAverage === null ? null : { shortAverage, restAverage },
    calories:
      calorieDays.length === 0
        ? null
        : {
            days: calorieDays.length,
            within: calorieDays.filter((c) => calorieStatus(c) === 'within').length,
            over: calorieDays.filter((c) => calorieStatus(c) === 'over').length,
            under: calorieDays.filter((c) => calorieStatus(c) === 'under').length,
          },
    money:
      moneyDays.length === 0
        ? null
        : {
            days: moneyDays.length,
            spentCents: moneyDays.reduce((total, m) => total + m.spent, 0),
            budgetCents: moneyDays.reduce((total, m) => total + m.dailyBudget, 0),
            overDays: moneyDays.filter((m) => m.spent > m.dailyBudget).length,
          },
  };
}
