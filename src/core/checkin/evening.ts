/**
 * Večernji upit (checklist): koraci, nacrt odgovora, validacija, statusi blokova i XP.
 * Čista logika: bez React importa, bez pisanja u bazu (to radi `saveEveningCheckin`).
 * Koncept: checklist dana (U redu / Djelomično / Nije + komentar i "kad kasnije?") → zabrane
 * (Držao sam se / Prekršio sam + okidač) → ocjena dana 1–5 + rečenica. XP po akcijama, bez kazni.
 */
import type {
  BlockStatus,
  Checkin,
  CheckinItem,
  CheckinOutcome,
  Rule,
  RuleLog,
  ScheduleBlock,
} from '../domain';
import { isValidLocalDate, noteSchema, rating1to5Schema } from '../domain/common';
import {
  xpForEveningCheckin,
  xpForRuleKept,
  xpForTaskDone,
  xpForTaskPartial,
  type TaskDifficulty,
  type XpAward,
} from '../gamification/xp';
import { addDays, daysBetween, localDateOf } from '../time/local-date';

export const EVENING_STEPS = ['checklist', 'rules', 'rating'] as const;
export type EveningStep = (typeof EVENING_STEPS)[number];

/** "Kad kasnije?" za Djelomično / Nije: sutra, drugi dan (bira se dan) ili preskoči. */
export const LATER_CHOICES = ['tomorrow', 'other', 'skip'] as const;
export type LaterChoice = (typeof LATER_CHOICES)[number];

export type ChecklistAnswer = {
  blockId: string;
  /** U redu / Djelomično / Nije, `null` = još bez odgovora. */
  outcome: CheckinOutcome | null;
  /** Komentar za Djelomično / Nije (za "U redu" se ne sprema). */
  comment: string;
  /** "Kad kasnije?" — samo za Djelomično / Nije. */
  later: LaterChoice | null;
  /** Odabrani dan za "drugi dan" (za ostale izbore se ne koristi). */
  laterDate: string | null;
};

export type RuleAnswer = {
  ruleId: string;
  /** `true` = Držao sam se, `false` = Prekršio sam, `null` = još bez odgovora. */
  kept: boolean | null;
  /** Okidač prekršaja (za "Držao sam se" se ne sprema). */
  trigger: string;
};

