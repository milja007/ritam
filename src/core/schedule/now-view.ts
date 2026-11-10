/**
 * Veliki raspored dana (korak 17c): što traje sada, što slijedi, koliko je ostalo
 * (u sekundama) i koje akcije smije koji blok. Čista logika: bez React importa.
 */
import type { BlockStatus, ScheduleBlock } from '../domain';
import { blockPhase, blockRange, type BlockPhase } from './timeline';

export const SECONDS_PER_DAY = 24 * 60 * 60;

type ViewBlock = Pick<ScheduleBlock, 'id' | 'start' | 'end' | 'kind' | 'status'>;

export type DaySchedule<B extends ViewBlock> = {
  /** Aktivnost koja traje sada (san se ne računa), ili `null` ("slobodno"). */
  current: B | null;
  /** Sljedeća aktivnost koja još nije počela (bez sna i otkazanih), ili `null`. */
  next: B | null;
  /** Blokovi koji su završili (bez sna), po početku. */
  past: B[];
  /** Blokovi od sada prema naprijed (trenutni nije uključen; san jest), po početku. */
  upcoming: B[];
  /** Sekunde do kraja trenutne aktivnosti (`null` kad ništa ne traje). */
  secondsLeft: number | null;
  /** Sekunde do početka sljedeće aktivnosti (`null` kad je nema). */
  secondsUntilNext: number | null;
  /** Koliko je trenutne aktivnosti prošlo, 0–1 (`null` kad ništa ne traje). */
  progress: number | null;
};

/** Sekunde od ponoći za lokalno vrijeme `Date`-a. */
export function secondsOfDay(date: Date): number {
  return date.getHours() * 3600 + date.getMinutes() * 60 + date.getSeconds();
}

/** Otkazan blok (Otkaži = `skipped`) ne traje i ne dolazi. */
export function isCancelled(block: Pick<ScheduleBlock, 'status'>): boolean {
  return block.status === 'skipped';
}

function startOf(block: ViewBlock): number {
  return blockRange(block)?.start ?? Number.MAX_SAFE_INTEGER;
}

/**
 * Podjela dana prema `nowSeconds` (sekunde od ponoći). Ako se aktivnosti preklapaju,
 * trenutna je ona koja je počela kasnije (kao `currentBlockId`). Otkazane ne mogu biti
 * trenutne ni sljedeće, ali ostaju na rasporedu (prekrižene).
 */
export function daySchedule<B extends ViewBlock>(blocks: readonly B[], nowSeconds: number): DaySchedule<B> {
  const nowMinutes = Math.floor(nowSeconds / 60);
  const sorted = [...blocks].sort((a, b) => startOf(a) - startOf(b));

  let current: B | null = null;
  for (const block of sorted) {
    if (block.kind === 'sleep' || isCancelled(block)) continue;
    if (blockPhase(block, nowMinutes) === 'current') current = block; // kasniji početak pobjeđuje
  }

  const past: B[] = [];
  const upcoming: B[] = [];
  for (const block of sorted) {
    if (block === current) continue;
    const phase = blockPhase(block, nowMinutes);
    if (phase === 'past') {
      if (block.kind !== 'sleep') past.push(block);
    } else {
      upcoming.push(block); // budući, ili preklopljeni blok koji još traje
    }
  }

  const next =
    upcoming.find(
      (block) =>
        block.kind !== 'sleep' && !isCancelled(block) && blockPhase(block, nowMinutes) === 'upcoming',
    ) ?? null;

  const range = current ? blockRange(current) : null;
  const secondsLeft = range ? Math.max(0, range.end * 60 - nowSeconds) : null;
  const progress = range
    ? Math.min(1, Math.max(0, (nowSeconds - range.start * 60) / ((range.end - range.start) * 60)))
    : null;
  const nextRange = next ? blockRange(next) : null;
  const secondsUntilNext = nextRange ? Math.max(0, nextRange.start * 60 - nowSeconds) : null;

  return { current, next, past, upcoming, secondsLeft, secondsUntilNext, progress };
}

const pad = (value: number) => String(value).padStart(2, '0');

/** Sat u sekundama: 49530 → "13:45:30". */
export function formatClockSeconds(secondsSinceMidnight: number): string {
  const total = ((Math.floor(secondsSinceMidnight) % SECONDS_PER_DAY) + SECONDS_PER_DAY) % SECONDS_PER_DAY;
  return `${pad(Math.floor(total / 3600))}:${pad(Math.floor((total % 3600) / 60))}:${pad(total % 60)}`;
}

/** Odbrojavanje: 247 → "4:07", 3909 → "1:05:09"; negativno → "0:00". */
export function formatCountdown(seconds: number): string {
  const total = Math.max(0, Math.floor(seconds));
  const hours = Math.floor(total / 3600);
  const minutes = Math.floor((total % 3600) / 60);
  const secs = total % 60;
  return hours > 0 ? `${hours}:${pad(minutes)}:${pad(secs)}` : `${minutes}:${pad(secs)}`;
}

export type BlockActions = {
  /** Komentar (= bilješka): samo trenutna i prošle aktivnosti. */
  comment: boolean;
  /** Otkaži: samo trenutna i buduće. */
  cancel: boolean;
  /** Prijava U redu / Djelomično / Nije: prošle (trenutna smije samo U redu — gotova ranije). */
  report: readonly BlockStatus[];
};

/** Koje akcije smije blok u danoj fazi. San nema akcija (osim uređivanja). */
export function blockActions(block: Pick<ScheduleBlock, 'kind'>, phase: BlockPhase): BlockActions {
  if (block.kind === 'sleep') return { comment: false, cancel: false, report: [] };
  switch (phase) {
    case 'past':
      return { comment: true, cancel: false, report: ['done', 'partial', 'skipped'] };
    case 'current':
      return { comment: true, cancel: true, report: ['done'] };
    case 'upcoming':
      return { comment: false, cancel: true, report: [] };
  }
}

/**
 * Prijava s rasporeda: ponovni dodir istog statusa ga vraća na `planned` (kao kvačica),
 * inače se postavlja odabrani.
 */
export function reportedStatus(current: BlockStatus, chosen: BlockStatus): BlockStatus {
  return current === chosen ? 'planned' : chosen;
}

export const BLOCK_NOTE_MAX = 2000;

/** Bilješka iz polja: obrezana; prazna → `null`; predugačka se skraćuje. */
export function normalizeNote(value: string): string | null {
  const trimmed = value.trim();
  if (trimmed.length === 0) return null;
  return trimmed.slice(0, BLOCK_NOTE_MAX);
}
