/**
 * „Nešto je iskrslo“ (korak 27, koncept: Izvanredne okolnosti): što i koliko dugo → za svaki
 * pogođeni zadatak kasnije danas / sutra / drugi dan / preskoči. Ne kvari niz. Čista logika:
 * bez React importa i bez baze — isti izračun koristi ekran (prikaz) i repo (spremanje).
 */
import type { ScheduleBlock } from '../domain';
import { formatClock, MINUTES_PER_DAY } from '../time/clock';
import { blockRange } from './timeline';

/** Koliko dugo traje ono što je iskrslo: minute ili do kraja dana. */
export const UNEXPECTED_DURATIONS = [15, 30, 60, 120, 'rest'] as const;
export type UnexpectedDuration = (typeof UNEXPECTED_DURATIONS)[number];

export const UNEXPECTED_CHOICES = ['laterToday', 'tomorrow', 'other', 'skip'] as const;
export type UnexpectedChoice = (typeof UNEXPECTED_CHOICES)[number];

/** Zadnja minuta dana na koju blok smije završiti ("23:59"; "24:00" nije valjano vrijeme). */
const LAST_MINUTE = MINUTES_PER_DAY - 1;

type PlanBlock = Pick<ScheduleBlock, 'id' | 'start' | 'end' | 'kind' | 'status'>;

export type UnexpectedSlot = { start: string; end: string };

export type AffectedBlock<T extends PlanBlock> = {
  block: T;
  /** Prvi slobodan termin iste duljine danas nakon prozora; `null` kad ga nema. */
  laterToday: UnexpectedSlot | null;
};

export type UnexpectedPlan<T extends PlanBlock> = {
  /** Prozor u minutama od ponoći, `[start, end)`. */
  window: { start: number; end: number };
  /** Pogođeni blokovi redom timelinea. */
  affected: AffectedBlock<T>[];
};

/** Prozor od `nowMinutes` koji traje `duration` (do kraja dana najviše); `null` za neispravno vrijeme. */
export function unexpectedWindow(nowMinutes: number, duration: UnexpectedDuration): { start: number; end: number } | null {
  if (!Number.isInteger(nowMinutes) || nowMinutes < 0 || nowMinutes >= LAST_MINUTE) return null;
  const end = duration === 'rest' ? LAST_MINUTE : Math.min(nowMinutes + duration, LAST_MINUTE);
  return { start: nowMinutes, end };
}

/** Može li blok biti pogođen: planiran (bez ishoda), nije san. */
const isMovable = (block: PlanBlock) => block.kind !== 'sleep' && block.status === 'planned';

/** Zauzima li blok vrijeme na timelineu (otkazani ne zauzimaju). */
const occupies = (block: PlanBlock) => block.status !== 'skipped' && block.status !== 'moved';

/**
 * Pogođeni blokovi i „kasnije danas“ za svaki: planirani blokovi (osim sna) koji se preklapaju s
 * prozorom, uključujući onaj koji upravo traje. Termini za kasnije danas se dijele redom (prvi
 * pogođeni dobiva prvi slobodan termin), bez preklapanja s ostatkom dana i međusobno, najkasnije
 * do 23:59. Pogođeni blokovi više ne zauzimaju svoje staro vrijeme.
 */
export function planUnexpected<T extends PlanBlock>(
  blocks: readonly T[],
  nowMinutes: number,
  duration: UnexpectedDuration,
): UnexpectedPlan<T> | null {
  const window = unexpectedWindow(nowMinutes, duration);
  if (window === null) return null;

  const ranged = blocks
    .map((block) => ({ block, range: blockRange(block) }))
    .filter((entry): entry is { block: T; range: { start: number; end: number } } => entry.range !== null);
  const affected = ranged
    .filter(({ block, range }) => isMovable(block) && range.end > window.start && range.start < window.end)
    .sort((a, b) => a.range.start - b.range.start || a.range.end - b.range.end);
  const affectedIds = new Set(affected.map(({ block }) => block.id));
  const busy = ranged
    .filter(({ block }) => !affectedIds.has(block.id) && occupies(block))
    .map(({ range }) => range);

  const result: AffectedBlock<T>[] = [];
  for (const { block, range } of affected) {
    const length = range.end - range.start;
    const start = firstFree(busy, window.end, length);
    if (start === null) {
      result.push({ block, laterToday: null });
      continue;
    }
    busy.push({ start, end: start + length });
    const slot = { start: formatClock(start), end: formatClock(start + length) };
    result.push({
      block,
      laterToday: slot.start !== null && slot.end !== null ? { start: slot.start, end: slot.end } : null,
    });
  }
  return { window, affected: result };
}

/** Najraniji početak ≥ `from` za `length` minuta bez preklapanja sa `busy`, s krajem ≤ 23:59. */
function firstFree(busy: readonly { start: number; end: number }[], from: number, length: number): number | null {
  if (length <= 0) return null;
  const sorted = [...busy].sort((a, b) => a.start - b.start);
  let candidate = from;
  for (const range of sorted) {
    if (range.end <= candidate) continue;
    if (range.start >= candidate + length) break;
    candidate = range.end;
  }
  return candidate + length <= LAST_MINUTE ? candidate : null;
}

/** Zadani izbor za pogođeni blok: kasnije danas ako ima termin, inače sutra. */
export function defaultUnexpectedChoice(entry: Pick<AffectedBlock<PlanBlock>, 'laterToday'>): UnexpectedChoice {
  return entry.laterToday !== null ? 'laterToday' : 'tomorrow';
}

/** Je li izbor preraspoređivanje (za XP „preraspoređeno s objašnjenjem“); preskoči nije. */
export function isRescheduleChoice(choice: UnexpectedChoice): boolean {
  return choice !== 'skip';
}
