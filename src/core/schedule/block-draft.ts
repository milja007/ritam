/**
 * Nacrt bloka za ručno dodavanje/uređivanje na timelineu Danas.
 * Čista logika: bez React importa. Vremena su "HH:MM"; koraci po 15 min.
 */
import { scheduleBlockSchema, type BlockKind, type LocalDate, type ScheduleBlock } from '../domain';
import { formatClock, MINUTES_PER_DAY, parseClock } from '../time/clock';

/** Tipovi koje korisnik bira ručno (kalendar, san i "iskrslo" dolaze iz drugih tokova). */
export const MANUAL_BLOCK_KINDS = ['task', 'fixed'] as const satisfies readonly BlockKind[];

export const BLOCK_STEP_MINUTES = 15;
export const DEFAULT_BLOCK_MINUTES = 60;
/** Najkasniji početak (23:45) i kraj (23:59) bloka unutar dana. */
export const LAST_START = MINUTES_PER_DAY - BLOCK_STEP_MINUTES;
export const LAST_END = MINUTES_PER_DAY - 1;

export type BlockDraft = {
  title: string;
  start: string;
  end: string;
  kind: BlockKind;
};

/** Polja za `createBlock` (isti oblik kao `ScheduleBlockInput` u repou). */
export type BlockDraftInput = Omit<ScheduleBlock, 'id' | 'userId' | 'createdAt' | 'updatedAt'>;

const clock = (minutes: number): string => formatClock(minutes) ?? '00:00';
const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

/** Sljedeća granica od 15 min strogo iznad (`+1`) ili ispod (`-1`) vrijednosti. */
function nextQuarter(minutes: number, direction: 1 | -1): number {
  const step = BLOCK_STEP_MINUTES;
  return direction === 1
    ? Math.floor(minutes / step) * step + step
    : Math.ceil(minutes / step) * step - step;
}

/** Je li blok preko ponoći (samo san smije). */
function wraps(draft: Pick<BlockDraft, 'start' | 'end' | 'kind'>): boolean {
  const start = parseClock(draft.start);
  const end = parseClock(draft.end);
  return draft.kind === 'sleep' && start !== null && end !== null && end <= start;
}

/**
 * Prijedlog novog bloka: počinje kad završi zadnji blok (ako je to poslije sada),
 * inače na prvih punih 15 min od sada; traje 1 h i ne prelazi kraj dana.
 */
export function newBlockDraft(
  blocks: readonly Pick<ScheduleBlock, 'start' | 'end' | 'kind'>[],
  nowMinutes: number,
): BlockDraft {
  let start = Math.ceil(nowMinutes / BLOCK_STEP_MINUTES) * BLOCK_STEP_MINUTES;
  for (const block of blocks) {
    if (wraps(block)) continue;
    const end = parseClock(block.end);
    if (end !== null && end > start) start = end;
  }
  start = clamp(start, 0, LAST_START);
  const end = Math.min(start + DEFAULT_BLOCK_MINUTES, LAST_END);
  return { title: '', start: clock(start), end: clock(end), kind: 'task' };
}

export function draftFromBlock(block: ScheduleBlock): BlockDraft {
  return { title: block.title, start: block.start, end: block.end, kind: block.kind };
}

/**
 * Pomak početka za jedan korak (±15 min, poravnato na četvrt sata). Trajanje se čuva:
 * kraj se pomiče zajedno s početkom (ne preko kraja dana). San se omata preko ponoći.
 */
export function shiftDraftStart(draft: BlockDraft, direction: 1 | -1): BlockDraft {
  const start = parseClock(draft.start);
  const end = parseClock(draft.end);
  if (start === null || end === null) return draft;
  if (draft.kind === 'sleep') {
    const next = (nextQuarter(start, direction) + MINUTES_PER_DAY) % MINUTES_PER_DAY;
    return { ...draft, start: clock(next) };
  }
  const nextStart = clamp(nextQuarter(start, direction), 0, LAST_START);
  const duration = Math.max(end - start, BLOCK_STEP_MINUTES);
  const nextEnd = Math.min(nextStart + duration, LAST_END);
  return { ...draft, start: clock(nextStart), end: clock(nextEnd) };
}

/** Pomak kraja za jedan korak; kraj ostaje barem 15 min nakon početka i najkasnije 23:59. */
export function shiftDraftEnd(draft: BlockDraft, direction: 1 | -1): BlockDraft {
  const start = parseClock(draft.start);
  const end = parseClock(draft.end);
  if (start === null || end === null) return draft;
  if (draft.kind === 'sleep') {
    const next = (nextQuarter(end, direction) + MINUTES_PER_DAY) % MINUTES_PER_DAY;
    return { ...draft, end: clock(next) };
  }
  const candidate = direction === 1 && end >= LAST_START ? LAST_END : nextQuarter(end, direction);
  const nextEnd = clamp(candidate, Math.min(start + BLOCK_STEP_MINUTES, LAST_END), LAST_END);
  return { ...draft, end: clock(nextEnd) };
}

export function canShiftStart(draft: BlockDraft, direction: 1 | -1): boolean {
  return shiftDraftStart(draft, direction).start !== draft.start;
}

export function canShiftEnd(draft: BlockDraft, direction: 1 | -1): boolean {
  return shiftDraftEnd(draft, direction).end !== draft.end;
}

/** Ulaz za repo: ručni blok je `user`/`planned` bez zadatka. Za uređivanje koristi samo naziv/vrijeme/tip. */
export function draftToInput(draft: BlockDraft, date: LocalDate): BlockDraftInput {
  return {
    date,
    title: draft.title.trim(),
    start: draft.start,
    end: draft.end,
    kind: draft.kind,
    taskId: null,
    source: 'user',
    status: 'planned',
  };
}

/** Patch za `updateBlock`: mijenja samo ono što nacrt uređuje (status, izvor i zadatak ostaju). */
export function draftToPatch(draft: BlockDraft): Pick<ScheduleBlock, 'title' | 'start' | 'end' | 'kind'> {
  return { title: draft.title.trim(), start: draft.start, end: draft.end, kind: draft.kind };
}

/** Prolazi li nacrt istu validaciju kao spremljeni blok (naziv, vremena, kraj nakon početka). */
export function isBlockDraftValid(draft: BlockDraft): boolean {
  const probe = {
    ...draftToInput(draft, '2000-01-01'),
    id: 'draft',
    userId: 'draft',
    createdAt: '2000-01-01T00:00:00.000Z',
    updatedAt: '2000-01-01T00:00:00.000Z',
  };
  return scheduleBlockSchema.safeParse(probe).success;
}
