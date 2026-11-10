/**
 * Onboarding (prvo pokretanje): nacrt koji korisnik ispunjava korak po korak,
 * validacija po koraku i pretvorba u ulaz za `settings` i `rules`.
 * Čista logika: bez React importa.
 */
import {
  DEFAULT_SCORE_AREAS,
  ruleSchema,
  settingsSchema,
  type Rule,
  type RuleWeight,
  type Settings,
} from '../domain';
import type { LanguagePreference } from '../i18n/language';
import { formatClock, MINUTES_PER_DAY, parseClock } from '../time/clock';

/**
 * Redoslijed koraka (koncept: jezik → buđenje i san → obavijesti → 0–3 zabrane), na kraju izbor
 * područja dnevnog rezultata (odluka P39).
 */
export const ONBOARDING_STEPS = ['language', 'sleep', 'notifications', 'rules', 'score'] as const;
export type OnboardingStep = (typeof ONBOARDING_STEPS)[number];

/** Zabrane su neobavezne u onboardingu (Bornova odluka: 0–3). */
export const MIN_RULES = 0;
export const MAX_RULES = 3;

/** Korak stepera za vremena i sate sna (koncept: postupni pomaci po 15 min). */
export const TIME_STEP_MINUTES = 15;
export const MIN_SLEEP_HOURS = 4;
export const MAX_SLEEP_HOURS = 12;

/** Zadani wind-down (koncept: 30–60 min prije spavanja). */
export const DEFAULT_WIND_DOWN_MINUTES = 45;
/** Koliko prije wind-downa stiže večernji upit (koncept: upit je namjerno *prije* wind-downa). */
export const EVENING_BEFORE_WIND_DOWN_MINUTES = 60;

export type RuleDraft = {
  title: string;
  why: string;
  weight: RuleWeight;
};

export type OnboardingDraft = {
  language: LanguagePreference;
  wakeTime: string;
  /** Buđenje vikendom; isto kao `wakeTime` dok ga korisnik ne promijeni (sprema se kao `null`). */
  weekendWakeTime: string;
  sleepHours: number;
  morningNotifTime: string;
  eveningNotifTime: string;
  rules: RuleDraft[];
  /** Područja dnevnog rezultata: plan uvijek, zabrane i san opcionalni (zadano isključeni). */
  scorePlan: true;
  scoreRules: boolean;
  scoreSleep: boolean;
};

export type SettingsInput = Omit<Settings, 'id' | 'userId' | 'createdAt' | 'updatedAt'>;
export type RuleInput = Omit<Rule, 'id' | 'userId' | 'createdAt' | 'updatedAt'>;

const ALL_WEEKDAYS = [0, 1, 2, 3, 4, 5, 6];

function wrap(minutes: number): number {
  return ((minutes % MINUTES_PER_DAY) + MINUTES_PER_DAY) % MINUTES_PER_DAY;
}

/** Pomak vremena "HH:MM" za `deltaMinutes` uz omatanje preko ponoći. Neispravan unos → `null`. */
export function shiftClock(time: string, deltaMinutes: number): string | null {
  const minutes = parseClock(time);
  if (minutes === null || !Number.isInteger(deltaMinutes)) return null;
  return formatClock(wrap(minutes + deltaMinutes));
}

/** Vrijeme odlaska u krevet = buđenje − sati sna (npr. 07:00 i 8 h → 23:00). */
export function bedtimeFor(wakeTime: string, sleepHours: number): string | null {
  if (!Number.isFinite(sleepHours)) return null;
  return shiftClock(wakeTime, -Math.round(sleepHours * 60));
}

/** Sati sna ograničeni na [4, 12] i zaokruženi na 15 min. */
export function clampSleepHours(hours: number): number {
  const quarters = Math.round(hours * 4) / 4;
  return Math.min(MAX_SLEEP_HOURS, Math.max(MIN_SLEEP_HOURS, quarters));
}

