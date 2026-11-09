/**
 * @jest-environment node
 */
import { describe, expect, it } from '@jest/globals';
import { ZodError } from 'zod';

import { createDefaultDraft, type OnboardingDraft } from '@/core/onboarding';

import {
  completeOnboarding,
  createRule,
  getRule,
  getSettings,
  IncompleteOnboardingError,
  listRules,
  type RuleInput,
} from './repos';
import { createTestDb, testDeps } from './testing/test-db';

const USER = 'user-1';

const draft = (overrides: Partial<OnboardingDraft> = {}): OnboardingDraft => ({
  ...createDefaultDraft('hr'),
  rules: [
    { title: 'Bez mobitela u krevetu', why: 'Bolji san', weight: 3 },
    { title: 'Bez kave poslije 14h', why: '', weight: 1 },
  ],
  ...overrides,
});

const ruleInput: RuleInput = {
  title: 'Bez šećera',
  icon: null,
  activeDays: [1, 2, 3, 4, 5],
  activeHours: { start: '22:00', end: '02:00' },
  why: 'Energija',
  weight: 2,
};

describe('rules repo', () => {
  it('stvara, čita i lista zabrane po korisniku', async () => {
    const { db } = await createTestDb();
    const deps = testDeps();
    const a = await createRule(db, USER, ruleInput, deps);
    const b = await createRule(db, USER, { ...ruleInput, title: 'Drugo', activeHours: null }, deps);
    await createRule(db, 'user-2', ruleInput, deps);
    expect(await getRule(db, USER, a.id)).toEqual(a);
    expect(await getRule(db, 'user-2', a.id)).toBeNull();
    expect(await listRules(db, USER)).toEqual([a, b]);
  });

  it('odbija neispravnu zabranu i ništa ne piše', async () => {
    const { db } = await createTestDb();
    await expect(createRule(db, USER, { ...ruleInput, title: ' ' })).rejects.toBeInstanceOf(ZodError);
    await expect(createRule(db, USER, { ...ruleInput, activeDays: [] })).rejects.toBeInstanceOf(ZodError);
    expect(await listRules(db, USER)).toEqual([]);
  });
});

describe('completeOnboarding', () => {
  it('sprema postavke i zabrane', async () => {
    const { db } = await createTestDb();
    const result = completeOnboarding(db, USER, draft(), testDeps());
    expect(await getSettings(db, USER)).toEqual(result.settings);
    expect(result.settings).toMatchObject({
      language: 'hr',
      wakeTime: '07:00',
      sleepHours: 8,
      morningNotifTime: '07:00',
      eveningNotifTime: '21:15',
      windDownMinutes: 45,
    });
    const saved = await listRules(db, USER);
    expect(saved).toEqual(result.rules);
    expect(saved.map((rule) => rule.title)).toEqual(['Bez mobitela u krevetu', 'Bez kave poslije 14h']);
    expect(saved[0]).toMatchObject({ activeDays: [0, 1, 2, 3, 4, 5, 6], activeHours: null, weight: 3 });
  });

  it('odbija nepotpun nacrt i ništa ne piše', async () => {
    const { db } = await createTestDb();
    expect(() => completeOnboarding(db, USER, draft({ rules: [{ title: ' ', why: '', weight: 2 }] }), testDeps())).toThrow(
      IncompleteOnboardingError,
    );
    expect(() => completeOnboarding(db, USER, draft({ wakeTime: '25:00' }), testDeps())).toThrow(
      IncompleteOnboardingError,
    );
    expect(await getSettings(db, USER)).toBeNull();
    expect(await listRules(db, USER)).toEqual([]);
  });

  it('je sve ili ništa: greška pri pisanju zabrane vraća i postavke', async () => {
    const { db } = await createTestDb();
    // Isti id za sve → druga zabrana krši primarni ključ usred transakcije.
    const clashing = { newId: () => 'isti-id', now: () => new Date('2026-11-08T12:00:00.000Z') };
    expect(() => completeOnboarding(db, USER, draft(), clashing)).toThrow();
    expect(await getSettings(db, USER)).toBeNull();
    expect(await listRules(db, USER)).toEqual([]);
  });

  it('ponovni onboarding ažurira postojeće postavke (isti id)', async () => {
    const { db } = await createTestDb();
    const deps = testDeps();
    const first = completeOnboarding(db, USER, draft(), deps);
    const second = completeOnboarding(db, USER, draft({ language: 'en', wakeTime: '06:30' }), deps);
    expect(second.settings.id).toBe(first.settings.id);
    expect(second.settings.createdAt).toBe(first.settings.createdAt);
    expect(await getSettings(db, USER)).toMatchObject({ language: 'en', wakeTime: '06:30' });
  });
});
