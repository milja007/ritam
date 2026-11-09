/**
 * "Što imaš sutra?" — ručni unos blokova za sutra (brzi odabiri + tipkanje), bez LLM-a.
 * Čista logika: bez React importa. LLM `parse-input` (korak 21) kasnije zamjenjuje `parseTypedEntry`.
 */
import type { BlockKind, ScheduleBlock } from '../domain';
import { formatClock, parseClock } from '../time/clock';
import { addDays } from '../time/local-date';
import {
  BLOCK_STEP_MINUTES,
  DEFAULT_BLOCK_MINUTES,
  draftToInput,
  isBlockDraftValid,
  LAST_END,
  LAST_START,
  type BlockDraft,
  type BlockDraftInput,
} from './block-draft';

/** Brzi odabir: naziv dolazi iz i18n (`evening.tomorrow.pick.<id>`), vrsta i trajanje odavde. */
export type QuickPick = {
  id: string;
  kind: Extract<BlockKind, 'task' | 'fixed'>;
  minutes: number;
};

export const QUICK_PICKS = [
  { id: 'work', kind: 'fixed', minutes: 480 },
  { id: 'school', kind: 'fixed', minutes: 360 },
  { id: 'workout', kind: 'task', minutes: 60 },
  { id: 'study', kind: 'task', minutes: 90 },
  { id: 'errands', kind: 'task', minutes: 60 },
  { id: 'chores', kind: 'task', minutes: 60 },
  { id: 'reading', kind: 'task', minutes: 30 },
  { id: 'social', kind: 'fixed', minutes: 120 },
] as const satisfies readonly QuickPick[];

export type QuickPickId = (typeof QUICK_PICKS)[number]['id'];

/** Prvi blok sutra počinje najranije ovoliko nakon buđenja. */
export const PLAN_START_AFTER_WAKE_MINUTES = 30;

type Occupied = Pick<ScheduleBlock, 'start' | 'end' | 'kind'>;

const clock = (minutes: number): string => formatClock(minutes) ?? '00:00';
const roundUpToStep = (minutes: number) => Math.ceil(minutes / BLOCK_STEP_MINUTES) * BLOCK_STEP_MINUTES;

/** Dan za "Što imaš sutra?": dan nakon dana upita (upit prije 04:00 → sutra je zapravo danas). */
export function tomorrowOf(eveningDate: string): string | null {
  return addDays(eveningDate, 1);
}

/** Najraniji početak plana: buđenje + 30 min, na četvrt sata (neispravno buđenje → 07:00). */
export function planStartMinutes(wakeTime: string): number {
  const wake = parseClock(wakeTime) ?? 7 * 60;
  return Math.min(roundUpToStep(wake + PLAN_START_AFTER_WAKE_MINUTES), LAST_START);
}

/**
 * Sljedeći slobodni termin zadanog trajanja: iza zadnjeg bloka (sutrašnji + već dodani), ne prije
 * buđenja, unutar dana (kraj najkasnije 23:59). San i blokovi preko ponoći se ne gledaju.
 */
export function nextFreeSlot(
  occupied: readonly Occupied[],
  minutes: number,
  wakeTime: string,
): { start: string; end: string } {
  let start = planStartMinutes(wakeTime);
  for (const block of occupied) {
    if (block.kind === 'sleep') continue;
    const blockStart = parseClock(block.start);
    const blockEnd = parseClock(block.end);
    if (blockStart === null || blockEnd === null || blockEnd <= blockStart) continue;
    if (blockEnd > start) start = roundUpToStep(blockEnd);
  }
  start = Math.min(start, LAST_START);
  const end = Math.min(start + Math.max(minutes, BLOCK_STEP_MINUTES), LAST_END);
  return { start: clock(start), end: clock(end) };
}

export function quickPickDraft(
  pick: QuickPick,
  title: string,
  occupied: readonly Occupied[],
  wakeTime: string,
): BlockDraft {
  return {
    title,
    kind: pick.kind,
    ...nextFreeSlot(occupied, pick.minutes, wakeTime),
  };
}

export type TypedEntry = {
  title: string;
  /** "HH:MM" ako je u tekstu prepoznato vrijeme, inače `null`. */
  start: string | null;
  end: string | null;
};

