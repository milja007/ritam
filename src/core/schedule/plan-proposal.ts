/**
 * Korak 22 u appu: „Složi mi dan“. Zahtjev za Edge Function `plan-day` iz stavki „Što imaš
 * sutra?“, ponovna provjera odgovora (app ne vjeruje mreži) i prijedlog koji korisnik
 * prihvaća ili odbija — plan postaje plan tek kad ga potvrdi.
 * Čista logika: bez React importa.
 */
import type { ScheduleBlock } from '../domain';
import { formatClock, parseClock } from '../time/clock';
import { LAST_END, type BlockDraft } from './block-draft';
import type { DayPriority, PlanAnswer, PlanContext, PlanDayRequest, PlanDayResponse, PlannedBlock } from './edge-types';
import { planStartMinutes } from './tomorrow';

type Occupied = Pick<ScheduleBlock, 'start' | 'end' | 'kind'>;

/** Stavka popisa: nacrt i je li vrijeme izričito zadano (tipkano vrijeme, naučeni termin, uređivač). */
export type PlanItem = { draft: BlockDraft; pinned: boolean };

/** Granice iz Edge Functiona (`plan-logic.ts`). */
export const PLAN_MAX_PRIORITIES = 30;
export const PLAN_MAX_WINDOWS = 12;
export const PLAN_MAX_QUESTIONS = 3;
/** Kraći slobodan prozor nema smisla nuditi. */
export const PLAN_MIN_WINDOW_MINUTES = 15;
const MAX_QUESTION_LENGTH = 300;
const MAX_SUMMARY_LENGTH = 600;

const clock = (minutes: number): string => formatClock(minutes) ?? '00:00';

type Interval = { start: number; end: number };

function intervalOf(block: { start: string; end: string }): Interval | null {
  const start = parseClock(block.start);
  const end = parseClock(block.end);
  return start !== null && end !== null && end > start ? { start, end } : null;
}

/**
 * Slobodni prozori sutra: od buđenja + 30 min (kao slaganje termina) do odlaska u krevet, bez
 * postojećih blokova (san i blokovi preko ponoći se ne gledaju). Krevet poslije ponoći ili
 * neispravan → kraj dana. Prozori kraći od 15 min otpadaju; najviše 12.
 */
export function freeWindows(
  existing: readonly Occupied[],
  wakeTime: string,
  bedtime: string | null,
): { start: string; end: string }[] {
  const from = planStartMinutes(wakeTime);
  const bed = bedtime === null ? null : parseClock(bedtime);
  const to = bed !== null && bed > from ? bed : LAST_END;
  const busy = existing
    .filter((block) => block.kind !== 'sleep')
    .map(intervalOf)
    .filter((interval): interval is Interval => interval !== null)
    .sort((a, b) => a.start - b.start);
  const windows: { start: string; end: string }[] = [];
  let cursor = from;
  for (const slot of [...busy, { start: to, end: to }]) {
    const end = Math.min(slot.start, to);
    if (end - cursor >= PLAN_MIN_WINDOW_MINUTES) windows.push({ start: clock(cursor), end: clock(end) });
    cursor = Math.max(cursor, slot.end);
    if (cursor >= to) break;
  }
  return windows.slice(0, PLAN_MAX_WINDOWS);
}

/** Stavka → prioritet: izričito vrijeme je fiksni početak, trajanje je uvijek iz nacrta. */
export function priorityOf(item: PlanItem): DayPriority {
  const span = intervalOf(item.draft);
  return {
    title: item.draft.title.trim(),
    durationMinutes: span ? span.end - span.start : null,
    fixedStart: item.pinned ? item.draft.start : null,
    important: item.draft.kind === 'fixed',
  };
}

/** Bez ciljeva, zadataka i zabrana. */
export const EMPTY_PLAN_CONTEXT: PlanContext = { goals: [], tasks: [], rules: [] };

