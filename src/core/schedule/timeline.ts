/**
 * Timeline dana: koji je blok prošao, koji traje, koji slijedi; označavanje gotovog.
 * Čista logika: bez React importa.
 */
import type { BlockStatus, ScheduleBlock } from '../domain';
import { MINUTES_PER_DAY, parseClock } from '../time/clock';

export type BlockPhase = 'past' | 'current' | 'upcoming';

type TimedBlock = Pick<ScheduleBlock, 'start' | 'end' | 'kind'>;

/**
 * Raspon bloka u minutama od ponoći današnjeg dana, `[start, end)`.
 * San koji prelazi ponoć (23:00–07:00) na današnjem timelineu traje do kraja dana —
 * jutarnji dio pripada sutrašnjem danu. Neispravno vrijeme → `null`.
 */
export function blockRange(block: TimedBlock): { start: number; end: number } | null {
  const start = parseClock(block.start);
  const end = parseClock(block.end);
  if (start === null || end === null) return null;
  if (end > start) return { start, end };
  if (block.kind === 'sleep' && end !== start) return { start, end: MINUTES_PER_DAY };
  return null;
}

/** Je li blok prošao, traje li sada ili tek slijedi (`nowMinutes` = minute od ponoći). */
export function blockPhase(block: TimedBlock, nowMinutes: number): BlockPhase {
  const range = blockRange(block);
  if (!range) return 'upcoming';
  if (nowMinutes >= range.end) return 'past';
  if (nowMinutes >= range.start) return 'current';
  return 'upcoming';
}

/**
 * Id bloka koji traje u `nowMinutes`, ili `null`. Ako se blokovi preklapaju,
 * istaknut je onaj koji je počeo kasnije (uži, "unutarnji" blok).
 */
export function currentBlockId(
  blocks: readonly (TimedBlock & Pick<ScheduleBlock, 'id'>)[],
  nowMinutes: number,
): string | null {
  let best: { id: string; start: number } | null = null;
  for (const block of blocks) {
    if (blockPhase(block, nowMinutes) !== 'current') continue;
    const range = blockRange(block);
    if (range && (best === null || range.start > best.start)) {
      best = { id: block.id, start: range.start };
    }
  }
  return best?.id ?? null;
}

export function isDone(block: Pick<ScheduleBlock, 'status'>): boolean {
  return block.status === 'done';
}

/**
 * Kvačica na timelineu: `done` → `planned`, sve ostalo → `done`.
 * (Djelomično / preskočeno / premješteno postavlja večernji upit; kvačica ih prepisuje u gotovo.)
 */
export function toggledStatus(status: BlockStatus): BlockStatus {
  return status === 'done' ? 'planned' : 'done';
}

/** Minute od ponoći za lokalno vrijeme `Date`-a. */
export function minutesOfDay(date: Date): number {
  return date.getHours() * 60 + date.getMinutes();
}
