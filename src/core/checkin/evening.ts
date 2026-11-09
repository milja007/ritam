/**
 * Večernji upit (checklist): koraci, nacrt odgovora, validacija, statusi blokova i XP.
 * Čista logika: bez React importa, bez pisanja u bazu (to radi `saveEveningCheckin`).
 * Koncept: checklist dana (U redu / Nije + komentar) → zabrane (Držao sam se / Prekršio sam
 * + okidač) → ocjena dana 1–5 + rečenica. XP po akcijama, bez kazni.
 */
import type { BlockStatus, Checkin, CheckinItem, Rule, RuleLog, ScheduleBlock } from '../domain';
import { isValidLocalDate, noteSchema, rating1to5Schema } from '../domain/common';
import {
  xpForEveningCheckin,
  xpForRuleKept,
  xpForTaskDone,
  type TaskDifficulty,
  type XpAward,
} from '../gamification/xp';

export const EVENING_STEPS = ['checklist', 'rules', 'rating'] as const;
export type EveningStep = (typeof EVENING_STEPS)[number];

export type ChecklistAnswer = {
  blockId: string;
  /** `true` = U redu, `false` = Nije, `null` = još bez odgovora. */
  ok: boolean | null;
  /** Komentar za "Nije" (za "U redu" se ne sprema). */
  comment: string;
};

export type RuleAnswer = {
  ruleId: string;
  /** `true` = Držao sam se, `false` = Prekršio sam, `null` = još bez odgovora. */
  kept: boolean | null;
  /** Okidač prekršaja (za "Držao sam se" se ne sprema). */
  trigger: string;
};

export type EveningDraft = {
  items: ChecklistAnswer[];
  rules: RuleAnswer[];
  rating: number | null;
  note: string;
};

/** Spremljeni upit jednog dana (za ponovno otvaranje). */
export type SavedEveningCheckin = {
  checkin: Checkin;
  items: CheckinItem[];
  ruleLogs: RuleLog[];
};

/**
 * Težina zadatka za XP dok blokovi nemaju težinu (zadaci s težinom dolaze s tjednim zadacima).
 * Najniža razina — XP raste polako ("malo po malo").
 */
export const DEFAULT_TASK_DIFFICULTY: TaskDifficulty = 'easy';

/** Stavke checkliste: svi blokovi dana osim sna, redom timelinea. */
export function checklistBlocks<T extends Pick<ScheduleBlock, 'kind'>>(blocks: readonly T[]): T[] {
  return blocks.filter((block) => block.kind !== 'sleep');
}

/** Dan u tjednu za "YYYY-MM-DD" (0 = nedjelja … 6 = subota), `null` za neispravan datum. */
export function weekdayOf(date: string): number | null {
  if (!isValidLocalDate(date)) return null;
  const [y, m, d] = date.split('-').map(Number);
  return new Date(Date.UTC(y ?? 0, (m ?? 1) - 1, d ?? 1)).getUTCDay();
}

/** Zabrane koje vrijede na zadani dan (po `activeDays`). */
export function rulesActiveOn<T extends Pick<Rule, 'activeDays'>>(rules: readonly T[], date: string): T[] {
  const weekday = weekdayOf(date);
  if (weekday === null) return [];
  return rules.filter((rule) => rule.activeDays.includes(weekday));
}

/** Koraci upita za ovaj nacrt: korak zabrana se preskače ako danas nijedna ne vrijedi. */
export function eveningSteps(draft: Pick<EveningDraft, 'rules'>): EveningStep[] {
  return draft.rules.length > 0 ? [...EVENING_STEPS] : ['checklist', 'rating'];
}

/**
 * Početni nacrt: stavka po bloku checkliste i po zabrani koja danas vrijedi.
 * Ako je upit tog dana već spremljen, preuzima njegove odgovore; inače blok označen
 * kao gotov na timelineu dolazi unaprijed kao "U redu".
 */