export type EveningDraft = {
  /** Dan na koji se upit odnosi (prije 04:00 je to prethodni dan). */
  date: string;
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

/** Upit ispunjen prije ovog sata pripada prethodnom danu (odluka 2026-11-09). */
export const EVENING_DAY_START_HOUR = 4;

/** "Drugi dan" nudi dane od prekosutra do tjedan dana unaprijed. */
export const OTHER_DAY_FIRST_OFFSET = 2;
export const OTHER_DAY_LAST_OFFSET = 7;

/** Dan na koji se odnosi upit ispunjen u trenutku `now` (lokalno; prije 04:00 → jučer). */
export function eveningCheckinDate(now: Date): string {
  const today = localDateOf(now);
  return now.getHours() < EVENING_DAY_START_HOUR ? (addDays(today, -1) ?? today) : today;
}

/** Dani ponuđeni za "drugi dan" (prekosutra … +7 dana). */
export function otherDayOptions(date: string): string[] {
  const days: string[] = [];
  for (let offset = OTHER_DAY_FIRST_OFFSET; offset <= OTHER_DAY_LAST_OFFSET; offset++) {
    const day = addDays(date, offset);
    if (day !== null) days.push(day);
  }
  return days;
}

function isOtherDay(date: string, candidate: string | null): candidate is string {
  if (candidate === null) return false;
  const offset = daysBetween(date, candidate);
  return offset !== null && offset >= OTHER_DAY_FIRST_OFFSET && offset <= OTHER_DAY_LAST_OFFSET;
}

/** Dan na koji ide (ostatak) zadatka, ili `null` (U redu, preskoči, bez odgovora). */
export function resolveLaterDate(answer: ChecklistAnswer, date: string): string | null {
  if (answer.outcome === null || answer.outcome === 'ok') return null;
  switch (answer.later) {
    case 'tomorrow':
      return addDays(date, 1);
    case 'other':
      return isOtherDay(date, answer.laterDate) ? answer.laterDate : null;
    default:
      return null;
  }
}

/** Izbor "kad kasnije?" iz spremljenog dana premještanja. */
function laterFromSaved(
  outcome: CheckinOutcome,
  laterDate: string | null,
  date: string,
): Pick<ChecklistAnswer, 'later' | 'laterDate'> {
  if (outcome === 'ok') return { later: null, laterDate: null };
  if (laterDate === null) return { later: 'skip', laterDate: null };
  if (laterDate === addDays(date, 1)) return { later: 'tomorrow', laterDate: null };
  return { later: 'other', laterDate };
}

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

const emptyAnswer = (blockId: string, outcome: CheckinOutcome | null): ChecklistAnswer => ({
  blockId,
  outcome,
  comment: '',
  later: null,
  laterDate: null,
});

/**
 * Odgovor iz statusa prijavljenog na rasporedu (17c/17d), da večernji upit ostane kratak:
 * Gotovo → U redu; Djelomično → Djelomično, Nije / Otkazano / Odustajem → Nije, oba s "preskoči"
 * (premještanje se i dalje može odabrati). Neprijavljeni blokovi čekaju odgovor.
 */
export function prefilledAnswer(block: Pick<ScheduleBlock, 'id' | 'status'>): ChecklistAnswer {
  switch (block.status) {
    case 'done':
      return emptyAnswer(block.id, 'ok');
    case 'partial':
      return { ...emptyAnswer(block.id, 'partial'), later: 'skip' };
    case 'skipped':
      return { ...emptyAnswer(block.id, 'not'), later: 'skip' };
    default:
      return emptyAnswer(block.id, null);
  }
}

/**
 * Početni nacrt za dan `date`: stavka po bloku checkliste i po zabrani koja taj dan vrijedi.
 * Ako je upit tog dana već spremljen, preuzima njegove odgovore (i "kad kasnije?"); inače blok
 * prijavljen na rasporedu dolazi unaprijed popunjen (`prefilledAnswer`).
 */
export function createEveningDraft(
  date: string,
  blocks: readonly Pick<ScheduleBlock, 'id' | 'kind' | 'status'>[],
  activeRules: readonly Pick<Rule, 'id'>[],
  saved: SavedEveningCheckin | null = null,
): EveningDraft {
  const savedItems = new Map(
    (saved?.items ?? []).filter((item) => item.refId !== null).map((item) => [item.refId, item]),
  );
  const savedLogs = new Map((saved?.ruleLogs ?? []).map((log) => [log.ruleId, log]));

  return {
    date,
    items: checklistBlocks(blocks).map((block) => {
      const previous = savedItems.get(block.id);
      if (!previous) return prefilledAnswer(block);
      return {
        blockId: block.id,
        outcome: previous.outcome,
        comment: previous.comment ?? '',
        ...laterFromSaved(previous.outcome, previous.laterDate, date),
      };
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

/** Je li odgovor na stavku potpun: ishod, komentar u granicama, za Djelomično/Nije i "kad kasnije?". */
export function isChecklistAnswerValid(answer: ChecklistAnswer, date: string): boolean {
  if (answer.outcome === null || !isNoteValid(answer.comment)) return false;
  if (answer.outcome === 'ok') return true;
  if (answer.later === 'other') return isOtherDay(date, answer.laterDate);
  return answer.later !== null;
}

/** Je li korak ispunjen (sve stavke odgovorene, tekstovi u granicama, ocjena 1–5). */
export function isEveningStepValid(step: EveningStep, draft: EveningDraft): boolean {
  switch (step) {
    case 'checklist':
      return draft.items.every((item) => isChecklistAnswerValid(item, draft.date));
    case 'rules':
      return draft.rules.every((rule) => rule.kept !== null && isNoteValid(rule.trigger));
    case 'rating':
      return rating1to5Schema.safeParse(draft.rating).success && isNoteValid(draft.note);
  }
}

export function isEveningDraftComplete(draft: EveningDraft): boolean {
  return isValidLocalDate(draft.date) && eveningSteps(draft).every((step) => isEveningStepValid(step, draft));
}

/** Prazan ili samo razmaci → `null`, inače obrezan tekst. */
export function cleanText(text: string): string | null {
  const trimmed = text.trim();
  return trimmed.length > 0 ? trimmed : null;
}

/**
 * Status bloka nakon upita: U redu → `done`; Djelomično → `partial` (i kad se ostatak premjesti,
 * da XP za odrađeni dio ostane); Nije → `moved` ako je premješten, inače `skipped`.
 */
export function blockStatusAfterCheckin(outcome: CheckinOutcome, movedTo: string | null): BlockStatus {
  switch (outcome) {
    case 'ok':
      return 'done';
    case 'partial':
      return 'partial';
    case 'not':
      return movedTo === null ? 'skipped' : 'moved';
  }
}

/**
 * XP zadatka izveden iz statusa bloka (jedan izvor istine za kvačicu na timelineu i za upit, pa
 * se XP nikad ne duplicira): blok vrste Zadatak `done` → lagani zadatak u planiranom terminu (15),
 * `partial` → pola, zaokruženo naviše (8). Ostali statusi i vrste blokova → bez XP-a.
 */
export function taskXpForBlock(block: Pick<ScheduleBlock, 'kind' | 'status'>): XpAward | null {
  if (block.kind !== 'task') return null;
  if (block.status === 'done') return xpForTaskDone(DEFAULT_TASK_DIFFICULTY, true);
  if (block.status === 'partial') return xpForTaskPartial(DEFAULT_TASK_DIFFICULTY, true);
  return null;
}

/** Polja novog bloka za premješteni (ostatak) zadatak: isti naziv i termin na dan `date`. */
export function movedBlockFields(
  block: Pick<ScheduleBlock, 'title' | 'start' | 'end' | 'taskId' | 'kind'>,
  date: string,
): Omit<ScheduleBlock, 'id' | 'userId' | 'createdAt' | 'updatedAt'> {
  return {
    date,
    title: block.title,
    start: block.start,
    end: block.end,
    taskId: block.taskId,
    note: null,
    // Kalendarski / iskrsli blok premješten rukom više nije iz kalendara — postaje fiksna obaveza.
    kind: block.kind === 'task' ? 'task' : 'fixed',
    source: 'user',
    status: 'planned',
  };
}

/** XP s izvorom na koji se odnosi (`sourceId`: zabrana ili sam upit). */
export type SourcedXpAward = XpAward & { sourceId: string };

/**
 * XP koji piše sam upit: upit (15) i svaka poštovana zabrana po težini. XP zadataka ide preko
 * statusa bloka (`taskXpForBlock`). Bez kazni — prekršaj ne oduzima ništa.
 */
export function eveningXpAwards(
  draft: Pick<EveningDraft, 'rules'>,
  rules: readonly Pick<Rule, 'id' | 'weight'>[],
  checkinId: string,
): SourcedXpAward[] {
  const ruleWeights = new Map(rules.map((rule) => [rule.id, rule.weight]));
  const awards: SourcedXpAward[] = [{ ...xpForEveningCheckin(), sourceId: checkinId }];
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