/** Prijedlog vremena obavijesti: jutarnja u vrijeme buđenja, večernja sat prije wind-downa. */
export function suggestNotificationTimes(
  wakeTime: string,
  sleepHours: number,
  windDownMinutes: number = DEFAULT_WIND_DOWN_MINUTES,
): { morningNotifTime: string; eveningNotifTime: string } | null {
  const morning = shiftClock(wakeTime, 0);
  const bedtime = bedtimeFor(wakeTime, sleepHours);
  if (morning === null || bedtime === null) return null;
  const evening = shiftClock(bedtime, -(windDownMinutes + EVENING_BEFORE_WIND_DOWN_MINUTES));
  if (evening === null) return null;
  return { morningNotifTime: morning, eveningNotifTime: evening };
}

export function createDefaultDraft(language: LanguagePreference): OnboardingDraft {
  const wakeTime = '07:00';
  const sleepHours = 8;
  const times = suggestNotificationTimes(wakeTime, sleepHours) ?? {
    morningNotifTime: '07:00',
    eveningNotifTime: '21:15',
  };
  return {
    language,
    wakeTime,
    weekendWakeTime: wakeTime,
    sleepHours,
    ...times,
    rules: [],
    ...DEFAULT_SCORE_AREAS,
  };
}

export function emptyRule(): RuleDraft {
  return { title: '', why: '', weight: 2 };
}

/** Zabrana iz onboardinga vrijedi svaki dan, cijeli dan (detaljno uređivanje dolazi kasnije). */
export function toRuleInput(rule: RuleDraft): RuleInput {
  return {
    title: rule.title.trim(),
    icon: null,
    activeDays: [...ALL_WEEKDAYS],
    activeHours: null,
    why: rule.why.trim(),
    weight: rule.weight,
  };
}

export function toSettingsInput(draft: OnboardingDraft): SettingsInput {
  return {
    language: draft.language,
    wakeTime: draft.wakeTime,
    weekendWakeTime: draft.weekendWakeTime === draft.wakeTime ? null : draft.weekendWakeTime,
    sleepHours: draft.sleepHours,
    morningNotifTime: draft.morningNotifTime,
    eveningNotifTime: draft.eveningNotifTime,
    windDownMinutes: DEFAULT_WIND_DOWN_MINUTES,
    morningNotifEnabled: true,
    eveningNotifEnabled: true,
    windDownNotifEnabled: true,
    theme: 'system',
    googleCalendarConnected: false,
    scorePlan: draft.scorePlan,
    scoreRules: draft.scoreRules,
    scoreSleep: draft.scoreSleep,
  };
}

const PLACEHOLDER_BASE = {
  id: 'draft',
  userId: 'draft',
  createdAt: '2000-01-01T00:00:00.000Z',
  updatedAt: '2000-01-01T00:00:00.000Z',
};

export function isRuleDraftValid(rule: RuleDraft): boolean {
  return ruleSchema.safeParse({ ...toRuleInput(rule), ...PLACEHOLDER_BASE }).success;
}

/** Je li korak ispunjen tako da se smije dalje. */
export function isStepValid(step: OnboardingStep, draft: OnboardingDraft): boolean {
  const settings = settingsSchema.safeParse({ ...toSettingsInput(draft), ...PLACEHOLDER_BASE });
  const issuePaths = settings.success ? [] : settings.error.issues.map((issue) => issue.path[0]);
  switch (step) {
    case 'language':
      return !issuePaths.includes('language');
    case 'sleep':
      return (
        !issuePaths.includes('wakeTime') &&
        !issuePaths.includes('weekendWakeTime') &&
        !issuePaths.includes('sleepHours')
      );
    case 'notifications':
      return !issuePaths.includes('morningNotifTime') && !issuePaths.includes('eveningNotifTime');
    case 'rules':
      return (
        draft.rules.length >= MIN_RULES &&
        draft.rules.length <= MAX_RULES &&
        draft.rules.every(isRuleDraftValid)
      );
    case 'score':
      // Plan je uvijek uključen; zabrane i san su slobodan izbor.
      return true;
  }
}

export function isDraftComplete(draft: OnboardingDraft): boolean {
  return ONBOARDING_STEPS.every((step) => isStepValid(step, draft));
}

/** 7.5 → { hours: 7, minutes: 30 } (za prikaz sati sna). */
export function splitHours(value: number): { hours: number; minutes: number } {
  const total = Math.round(value * 60);
  return { hours: Math.floor(total / 60), minutes: total % 60 };
}
