import { eq } from 'drizzle-orm';

import { settingsSchema, type Rule, type Settings } from '@/core/domain';
import {
  isDraftComplete,
  toRuleInput,
  toSettingsInput,
  type OnboardingDraft,
} from '@/core/onboarding';

import type { RitamDb } from '../db';
import { rules, settings } from '../schema';
import { defaultRepoDeps, type RepoDeps } from './deps';
import { buildRule } from './rules';

export class IncompleteOnboardingError extends Error {
  constructor() {
    super('Onboarding draft is incomplete');
    this.name = 'IncompleteOnboardingError';
  }
}

/**
 * Završava onboarding: u jednoj transakciji sprema postavke (upsert) i 1–3 zabrane.
 * Sve ili ništa — ako bilo što ne prođe validaciju ili pisanje, baza ostaje nepromijenjena.
 */
export function completeOnboarding(
  db: RitamDb,
  userId: string,
  draft: OnboardingDraft,
  deps: RepoDeps = defaultRepoDeps,
): { settings: Settings; rules: Rule[] } {
  if (!isDraftComplete(draft)) throw new IncompleteOnboardingError();

  // Validacija prije transakcije: neispravan ulaz ne otvara ni ne piše ništa.
  const newRules = draft.rules.map((rule) => buildRule(userId, toRuleInput(rule), deps));
  const now = deps.now().toISOString();

  // Drizzle expo-sqlite driver je sinkron: callback transakcije mora biti sinkron.
  return db.transaction((tx) => {
    const existing = tx.select().from(settings).where(eq(settings.userId, userId)).get();
    const nextSettings = settingsSchema.parse({
      ...toSettingsInput(draft),
      id: existing?.id ?? deps.newId(),
      userId,
      createdAt: existing?.createdAt ?? now,
      updatedAt: now,
    });
    if (existing) {
      const { id, userId: _owner, createdAt: _created, ...changes } = nextSettings;
      tx.update(settings).set(changes).where(eq(settings.id, id)).run();
    } else {
      tx.insert(settings).values(nextSettings).run();
    }
    for (const rule of newRules) tx.insert(rules).values(rule).run();
    return { settings: nextSettings, rules: newRules };
  });
}
