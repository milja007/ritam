/**
 * Statistika jednog dana za lokalnu dnevnu dijagnozu (korak 16). Čista logika: bez React importa,
 * bez baze — repo skupi retke, ovdje se samo broji. Sve izvedeno iz postojećih tablica.
 */
import { sleepDurationMinutes, targetBedtimeFor, type MorningSleepSettings } from '../checkin/morning';
import type { Checkin, CheckinItem, Rule, RuleLog, ScheduleBlock, XpEvent } from '../domain';
import { bedtimeDeviationMinutes, BEDTIME_TOLERANCE_MINUTES, xpForDate } from '../gamification/xp';
import { parseClock } from '../time/clock';

export type DayStatsInput = {
  date: string;
  /** Blokovi tog dana (san se ne broji u plan). */
  blocks: readonly Pick<ScheduleBlock, 'id' | 'title' | 'kind' | 'status' | 'start'>[];
  /** Stavke večernjeg upita tog dana (komentari). */
  items: readonly Pick<CheckinItem, 'refId' | 'outcome' | 'comment'>[];
  rules: readonly Pick<Rule, 'id' | 'title' | 'weight'>[];
  /** Zapisi zabrana tog dana. */
  ruleLogs: readonly Pick<RuleLog, 'ruleId' | 'kept' | 'trigger'>[];
  evening: Pick<Checkin, 'dayRating' | 'note'> | null;
  morning: Pick<Checkin, 'sleepStart' | 'wakeTime'> | null;
  sleepSettings: MorningSleepSettings | null;
  xpEvents: readonly Pick<XpEvent, 'date' | 'amount'>[];
  /** Glavni streak na kraju tog dana. */
  streak: number;
};

export type PlanStats = {
  total: number;
  done: number;
  partial: number;
  /** Nije odrađeno (preskočeno ili premješteno). */
  missed: number;
  moved: number;
  /** Još bez ishoda (`planned`). */
  open: number;
  /** Udio odrađenog plana 0–1 (djelomično = pola), `null` bez plana. */
  rate: number | null;
};

export type BrokenRule = { title: string; weight: number; trigger: string | null };

export type RuleStats = { active: number; kept: number; broken: number; brokenRules: BrokenRule[] };

export type SleepStats = { minutes: number; onTarget: boolean | null };

export type ItemComment = { title: string; outcome: 'partial' | 'not'; comment: string };

export type MissedBlock = { title: string; start: string };

export type DayStats = {
  date: string;
  plan: PlanStats;
  rules: RuleStats;
  sleep: SleepStats | null;
  xp: number;
  rating: number | null;
  note: string | null;
  streak: number;
  comments: ItemComment[];
  /** Djelomično / nije odrađeni blokovi (za uzorke po dobu dana). */
  misses: MissedBlock[];
};

function planStats(blocks: DayStatsInput['blocks']): PlanStats {
  const planned = blocks.filter((block) => block.kind !== 'sleep');
  const count = (statuses: readonly string[]) =>
    planned.filter((block) => statuses.includes(block.status)).length;
  const total = planned.length;
  const done = count(['done']);
  const partial = count(['partial']);
  return {
    total,
    done,
    partial,
    missed: count(['skipped', 'moved']),
    moved: count(['moved']),
    open: count(['planned']),
    rate: total > 0 ? (done + partial / 2) / total : null,
  };
}

function ruleStats(rules: DayStatsInput['rules'], logs: DayStatsInput['ruleLogs']): RuleStats {
  const byId = new Map(rules.map((rule) => [rule.id, rule]));
  const known = logs.filter((log) => byId.has(log.ruleId));
  const brokenRules = known
    .filter((log) => !log.kept)
    .map((log) => {
      const rule = byId.get(log.ruleId);
      const trigger = log.trigger?.trim() ?? '';
      return { title: rule?.title ?? '', weight: rule?.weight ?? 1, trigger: trigger.length > 0 ? trigger : null };
    })
    .sort((a, b) => b.weight - a.weight);
  return {
    active: known.length,
    kept: known.filter((log) => log.kept).length,
    broken: brokenRules.length,
    brokenRules,
  };
}

function sleepStats(input: DayStatsInput): SleepStats | null {
  const { morning, sleepSettings, date } = input;
  if (!morning?.sleepStart || !morning.wakeTime) return null;
  const minutes = sleepDurationMinutes(morning.sleepStart, morning.wakeTime);
  if (minutes === null || minutes <= 0) return null;
  const target = sleepSettings ? targetBedtimeFor(sleepSettings, date) : null;
  const deviation = target === null ? null : bedtimeDeviationMinutes(target, morning.sleepStart);
  return { minutes, onTarget: deviation === null ? null : deviation <= BEDTIME_TOLERANCE_MINUTES };
}

export function dayStats(input: DayStatsInput): DayStats {
  const blocksById = new Map(input.blocks.map((block) => [block.id, block]));
  const comments: ItemComment[] = [];
  for (const item of input.items) {
    const block = item.refId === null ? undefined : blocksById.get(item.refId);
    const comment = item.comment?.trim() ?? '';
    if (block && item.outcome !== 'ok' && comment.length > 0) {
      comments.push({ title: block.title, outcome: item.outcome, comment });
    }
  }
  const misses = input.blocks
    .filter((block) => block.kind !== 'sleep' && ['partial', 'skipped', 'moved'].includes(block.status))
    .map((block) => ({ title: block.title, start: block.start }))
    .sort((a, b) => (parseClock(a.start) ?? 0) - (parseClock(b.start) ?? 0));
  const note = input.evening?.note?.trim() ?? '';

  return {
    date: input.date,
    plan: planStats(input.blocks),
    rules: ruleStats(input.rules, input.ruleLogs),
    sleep: sleepStats(input),
    xp: xpForDate(input.xpEvents, input.date),
    rating: input.evening?.dayRating ?? null,
    note: note.length > 0 ? note : null,
    streak: input.streak,
    comments,
    misses,
  };
}

/**
 * Jednostavna mjera dana za trend naspram jučer: odrađeni plan (djelomično = pola) i poštovane
 * zabrane kroz sve stavke. `null` kad nema ni plana ni zabrana. Korak 16b ju zamjenjuje
 * pravim dnevnim rezultatom 0–100.
 */
export function dayBalance(stats: Pick<DayStats, 'plan' | 'rules'>): number | null {
  const total = stats.plan.total + stats.rules.active;
  if (total === 0) return null;
  return (stats.plan.done + stats.plan.partial / 2 + stats.rules.kept) / total;
}
