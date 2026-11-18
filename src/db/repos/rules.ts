import { and, asc, eq, inArray } from 'drizzle-orm';

import { MAX_RULES_PER_PERIOD, ruleLogSchema, ruleSchema, type Rule, type RuleLog } from '@/core/domain';

import type { RitamDb } from '../db';
import { ruleLogs, rules } from '../schema';
import { defaultRepoDeps, type RepoDeps } from './deps';

/** Razdoblje već ima `MAX_RULES_PER_PERIOD` zabrana — UI to javlja korisniku. */
export class RuleLimitError extends Error {
  constructor() {
    super('Too many rules in this period');
    this.name = 'RuleLimitError';
  }
}

/** Zabrana ima zapise („Držao sam se“ / „Prekršio sam“) — brisanje bi izbrisalo njezinu povijest. */
export class RuleHasHistoryError extends Error {
  constructor() {
    super('Rule has logs');
    this.name = 'RuleHasHistoryError';
  }
}

/** Polja zabrane koja zadaje korisnik (bez id-a, vlasnika i vremena). */
export type RuleInput = Omit<Rule, 'id' | 'userId' | 'createdAt' | 'updatedAt'>;

/** Gradi i validira novu zabranu (bez pisanja). Neispravan ulaz baca `ZodError`. */
export function buildRule(userId: string, input: RuleInput, deps: RepoDeps): Rule {
  const now = deps.now().toISOString();
  return ruleSchema.parse({ ...input, id: deps.newId(), userId, createdAt: now, updatedAt: now });
}

/**
 * Stvara zabranu. Neispravan ulaz baca `ZodError`; razdoblje (tjedan/mjesec/godina) s već
 * `MAX_RULES_PER_PERIOD` zabrana baca `RuleLimitError`. Kad baci, ništa se ne zapisuje.
 */
export async function createRule(
  db: RitamDb,
  userId: string,
  input: RuleInput,
  deps: RepoDeps = defaultRepoDeps,
): Promise<Rule> {
  const rule = buildRule(userId, input, deps);
  return db.transaction((tx) => {
    if (rule.period !== null && rule.periodStart !== null) {
      const count = tx
        .select({ id: rules.id })
        .from(rules)
        .where(and(eq(rules.userId, userId), eq(rules.period, rule.period), eq(rules.periodStart, rule.periodStart)))
        .all().length;
      if (count >= MAX_RULES_PER_PERIOD) throw new RuleLimitError();
    }
    tx.insert(rules).values(rule).run();
    return rule;
  });
}

/** Zapisi zabrana (svi dani) za zadane zabrane, uzlazno po datumu — izvor niza po zabrani. */
export async function listRuleLogs(db: RitamDb, userId: string, ruleIds: readonly string[]): Promise<RuleLog[]> {
  if (ruleIds.length === 0) return [];
  const rows = await db
    .select()
    .from(ruleLogs)
    .where(and(eq(ruleLogs.userId, userId), inArray(ruleLogs.ruleId, [...ruleIds])))
    .orderBy(asc(ruleLogs.date))
    .all();
  return rows.map((row) => ruleLogSchema.parse(row));
}

/**
 * Briše zabranu bez povijesti (npr. krivo upisanu). Zabrana sa zapisima baca `RuleHasHistoryError`
 * i ostaje — njezini zapisi ulaze u rezultate i dijagnoze prošlih dana. Vraća je li obrisana.
 */
export async function deleteRule(db: RitamDb, userId: string, id: string): Promise<boolean> {
  return db.transaction((tx) => {
    const logs = tx
      .select({ id: ruleLogs.id })
      .from(ruleLogs)
      .where(and(eq(ruleLogs.userId, userId), eq(ruleLogs.ruleId, id)))
      .limit(1)
      .all();
    if (logs.length > 0) throw new RuleHasHistoryError();
    return tx.delete(rules).where(and(eq(rules.userId, userId), eq(rules.id, id))).run().changes > 0;
  });
}

/** Zabrane korisnika redom kojim su stvorene. */
export async function listRules(db: RitamDb, userId: string): Promise<Rule[]> {
  const rows = await db
    .select()
    .from(rules)
    .where(eq(rules.userId, userId))
    .orderBy(asc(rules.createdAt), asc(rules.id))
    .all();
  return rows.map((row) => ruleSchema.parse(row));
}

export async function getRule(db: RitamDb, userId: string, id: string): Promise<Rule | null> {
  const row = await db
    .select()
    .from(rules)
    .where(and(eq(rules.userId, userId), eq(rules.id, id)))
    .get();
  return row ? ruleSchema.parse(row) : null;
}