const TIME = String.raw`(\d{1,2})(?:[:.](\d{2}))?\s*h?`;
/** "9-11", "od 9:30 do 11", "18.00–19.30", "from 9 to 5pm"? (bez am/pm — 24 h). */
const RANGE = new RegExp(
  String.raw`(?:^|\s)(?:od\s+|from\s+)?${TIME}\s*(?:-|do\s|to\s|until\s)\s*${TIME}(?=\s|[,;]|$)`,
  'iu',
);
/** "u 15", "at 9:30", "@ 18h", ili samostalno "18:00". */
const SINGLE = new RegExp(
  String.raw`(?:^|\s)(?:(?:u|at|@)\s*${TIME}|(\d{1,2})[:.](\d{2})\s*h?)(?=\s|[,;]|$)`,
  'iu',
);

function toMinutes(hours: string | undefined, minutes: string | undefined): number | null {
  if (hours === undefined) return null;
  const h = Number(hours);
  const m = minutes === undefined ? 0 : Number(minutes);
  if (!Number.isInteger(h) || !Number.isInteger(m) || h > 23 || m > 59) return null;
  return h * 60 + m;
}

function cleanTitle(text: string): string {
  return text
    .replace(/\s+/g, ' ')
    .replace(/^[\s,;:\-–—]+|[\s,;:\-–—]+$/g, '')
    .trim();
}

/**
 * Tipkani unos → naziv + (opcionalno) vrijeme. Prepoznaje raspon ("Trening 18-19",
 * "sastanak od 9:30 do 11") ili početak ("zubar u 15", "at 9:30", "ručak 13:00").
 * Neispravno vrijeme (npr. 25:00, kraj prije početka) ostaje dio naziva. Prazan naziv → `null`.
 */
export function parseTypedEntry(text: string): TypedEntry | null {
  const normalized = text.replace(/[–—]/g, '-').replace(/\s+/g, ' ').trim();
  if (normalized.length === 0) return null;

  const range = RANGE.exec(normalized);
  if (range) {
    const start = toMinutes(range[1], range[2]);
    const end = toMinutes(range[3], range[4]);
    if (start !== null && end !== null && end > start) {
      const title = cleanTitle(normalized.replace(range[0], ' '));
      return title ? { title, start: clock(start), end: clock(end) } : null;
    }
  }

  const single = SINGLE.exec(normalized);
  if (single) {
    const start = toMinutes(single[1] ?? single[3], single[2] ?? single[4]);
    if (start !== null) {
      const title = cleanTitle(normalized.replace(single[0], ' '));
      return title ? { title, start: clock(start), end: null } : null;
    }
  }

  const title = cleanTitle(normalized);
  return title ? { title, start: null, end: null } : null;
}

/**
 * Nacrt iz tipkanog unosa: prepoznato vrijeme se koristi (samo početak → traje 1 h), inače
 * sljedeći slobodni termin. Vrsta je Zadatak (mijenja se u editoru). Prazan unos → `null`.
 */
export function typedDraft(text: string, occupied: readonly Occupied[], wakeTime: string): BlockDraft | null {
  const entry = parseTypedEntry(text);
  if (!entry) return null;
  const start = entry.start === null ? null : parseClock(entry.start);
  if (start !== null) {
    const fromStart = Math.min(start, LAST_START);
    const end =
      entry.end === null ? Math.min(fromStart + DEFAULT_BLOCK_MINUTES, LAST_END) : parseClock(entry.end);
    if (end !== null && end > fromStart) {
      return {
        title: entry.title,
        kind: 'task',
        start: clock(fromStart),
        end: clock(end),
      };
    }
  }
  return {
    title: entry.title,
    kind: 'task',
    ...nextFreeSlot(occupied, DEFAULT_BLOCK_MINUTES, wakeTime),
  };
}

/** Nove stavke sutrašnjeg plana zajedno s već postojećim blokovima (za slaganje termina). */
export function occupiedSlots(existing: readonly Occupied[], drafts: readonly BlockDraft[]): Occupied[] {
  return [...existing, ...drafts];
}

/** Može li se plan potvrditi: barem jedna stavka i sve prolaze validaciju bloka. */
export function isTomorrowPlanValid(drafts: readonly BlockDraft[]): boolean {
  return drafts.length > 0 && drafts.every(isBlockDraftValid);
}

/** Ulazi za repo, poredani po početku (ručni unos: `user` / `planned`). */
export function tomorrowInputs(drafts: readonly BlockDraft[], date: string): BlockDraftInput[] {
  return [...drafts]
    .sort((a, b) => a.start.localeCompare(b.start) || a.end.localeCompare(b.end))
    .map((draft) => draftToInput(draft, date));
}