export function createEveningDraft(
  blocks: readonly Pick<ScheduleBlock, 'id' | 'kind' | 'status'>[],
  activeRules: readonly Pick<Rule, 'id'>[],
  saved: SavedEveningCheckin | null = null,
): EveningDraft {
  const savedItems = new Map(
    (saved?.items ?? []).filter((item) => item.refId !== null).map((item) => [item.refId, item]),
  );
  const savedLogs = new Map((saved?.ruleLogs ?? []).map((log) => [log.ruleId, log]));

  return {
    items: checklistBlocks(blocks).map((block) => {
      const previous = savedItems.get(block.id);
      if (previous) return { blockId: block.id, ok: previous.ok, comment: previous.comment ?? '' };
      return { blockId: block.id, ok: block.status === 'done' ? true : null, comment: '' };
    }),
    rules: activeRules.map((rule) => {
      const previous = savedLogs.get(rule.id);
      return previous
        ? { ruleId: rule.id, kept: previous.kept, trigger: previous.trigger ?? '' }
        : { ruleId: rule.id, kept: null, trigger: '' };
    }),
    rating: saved?.checkin.dayRating ?? null,
    note: saved?.checkin.note ?? '',
  };
}

const isNoteValid = (text: string) => noteSchema.safeParse(text).success;

/** Je li korak ispunjen (sve stavke odgovorene, tekstovi u granicama, ocjena 1–5). */
export function isEveningStepValid(step: EveningStep, draft: EveningDraft): boolean {
  switch (step) {
    case 'checklist':
      return draft.items.every((item) => item.ok !== null && isNoteValid(item.comment));
    case 'rules':
      return draft.rules.every((rule) => rule.kept !== null && isNoteValid(rule.trigger));
    case 'rating':
      return rating1to5Schema.safeParse(draft.rating).success && isNoteValid(draft.note);
  }
}

export function isEveningDraftComplete(draft: EveningDraft): boolean {
  return eveningSteps(draft).every((step) => isEveningStepValid(step, draft));
}

/** Prazan ili samo razmaci → `null`, inače obrezan tekst. */
export function cleanText(text: string): string | null {
  const trimmed = text.trim();
  return trimmed.length > 0 ? trimmed : null;
}

/**
 * Status bloka nakon upita: "U redu" → `done`, "Nije" → `skipped`.
 * Djelomično i premješteno (postavljeno drugdje) se ne prepisuju sa "Nije".
 */
export function blockStatusAfterCheckin(current: BlockStatus, ok: boolean): BlockStatus {
  if (ok) return 'done';
  return current === 'partial' || current === 'moved' ? current : 'skipped';
}

/** XP s izvorom na koji se odnosi (`sourceId`: blok, zabrana ili sam upit). */
export type SourcedXpAward = XpAward & { sourceId: string };

/**
 * XP za spremljeni upit: sam upit (15), svaka poštovana zabrana po težini,
 * svaki zadatak (blok vrste `task`) "U redu" kao lagani zadatak u planiranom terminu.
 * Bez kazni — "Nije" i prekršaj ne oduzimaju ništa.
 */
export function eveningXpAwards(
  draft: EveningDraft,
  blocks: readonly Pick<ScheduleBlock, 'id' | 'kind'>[],
  rules: readonly Pick<Rule, 'id' | 'weight'>[],
  checkinId: string,
): SourcedXpAward[] {
  const blockKinds = new Map(blocks.map((block) => [block.id, block.kind]));
  const ruleWeights = new Map(rules.map((rule) => [rule.id, rule.weight]));
  const awards: SourcedXpAward[] = [{ ...xpForEveningCheckin(), sourceId: checkinId }];

  for (const item of draft.items) {
    if (item.ok === true && blockKinds.get(item.blockId) === 'task') {
      awards.push({ ...xpForTaskDone(DEFAULT_TASK_DIFFICULTY, true), sourceId: item.blockId });
    }
  }
  for (const answer of draft.rules) {
    const weight = ruleWeights.get(answer.ruleId);
    if (answer.kept === true && weight !== undefined) {
      awards.push({ ...xpForRuleKept(weight), sourceId: answer.ruleId });
    }
  }
  return awards;
}

/** Ukupno XP-a iz dodjela (za potvrdu nakon spremanja). */
export function sumAwards(awards: readonly XpAward[]): number {
  return awards.reduce((sum, award) => sum + award.amount, 0);
}