/** Zahtjev za `plan-day` (najviše 30 stavki) s kontekstom dana (korak 26). */
export function planDayRequest(
  date: string,
  items: readonly PlanItem[],
  existing: readonly Occupied[],
  wakeTime: string,
  bedtime: string | null,
  locale: 'hr' | 'en',
  context: PlanContext = EMPTY_PLAN_CONTEXT,
  answers: readonly PlanAnswer[] = [],
): PlanDayRequest {
  return {
    date,
    locale,
    priorities: items.slice(0, PLAN_MAX_PRIORITIES).map(priorityOf),
    freeWindows: freeWindows(existing, wakeTime, bedtime),
    preferences: null,
    context,
    answers: [...answers],
  };
}

/** Najdulji odgovor na pitanje modela (isto ograničenje kao pitanje i server). */
export const PLAN_MAX_ANSWER_LENGTH = MAX_QUESTION_LENGTH;

/** Najviše odgovora u jednom zahtjevu (isto kao `MAX_ANSWERS` na serveru). */
export const PLAN_MAX_ANSWERS = 6;

const questionKey = (question: string) => question.replace(/\s+/g, ' ').trim().toLowerCase();

/**
 * Odgovori kroz krugove iste večeri (Codex P2, #68): najnoviji prvi, pa raniji čije pitanje
 * nije ponovo odgovoreno; najviše `PLAN_MAX_ANSWERS`. Stari server čita prva 3 — dobiva najnovije.
 */
export function mergePlanAnswers(earlier: readonly PlanAnswer[], latest: readonly PlanAnswer[]): PlanAnswer[] {
  const seen = new Set<string>();
  const merged: PlanAnswer[] = [];
  for (const answer of [...latest, ...earlier]) {
    const key = questionKey(answer.question);
    if (seen.has(key)) continue;
    seen.add(key);
    merged.push(answer);
  }
  return merged.slice(0, PLAN_MAX_ANSWERS);
}

/**
 * Odgovori za ponovno slaganje (korak 22): svako pitanje s odgovorom koji nije prazan, razmaci
 * sažeti, najviše 3. Pitanje bez odgovora se ne šalje (model ga smije pitati ponovo).
 */
