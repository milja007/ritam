/**
 * Tipkani unos plana: "što" + od–do, početak, trajanje i/ili doba dana. Bez LLM-a; LLM
 * `parse-input` (korak 21) i glas (korak 30) kasnije zamjenjuju ovo.
 * Čista logika: bez React importa.
 */
import { formatClock } from '../time/clock';

const clock = (minutes: number): string => formatClock(minutes) ?? '00:00';

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


/** Doba dana (za ideje i tipkani unos). */
export const DAY_PARTS = ['morning', 'afternoon', 'evening'] as const;
export type DayPart = (typeof DAY_PARTS)[number];

/** Početak doba dana za slaganje termina ("poslijepodne" → od 12:00). */
export const DAY_PART_START: Record<DayPart, number> = {
  morning: 8 * 60,
  afternoon: 12 * 60,
  evening: 17 * 60,
};

/** Najkraće i najdulje prepoznato trajanje. */
export const MIN_ENTRY_MINUTES = 5;
export const MAX_ENTRY_MINUTES = 12 * 60;

/** "45 min", "45min", "1h", "1,5 h", "2 sata", "90 minuta", "1 hour". */
const DURATION = new RegExp(
  String.raw`(?:^|\s)(\d{1,3}(?:[.,]\d{1,2})?)\s*(min|mins|minuta|minute|minutes|h|sat|sata|sati|hr|hrs|hour|hours)\.?(?=\s|[,;]|$)`,
  'iu',
);

const PART_WORDS: readonly [DayPart, RegExp][] = [
  ['morning', /(?:^|\s)(?:ujutro|ujutru|jutros|in the morning|morning)(?=\s|[,;]|$)/iu],
  ['afternoon', /(?:^|\s)(?:poslijepodne|popodne|poslije podne|in the afternoon|afternoon)(?=\s|[,;]|$)/iu],
  ['evening', /(?:^|\s)(?:navečer|navecer|uvečer|uvecer|večeras|veceras|in the evening|evening|tonight)(?=\s|[,;]|$)/iu],
];

export type PlanEntry = TypedEntry & {
  /** Trajanje u minutama ako je navedeno ("45 min"), inače `null`. */
  minutes: number | null;
  /** Doba dana ako je navedeno ("poslijepodne"), inače `null`. */
  part: DayPart | null;
};

/**
 * Tipkani unos s trajanjem i dobom dana: "Ponavljanje kemije 45 min poslijepodne",
 * "Trening 1h", "Zubar u 16", "Trening 18-19". Vrijeme se čita prvo (kao `parseTypedEntry`),
 * zatim se iz ostatka naziva miču trajanje i doba dana. Prazan naziv → `null`.
 */
export function parsePlanEntry(text: string): PlanEntry | null {
  const base = parseTypedEntry(text);
  if (!base) return null;
  let title = base.title;
  let minutes: number | null = null;
  const duration = DURATION.exec(title);
  if (duration) {
    const amount = Number((duration[1] ?? '').replace(',', '.'));
    const unit = (duration[2] ?? '').toLocaleLowerCase();
    const value = Math.round(/^(h|sat|sata|sati|hr|hrs|hour|hours)$/.test(unit) ? amount * 60 : amount);
    if (Number.isFinite(value) && value >= MIN_ENTRY_MINUTES && value <= MAX_ENTRY_MINUTES) {
      minutes = value;
      title = cleanTitle(title.replace(duration[0], ' '));
    }
  }
  let part: DayPart | null = null;
  for (const [candidate, pattern] of PART_WORDS) {
    const match = pattern.exec(title);
    if (match) {
      part = candidate;
      title = cleanTitle(title.replace(match[0], ' '));
      break;
    }
  }
  // Unos samo od trajanja/doba dana ("45 min") ostaje kakav je — naziv ne smije biti prazan.
  if (title.length === 0) return { ...base, minutes: null, part: null };
  return { ...base, title, minutes, part };
}
