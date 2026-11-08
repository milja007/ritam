import { and, asc, eq } from 'drizzle-orm';

import { ruleSchema, type Rule } from '@/core/domain';

import type { RitamDb } from '../db';
import { rules } from '../schema';
import { defaultRepoDeps, type RepoDeps } from './deps';

/** Polja zabrane koja zadaje korisnik (bez id-a, vlasnika i vremena). */
export type RuleInput = Omit<Rule, 'id' | 'userId' | 'createdAt' | 'updatedAt'>;

/** Gradi i validira novu zabranu (bez pisanja). Neispravan ulaz baca `ZodError`. */
export function buildRule(userId: string, input: RuleInput, deps: RepoDeps): Rule {
  const now = deps.now().toISOString();
  return ruleSchema.parse({ ...input, id: deps.newId(), userId, createdAt: now, updatedAt: now });
}

/** Stvara zabranu. Neispravan ulaz baca `ZodError` i ništa se ne zapisuje. */
export async function createRule(
  db: RitamDb,
  userId: string,
  input: RuleInput,
  deps: RepoDeps = defaultRepoDeps,
): Promise<Rule> {
  const rule = buildRule(userId, input, deps);
  await db.insert(rules).values(rule).run();
  return rule;
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
