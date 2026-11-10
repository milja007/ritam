import { describe, expect, it } from '@jest/globals';

import { ruleSchema, settingsSchema } from '../domain';
import {
  bedtimeFor,
  clampSleepHours,
  createDefaultDraft,
  emptyRule,
  isDraftComplete,
  isStepValid,
  MAX_RULES,
  shiftClock,
  splitHours,
  suggestNotificationTimes,
  toRuleInput,
  toSettingsInput,
  type OnboardingDraft,
} from './onboarding';

const base = {
  id: 'x',
  userId: 'u',
  createdAt: '2026-11-08T12:00:00.000Z',
  updatedAt: '2026-11-08T12:00:00.000Z',
};

const filled = (overrides: Partial<OnboardingDraft> = {}): OnboardingDraft => ({
  ...createDefaultDraft('hr'),
  rules: [{ title: 'Bez mobitela u krevetu', why: 'Bolji san', weight: 3 }],
  ...overrides,
});

describe('shiftClock', () => {
  it('pomiče unaprijed i unatrag', () => {
    expect(shiftClock('07:00', 15)).toBe('07:15');
    expect(shiftClock('07:00', -15)).toBe('06:45');
  });
  it('omata preko ponoći', () => {
    expect(shiftClock('23:45', 30)).toBe('00:15');
    expect(shiftClock('00:10', -15)).toBe('23:55');
    expect(shiftClock('12:00', -3 * 1440)).toBe('12:00');
  });
  it('odbija neispravan unos', () => {
    expect(shiftClock('24:00', 15)).toBeNull();
    expect(shiftClock('07:00', 1.5)).toBeNull();
  });
});

describe('bedtimeFor', () => {
  it('računa vrijeme kreveta iz buđenja i sati sna (primjer iz koncepta)', () => {
    expect(bedtimeFor('07:00', 8)).toBe('23:00');
  });
  it('radi preko ponoći i s četvrtinama sata', () => {
    expect(bedtimeFor('06:30', 7.5)).toBe('23:00');
    expect(bedtimeFor('09:00', 8.25)).toBe('00:45');
  });
  it('vraća null za neispravan unos', () => {
    expect(bedtimeFor('7h', 8)).toBeNull();
    expect(bedtimeFor('07:00', Number.NaN)).toBeNull();
  });
});

describe('clampSleepHours', () => {
  it('drži sate u [4, 12] i na 15 min', () => {
    expect(clampSleepHours(3)).toBe(4);
    expect(clampSleepHours(13)).toBe(12);
    expect(clampSleepHours(7.6)).toBe(7.5);
    expect(clampSleepHours(7.2)).toBe(7.25);
  });
});

describe('suggestNotificationTimes', () => {
  it('jutro = buđenje, večer = sat prije wind-downa', () => {
    // krevet 23:00, wind-down 22:15, upit 21:15
    expect(suggestNotificationTimes('07:00', 8)).toEqual({
      morningNotifTime: '07:00',
      eveningNotifTime: '21:15',
    });
  });
  it('normalizira "7:00" i radi preko ponoći', () => {
    expect(suggestNotificationTimes('7:00', 6, 30)).toEqual({
      morningNotifTime: '07:00',
      eveningNotifTime: '23:30',
    });
  });
});

describe('createDefaultDraft', () => {
  it('daje ispravne postavke bez zabrana (zabrane su neobavezne)', () => {
    const draft = createDefaultDraft('en');
    expect(draft.language).toBe('en');
    expect(draft.rules).toEqual([]);
    expect(draft.weekendWakeTime).toBe(draft.wakeTime);
    expect(isStepValid('language', draft)).toBe(true);
    expect(isStepValid('sleep', draft)).toBe(true);
    expect(isStepValid('notifications', draft)).toBe(true);
    expect(isStepValid('rules', draft)).toBe(true);
    expect(isStepValid('score', draft)).toBe(true);
  });
  it('jezik može pratiti uređaj', () => {
    const draft = createDefaultDraft('system');
    expect(isStepValid('language', draft)).toBe(true);
    expect(toSettingsInput(draft).language).toBe('system');
  });
});

