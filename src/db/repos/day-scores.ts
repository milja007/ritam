import { eq, inArray } from 'drizzle-orm';

import { dayStats } from '@/core/diagnosis';
import {
  checkinSchema,
  ruleLogSchema,
  ruleSchema,
  scheduleBlockSchema,
  selectedScoreAreas,
  settingsSchema,
  type LocalDate,
} from '@/core/domain';
import { isEveningCheckinComplete, mainStreak } from '@/core/gamification';
import { dayScore, type ScoredDay } from '@/core/progress';

import type { RitamDb } from '../db';
import { checkins, ruleLogs, rules, scheduleBlocks, settings } from '../schema';

export type DayScoreHistory = {
  /** Ocijenjeni dani uzlazno (dani bez ijednog dijela rezultata se izostavljaju). */
  days: ScoredDay[];
  longestStreak: number;
};

function groupByDate<T extends { date: string }>(rows: readonly T[]): Map<string, T[]> {
  const map = new Map<string, T[]>();
  for (const row of rows) {
    const list = map.get(row.date) ?? [];
    list.push(row);
    map.set(row.date, list);
  }
  return map;
}

/**
 * Dnevni rezultat (korak 16b) za svaki dan s ispunjenim večernjim upitom do `through` te za sam
 * `through` (dan upita) i kad upit još nije ispunjen — tada je rezultat "u tijeku"
 * (`final: false`). Dani bez ispunjenog upita ne ulaze: statusi blokova nisu potvrđeni.
 * Boduju se područja rezultata (korak 16c): zaključen dan prema snimci uz svoj večernji upit
 * (prošli dani zadrže staro bodovanje, P48), dan u tijeku prema trenutnim postavkama.
 * Jedno čitanje u transakciji; rezultat se ne sprema (izveden je, kao razina).
 */
export function listDayScores(db: RitamDb, userId: string, through: LocalDate): DayScoreHistory {
  return db.transaction((tx) => {
    const userCheckins = tx
      .select()
      .from(checkins)
      .where(eq(checkins.userId, userId))
      .all()
      .map((row) => checkinSchema.parse(row))
      .filter((checkin) => checkin.date <= through);
    const evenings = userCheckins.filter((checkin) => checkin.kind === 'evening');
    const complete = new Set(evenings.filter(isEveningCheckinComplete).map((checkin) => checkin.date));
    const dates = new Set([...complete, through]);

    const blocksByDate = groupByDate(
      tx
        .select()
        .from(scheduleBlocks)
        .where(eq(scheduleBlocks.userId, userId))
        .all()
        .map((row) => scheduleBlockSchema.parse(row))
        .filter((block) => dates.has(block.date)),
    );
    const userRules = tx
      .select()
      .from(rules)
      .where(eq(rules.userId, userId))
      .all()
      .map((row) => ruleSchema.parse(row));
    const logsByDate = groupByDate(
      userRules.length > 0
        ? tx
            .select()
            .from(ruleLogs)
            .where(
              inArray(
                ruleLogs.ruleId,
                userRules.map((rule) => rule.id),
              ),
            )
            .all()
            .map((row) => ruleLogSchema.parse(row))
            .filter((log) => dates.has(log.date))
        : [],
    );
    const checkinsByDate = groupByDate(userCheckins.filter((checkin) => dates.has(checkin.date)));
    const settingsRow = tx.select().from(settings).where(eq(settings.userId, userId)).get();
    const sleepSettings = settingsRow ? settingsSchema.parse(settingsRow) : null;
    // Trenutni odabir (prije onboardinga samo plan) vrijedi za dan u tijeku i za upite bez snimke.
    const currentAreas = sleepSettings ? selectedScoreAreas(sleepSettings) : (['plan'] as const);

    const days: ScoredDay[] = [];
    for (const date of [...dates].sort()) {
      const dayCheckins = checkinsByDate.get(date) ?? [];
      const stats = dayStats({
        date,
        blocks: blocksByDate.get(date) ?? [],
        items: [],
        rules: userRules,
        ruleLogs: logsByDate.get(date) ?? [],
        evening: dayCheckins.find((checkin) => checkin.kind === 'evening') ?? null,
        morning: dayCheckins.find((checkin) => checkin.kind === 'morning') ?? null,
        sleepSettings,
        xpEvents: [],
        streak: 0,
      });
      // Zaključen dan zadrži područja koja su tada vrijedila (P48).
      const evening = dayCheckins.find((checkin) => checkin.kind === 'evening');
      const { score } = dayScore(stats, evening?.scoreAreas ?? currentAreas);
      if (score !== null) days.push({ date, score, final: complete.has(date) });
    }
    return { days, longestStreak: mainStreak(evenings, through).longest };
  });
}
