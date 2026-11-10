/**
 * "Što imaš sutra?" — ručni unos blokova za sutra (tipkanje + naučeni odabiri), bez LLM-a.
 * Generičke kategorije ("Posao", "Škola") su uklonjene (Borna, 2026-11-10).
 * Čista logika: bez React importa. LLM `parse-input` (korak 21) kasnije zamjenjuje `parsePlanEntry`.
 */
import type { ScheduleBlock } from '../domain';
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
import { DAY_PART_START, parsePlanEntry } from './plan-entry';
import { nextFreeSlotFrom } from './today-plan';

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

/**
 * Nacrt iz tipkanog unosa: prepoznato vrijeme se koristi (samo početak → navedeno trajanje ili 1 h);
 * inače prvi slobodni termin navedenog trajanja (ili 1 h) — od buđenja, a s dobom dana
 * ("poslijepodne") od početka tog doba. Vrsta je Zadatak (mijenja se u editoru). Prazan unos → `null`.
 */
export function typedDraft(text: string, occupied: readonly Occupied[], wakeTime: string): BlockDraft | null {
  const entry = parsePlanEntry(text);
  if (!entry) return null;
  const minutes = entry.minutes ?? DEFAULT_BLOCK_MINUTES;
  const start = entry.start === null ? null : parseClock(entry.start);
  if (start !== null) {
    const fromStart = Math.min(start, LAST_START);
    const end = entry.end === null ? Math.min(fromStart + minutes, LAST_END) : parseClock(entry.end);
    if (end !== null && end > fromStart) {
      return {
        title: entry.title,
        kind: 'task',
        start: clock(fromStart),
        end: clock(end),
      };
    }
  }
  if (entry.part !== null) {
    const from = Math.max(planStartMinutes(wakeTime), DAY_PART_START[entry.part]);
    const slot = nextFreeSlotFrom(occupied, minutes, from);
    if (slot !== null) return { title: entry.title, kind: 'task', ...slot };
  }
  return {
    title: entry.title,
    kind: 'task',
    ...nextFreeSlot(occupied, minutes, wakeTime),
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