describe('isStepValid', () => {
  it('san: odbija neispravno buđenje ili sate', () => {
    expect(isStepValid('sleep', filled({ wakeTime: '25:00' }))).toBe(false);
    expect(isStepValid('sleep', filled({ sleepHours: 3 }))).toBe(false);
    expect(isStepValid('sleep', filled({ sleepHours: 7.1 }))).toBe(false);
    expect(isStepValid('sleep', filled({ weekendWakeTime: '9:00' }))).toBe(false);
    expect(isStepValid('sleep', filled({ weekendWakeTime: '09:30' }))).toBe(true);
  });
  it('obavijesti: odbija neispravno vrijeme', () => {
    expect(isStepValid('notifications', filled({ eveningNotifTime: '9pm' }))).toBe(false);
    expect(isStepValid('notifications', filled({ sleepHours: 3 }))).toBe(true);
  });
  it('zabrane: 0–3, svaka s nazivom', () => {
    expect(isStepValid('rules', filled())).toBe(true);
    expect(isStepValid('rules', filled({ rules: [] }))).toBe(true);
    expect(isStepValid('rules', filled({ rules: [emptyRule()] }))).toBe(false);
    expect(isStepValid('rules', filled({ rules: [{ title: '   ', why: '', weight: 1 }] }))).toBe(false);
    const rule = { title: 'Bez šećera', why: '', weight: 1 as const };
    expect(isStepValid('rules', filled({ rules: Array(MAX_RULES).fill(rule) }))).toBe(true);
    expect(isStepValid('rules', filled({ rules: Array(MAX_RULES + 1).fill(rule) }))).toBe(false);
  });
});

describe('pretvorba', () => {
  it('toSettingsInput prolazi shemu settings', () => {
    const input = toSettingsInput(filled());
    expect(settingsSchema.parse({ ...input, ...base })).toMatchObject({
      language: 'hr',
      wakeTime: '07:00',
      sleepHours: 8,
      windDownMinutes: 45,
      theme: 'system',
      googleCalendarConnected: false,
      weekendWakeTime: null,
      morningNotifEnabled: true,
      eveningNotifEnabled: true,
      windDownNotifEnabled: true,
      blockRemindersEnabled: true,
      scorePlan: true,
      scoreRules: false,
      scoreSleep: false,
    });
  });
  it('područja rezultata: plan uvijek, zabrane i san opcionalni', () => {
    expect(isStepValid('score', filled({ scoreSleep: true }))).toBe(true);
    expect(toSettingsInput(filled({ scoreRules: true, scoreSleep: true }))).toMatchObject({
      scorePlan: true,
      scoreRules: true,
      scoreSleep: true,
    });
  });
  it('toSettingsInput: vikend buđenje se sprema samo kad se razlikuje', () => {
    expect(toSettingsInput(filled({ weekendWakeTime: '09:00' })).weekendWakeTime).toBe('09:00');
    expect(toSettingsInput(filled({ weekendWakeTime: '07:00' })).weekendWakeTime).toBeNull();
  });
  it('toRuleInput: svaki dan, cijeli dan, obrezan tekst', () => {
    const input = toRuleInput({ title: '  Bez kave poslije 14h ', why: ' San ', weight: 2 });
    expect(input).toEqual({
      title: 'Bez kave poslije 14h',
      icon: null,
      activeDays: [0, 1, 2, 3, 4, 5, 6],
      activeHours: null,
      why: 'San',
      weight: 2,
    });
    expect(ruleSchema.safeParse({ ...input, ...base }).success).toBe(true);
  });
  it('isDraftComplete', () => {
    expect(isDraftComplete(filled())).toBe(true);
    expect(isDraftComplete(createDefaultDraft('hr'))).toBe(true);
    expect(isDraftComplete(filled({ rules: [emptyRule()] }))).toBe(false);
  });
});

describe('splitHours', () => {
  it('rastavlja sate na sate i minute', () => {
    expect(splitHours(8)).toEqual({ hours: 8, minutes: 0 });
    expect(splitHours(7.5)).toEqual({ hours: 7, minutes: 30 });
    expect(splitHours(6.75)).toEqual({ hours: 6, minutes: 45 });
  });
});
