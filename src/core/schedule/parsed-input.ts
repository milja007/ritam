/**
 * Korak 21 u appu: odgovor Edge Functiona `parse-input` se ponovno provjerava (app ne vjeruje
 * mreži) i pretvara u nacrte blokova; bez oblaka se unos s više stavki dijeli lokalno.
 * Čista logika: bez React importa.
 */
import type { ScheduleBlock } from '../domain';
import { parseClock } from '../time/clock';
import type { BlockDraft } from './block-draft';
import type { ParsedBlock } from './edge-types';
import { MAX_ENTRY_MINUTES, MIN_ENTRY_MINUTES, type DayPart, type PlanEntry } from './plan-entry';
import { entryDraft, typedDraft } from './tomorrow';

type Occupied = Pick<ScheduleBlock, 'start' | 'end' | 'kind'>;

/** Najviše stavki iz jednog unosa (zaštita od odgovora koji „poplavi“ plan). */
export const MAX_PARSED_BLOCKS = 20;
/** Najdulji naziv iz modela (isto kao naziv bloka u uređivaču). */
const MAX_TITLE = 200;

const TIMES_OF_DAY = ['morning', 'afternoon', 'evening', 'night'] as const;

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const clockOrNull = (value: unknown): string | null | undefined => {
  if (value === null || value === undefined) return null;
  return typeof value === 'string' && /^\d{2}:\d{2}$/.test(value) && parseClock(value) !== null ? value : undefined;
};

function readBlock(raw: unknown): ParsedBlock | null {
  if (!isRecord(raw)) return null;
  const title = typeof raw.title === 'string' ? raw.title.replace(/\s+/g, ' ').trim() : '';
  if (title.length === 0 || title.length > MAX_TITLE) return null;
  const start = clockOrNull(raw.start);
  const end = clockOrNull(raw.end);
  if (start === undefined || end === undefined) return null;
  const duration = raw.durationMinutes ?? null;
  if (duration !== null && (typeof duration !== 'number' || !Number.isInteger(duration) || duration <= 0)) return null;
  const timeOfDay = raw.timeOfDay ?? null;
  if (timeOfDay !== null && !(TIMES_OF_DAY as readonly unknown[]).includes(timeOfDay)) return null;
  return {
    title,
    start,
    end,
    durationMinutes: duration,
    timeOfDay: timeOfDay as ParsedBlock['timeOfDay'],
  };
}

/**
 * Odgovor `parse-input` → valjani blokovi (nevaljani otpadaju, najviše `MAX_PARSED_BLOCKS`).
 * `null` kad odgovor nije `{ blocks: [...] }` — tada app radi lokalno.
 */
export function readParseInputResponse(raw: unknown): ParsedBlock[] | null {
  if (!isRecord(raw) || !Array.isArray(raw.blocks)) return null;
  const blocks: ParsedBlock[] = [];
  for (const entry of raw.blocks) {
    const block = readBlock(entry);
    if (block) blocks.push(block);
    if (blocks.length === MAX_PARSED_BLOCKS) break;
  }
  return blocks;
}

/** Noć nema svoj početak za slaganje — kasno se slaže kao večer. */
const partOf = (timeOfDay: ParsedBlock['timeOfDay']): DayPart | null =>
  timeOfDay === null ? null : timeOfDay === 'night' ? 'evening' : timeOfDay;

/** Blok modela → unos plana (isti oblik kao tipkani unos). Kraj vrijedi samo uz raniji početak. */
export function parsedBlockToEntry(block: ParsedBlock): PlanEntry {
  const start = block.start;
  const startMinutes = start === null ? null : parseClock(start);
  const endMinutes = block.end === null ? null : parseClock(block.end);
  const end = startMinutes !== null && endMinutes !== null && endMinutes > startMinutes ? block.end : null;
  const duration = block.durationMinutes;
  const minutes =
    duration !== null && duration >= MIN_ENTRY_MINUTES && duration <= MAX_ENTRY_MINUTES ? duration : null;
  return { title: block.title, start, end, minutes, part: partOf(block.timeOfDay) };
}

/**
 * Blokovi modela → nacrti za sutra. Svaki sljedeći vidi već dodane, pa se slobodni termini
 * ne preklapaju (osim kad je vrijeme izričito navedeno — kao i kod tipkanja).
 */
export function parsedBlocksToDrafts(
  blocks: readonly ParsedBlock[],
  occupied: readonly Occupied[],
  wakeTime: string,
): BlockDraft[] {
  const drafts: BlockDraft[] = [];
  for (const block of blocks) {
    drafts.push(entryDraft(parsedBlockToEntry(block), [...occupied, ...drafts], wakeTime));
  }
  return drafts;
}

/**
 * Unos s više stavki → dijelovi. Dijeli se samo na `;`, novi red i zarez iza kojeg nije
 * znamenka (pa „1,5 h“ i „18,30“ ostaju cijeli). Prazni dijelovi otpadaju.
 */
export function splitEntries(text: string): string[] {
  return text
    .split(/[;\n]|,(?!\d)/)
    .map((part) => part.trim())
    .filter((part) => part.length > 0)
    .slice(0, MAX_PARSED_BLOCKS);
}

/** Lokalni nacrti za unos s jednom ili više stavki (bez oblaka ili kad `parse-input` ne uspije). */
export function typedDrafts(text: string, occupied: readonly Occupied[], wakeTime: string): BlockDraft[] {
  const drafts: BlockDraft[] = [];
  for (const part of splitEntries(text)) {
    const draft = typedDraft(part, [...occupied, ...drafts], wakeTime);
    if (draft) drafts.push(draft);
  }
  return drafts;
}

/** Riječi koje spajaju više aktivnosti u jednoj rečenici („…, pa…“, „… and then …“). */
const JOINERS = /(?:^|\s)(?:i|pa|onda|zatim|poslije toga|and|then|after that)(?=\s)/iu;

/**
 * Isplati li se pitati model: unos s više stavki ili veznicima, ili duga rečenica. Kratak
 * jednostavan unos („Trening 18-19“) lokalno se razumije jednako dobro i bez čekanja.
 */
export function wantsSmartParse(text: string): boolean {
  const trimmed = text.trim();
  if (trimmed.length === 0) return false;
  return splitEntries(trimmed).length > 1 || JOINERS.test(trimmed) || trimmed.length > 60;
}