export function planAnswers(questions: readonly string[], replies: readonly string[]): PlanAnswer[] {
  const answers: PlanAnswer[] = [];
  questions.slice(0, PLAN_MAX_QUESTIONS).forEach((question, index) => {
    const answer = (replies[index] ?? '').replace(/\s+/g, ' ').trim().slice(0, PLAN_MAX_ANSWER_LENGTH);
    if (answer.length > 0) answers.push({ question, answer });
  });
  return answers;
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

function readPlanned(raw: unknown): PlannedBlock | null {
  if (!isRecord(raw)) return null;
  const title = typeof raw.title === 'string' ? raw.title.replace(/\s+/g, ' ').trim() : '';
  if (title.length === 0 || title.length > 200) return null;
  if (typeof raw.start !== 'string' || typeof raw.end !== 'string') return null;
  if (!/^\d{2}:\d{2}$/.test(raw.start) || !/^\d{2}:\d{2}$/.test(raw.end)) return null;
  if (intervalOf({ start: raw.start, end: raw.end }) === null) return null;
  return { title, start: raw.start, end: raw.end, kind: raw.kind === 'fixed' ? 'fixed' : 'suggestion' };
}

/**
 * Odgovor `plan-day` → prijedlog, samo ako poštuje zahtjev: valjana vremena, bez preklapanja,
 * svaki blok u slobodnom prozoru ili točno fiksna stavka (naslov i početak). Inače `null` —
 * app tada kaže da slaganje nije uspjelo i popis ostaje kakav jest.
 */
export function readPlanDayResponse(raw: unknown, request: PlanDayRequest): PlanDayResponse | null {
  if (!isRecord(raw) || !Array.isArray(raw.schedule)) return null;
  const blocks = raw.schedule.map(readPlanned);
  if (blocks.some((block) => block === null)) return null;
  const schedule = (blocks as PlannedBlock[]).sort((a, b) => a.start.localeCompare(b.start));
  const windows = request.freeWindows.map(intervalOf).filter((w): w is Interval => w !== null);
  const fixed = request.priorities.filter((priority) => priority.fixedStart !== null);
  let previousEnd = -1;
  for (const block of schedule) {
    const span = intervalOf(block) as Interval;
    if (span.start < previousEnd) return null;
    previousEnd = span.end;
    const isFixed = fixed.some((priority) => priority.fixedStart === block.start && priority.title === block.title);
    const inWindow = windows.some((window) => span.start >= window.start && span.end <= window.end);
    if (!isFixed && !inWindow) return null;
  }
  const questions = Array.isArray(raw.questions)
    ? raw.questions
        .filter((question): question is string => typeof question === 'string')
        .map((question) => question.trim())
        .filter((question) => question.length > 0 && question.length <= MAX_QUESTION_LENGTH)
        .slice(0, PLAN_MAX_QUESTIONS)
    : [];
  const summary = typeof raw.summary === 'string' ? raw.summary.trim().slice(0, MAX_SUMMARY_LENGTH) : '';
  return { schedule, questions, summary };
}

export type PlanProposal<T extends PlanItem = PlanItem> = {
  /** Nacrti predloženog rasporeda (vrsta iz odgovarajuće stavke, inače Zadatak). */
  drafts: BlockDraft[];
  /** Stavke koje model nije smjestio — ostaju na popisu ako se prijedlog prihvati. */
  leftOut: T[];
  questions: string[];
  summary: string;
};

const titleKey = (title: string) => title.trim().toLocaleLowerCase();

/** Tjedni zadatak iz konteksta: blok istog naslova postaje njegov termin (`taskId`). */
export type ProposalTask = { id: string; title: string };

/**
 * Prijedlog za prikaz: svaki blok rasporeda se veže na prvu još nevezanu stavku istog naslova
 * (pa dvije „Kemije“ ostaju dvije); stavke bez bloka su „nije stalo“. Blok koji nije stavka, a
 * nosi naslov tjednog zadatka iz konteksta, postaje termin tog zadatka (najviše jedan po
 * zadatku — zadatak se ne ponavlja isti dan).
 */
export function planProposal<T extends PlanItem>(
  response: PlanDayResponse,
  items: readonly T[],
  tasks: readonly ProposalTask[] = [],
): PlanProposal<T> {
  const used = new Set<number>();
  const usedTasks = new Set<string>();
  const drafts = response.schedule.map((block): BlockDraft => {
    const index = items.findIndex((item, i) => !used.has(i) && titleKey(item.draft.title) === titleKey(block.title));
    if (index >= 0) {
      used.add(index);
      const item = items[index] as T;
      const draft: BlockDraft = { title: block.title, kind: item.draft.kind, start: block.start, end: block.end };
      return item.draft.taskId ? { ...draft, taskId: item.draft.taskId } : draft;
    }
    const task = tasks.find((entry) => !usedTasks.has(entry.id) && titleKey(entry.title) === titleKey(block.title));
    if (task) {
      usedTasks.add(task.id);
      return { title: task.title, kind: 'task', start: block.start, end: block.end, taskId: task.id };
    }
    return { title: block.title, kind: 'task', start: block.start, end: block.end };
  });
  return {
    drafts,
    leftOut: items.filter((_, index) => !used.has(index)),
    questions: response.questions,
    summary: response.summary,
  };
}

/** Prijedlog je vrijedan prikaza samo ako ima barem jedan blok. */
export function hasProposal(proposal: PlanProposal): boolean {
  return proposal.drafts.length > 0;
}

/** „Složi mi dan“ ima smisla s barem dvije stavke (jednu korisnik slaže sam). */
export const PLAN_MIN_ITEMS = 2;
