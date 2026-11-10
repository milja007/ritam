/**
 * Plan za danas pri ulasku (korak 17b, Borna 2026-11-10): kad za danas nema plana, Danas odmah vodi
 * u izradu plana **od sada prema naprijed** — ništa u prošlosti, prvi termin na sljedećih 5 min.
 * Glavni unos je tipkanje (što + od–do ili trajanje); upisane ideje se pamte (naziv, trajanje, doba dana).
 * Čista logika: bez React importa.
 */
import type { BlockKind, ScheduleBlock } from '../domain';
import { formatClock, parseClock } from '../time/clock';
import { addDays } from '../time/local-date';
import { isBlockDraftValid, LAST_END, type BlockDraft } from './block-draft';
import { pickKey } from './learned-picks';
import { DAY_PART_START, DAY_PARTS, parsePlanEntry, type DayPart } from './plan-entry';

/** Plan za danas počinje na sljedećoj granici od ovoliko minuta. */
export const TODAY_PLAN_STEP_MINUTES = 5;
/** Trajanje tipkanog unosa bez vremena (ili samo s početkom). */
export const TODAY_DEFAULT_MINUTES = 60;
/** Najkraći blok koji se još smije složiti do kraja dana. */
export const TODAY_MIN_BLOCK_MINUTES = 5;
/**
 * Koliko minuta smije biti "prošao" početak stavke pri potvrdi: dok korisnik slaže plan, sat ide,
 * pa stavka koja je počela prije par minuta postaje trenutna aktivnost, ne greška.
 */
export const TODAY_PLAN_GRACE_MINUTES = 10;
/** Prije ovog sata dan još pripada jučer (kao večernji upit) — plan se ne otvara sam. */
export const TODAY_PLAN_AUTO_OPEN_FROM_MINUTES = 4 * 60;

type Timed = Pick<ScheduleBlock, 'start' | 'end' | 'kind'>;
type HistoryBlock = Pick<ScheduleBlock, 'date' | 'title' | 'start' | 'end' | 'kind' | 'status'>;

const clock = (minutes: number): string => formatClock(minutes) ?? '00:00';

/** Ima li dan plan: barem jedan blok osim sna (san dolazi iz jutarnje prijave, nije plan). */
export function needsTodayPlan(blocks: readonly Pick<ScheduleBlock, 'kind'>[]): boolean {
  return !blocks.some((block) => block.kind !== 'sleep');
}

/** Treba li Danas sam otvoriti izradu plana (dan učitan, nema plana, nije prije 04:00). */
export function shouldAutoOpenTodayPlan(
  blocks: readonly Pick<ScheduleBlock, 'kind'>[],
  nowMinutes: number,
): boolean {
  return nowMinutes >= TODAY_PLAN_AUTO_OPEN_FROM_MINUTES && needsTodayPlan(blocks);
}

/** Početak plana: sljedeća granica od 5 min (točno na granici → ta minuta). */
export function todayPlanStart(nowMinutes: number): number {
  const step = TODAY_PLAN_STEP_MINUTES;
  return Math.ceil(Math.max(0, nowMinutes) / step) * step;
}

/** Zauzeti rasponi istog dana (san i blokovi preko ponoći se ne gledaju), poredani po početku. */
function busyRanges(occupied: readonly Timed[]): { start: number; end: number }[] {
  const ranges: { start: number; end: number }[] = [];
  for (const block of occupied) {
    if (block.kind === 'sleep') continue;
    const start = parseClock(block.start);
    const end = parseClock(block.end);
    if (start === null || end === null || end <= start) continue;
    ranges.push({ start, end });
  }
  return ranges.sort((a, b) => a.start - b.start || a.end - b.end);
}

const roundUp = (minutes: number) =>
  Math.ceil(minutes / TODAY_PLAN_STEP_MINUTES) * TODAY_PLAN_STEP_MINUTES;

/**
 * Prvi slobodni termin zadanog trajanja koji počinje najranije u `fromMinutes`: prvo prva rupa u
 * koju stane cijeli, inače iza zadnjeg bloka (skraćen do 23:59 ako treba). Nema mjesta → `null`.
 */
export function nextFreeSlotFrom(
  occupied: readonly Timed[],
  minutes: number,
  fromMinutes: number,
): { start: string; end: string } | null {
  const duration = Math.max(minutes, TODAY_MIN_BLOCK_MINUTES);
  let start = roundUp(fromMinutes);
  for (const range of busyRanges(occupied)) {
    if (range.end <= start) continue;
    if (range.start >= start + duration) break; // rupa prije ovog bloka je dovoljna
    start = roundUp(Math.max(start, range.end));
  }
  const end = Math.min(start + duration, LAST_END);
  if (end - start < TODAY_MIN_BLOCK_MINUTES) return null;
  return { start: clock(start), end: clock(end) };
}

/** Jutro do 12:00, poslijepodne do 17:00, večer poslije (noć prije 05:00 se broji kao večer). */
export function dayPartOf(minutes: number): DayPart {
  if (minutes >= 5 * 60 && minutes < 12 * 60) return 'morning';
  if (minutes >= 12 * 60 && minutes < 17 * 60) return 'afternoon';
  return 'evening';
}

/** Zapamćena ideja: nešto što je korisnik već upisao, s trajanjem i dobom dana. */
export type PlanIdea = {
  /** Stabilan ključ: `own:<normalizirani naziv>`. */
  key: string;
  title: string;
  kind: Extract<BlockKind, 'task' | 'fixed'>;
  minutes: number;
  bestPart: DayPart;
};

/** Koliko dana unatrag se traže vlastite ideje. */
export const OWN_IDEAS_WINDOW_DAYS = 28;
/** Najviše vlastitih ideja u popisu. */
export const OWN_IDEAS_MAX = 8;

/** Najčešća vrijednost; izjednačenje → prva (popis je od najnovijeg). */
function mostCommon<T>(values: readonly T[]): T | undefined {
  const counts = new Map<T, number>();
  let best: T | undefined;
  let bestCount = 0;
  for (const value of values) {
    const count = (counts.get(value) ?? 0) + 1;
    counts.set(value, count);
    if (count > bestCount) {
      best = value;
      bestCount = count;
    }
  }
  return best;
}

/**
 * Vlastite ideje: sve što je korisnik već jednom upisao kao Zadatak ili Fiksno u zadnja 4 tjedna
 * (bez premještenih), s najčešćim trajanjem i dobom dana najčešćeg početka. Nazivi koji su već u
 * planu (`skipTitles`) se preskaču. Poredano po broju dana, pa najnovije.
 */
export function ownIdeas(
  history: readonly HistoryBlock[],
  date: string,
  skipTitles: readonly string[] = [],
): PlanIdea[] {
  const from = addDays(date, -OWN_IDEAS_WINDOW_DAYS);
  if (from === null) return [];
  const skip = new Set(skipTitles.map(pickKey));
  const groups = new Map<
    string,
    { title: string; kind: 'task' | 'fixed'; start: number; minutes: number; date: string }[]
  >();
  const recent = [...history]
    .filter((block) => block.date >= from && block.date < date)
    .sort((a, b) => b.date.localeCompare(a.date) || b.start.localeCompare(a.start));
  for (const block of recent) {
    if ((block.kind !== 'task' && block.kind !== 'fixed') || block.status === 'moved') continue;
    const start = parseClock(block.start);
    const end = parseClock(block.end);
    if (start === null || end === null || end <= start) continue;
    const key = pickKey(block.title);
    if (key.length === 0 || skip.has(key)) continue;
    const group = groups.get(key) ?? [];
    group.push({ title: block.title.trim(), kind: block.kind, start, minutes: end - start, date: block.date });
    groups.set(key, group);
  }

  const ideas: (PlanIdea & { days: number; latest: string })[] = [];
  for (const [key, entries] of groups) {
    const latest = entries[0];
    const minutes = mostCommon(entries.map((entry) => entry.minutes));
    const start = mostCommon(entries.map((entry) => entry.start));
    const kind = mostCommon(entries.map((entry) => entry.kind));
    if (latest === undefined || minutes === undefined || start === undefined || kind === undefined) continue;
    ideas.push({
      key: `own:${key}`,
      title: latest.title,
      kind,
      minutes,
      bestPart: dayPartOf(start),
      days: new Set(entries.map((entry) => entry.date)).size,
      latest: latest.date,
    });
  }
  return ideas
    .sort((a, b) => b.days - a.days || b.latest.localeCompare(a.latest) || a.title.localeCompare(b.title))
    .slice(0, OWN_IDEAS_MAX)
    .map(({ days: _days, latest: _latest, ...idea }) => idea);
}

/** 0 = trenutno doba dana, 1–2 = kasnije danas (bliže prvo), 3 = već prošlo. */
function partRank(part: DayPart, nowMinutes: number): number {
  const now = DAY_PARTS.indexOf(dayPartOf(nowMinutes));
  const index = DAY_PARTS.indexOf(part);
  return index >= now ? index - now : DAY_PARTS.length;
}

/**
 * Redoslijed ideja: prvo one za trenutno doba dana, pa za kasnije (bliže doba prvo), a ideje čije je doba prošlo na
 * kraju (i dalje se mogu odabrati). Unutar skupine ostaje zadani redoslijed. Ideje čiji je naziv
 * već u planu (`skipTitles`) se skrivaju.
 */
export function rankIdeas(
  ideas: readonly PlanIdea[],
  nowMinutes: number,
  skipTitles: readonly string[] = [],
): PlanIdea[] {
  const skip = new Set(skipTitles.map(pickKey));
  return ideas
    .map((idea, index) => ({ idea, index, rank: partRank(idea.bestPart, nowMinutes) }))
    .filter(({ idea }) => !skip.has(pickKey(idea.title)))
    .sort((a, b) => a.rank - b.rank || a.index - b.index)
    .map(({ idea }) => idea);
}

/** Nacrt iz ideje u prvi slobodni termin od sada. Nema mjesta do kraja dana → `null`. */
export function ideaDraft(idea: PlanIdea, occupied: readonly Timed[], nowMinutes: number): BlockDraft | null {
  const slot = nextFreeSlotFrom(occupied, idea.minutes, todayPlanStart(nowMinutes));
  return slot === null ? null : { title: idea.title, kind: idea.kind, ...slot };
}

/**
 * Tipkani unos za danas ("Ponavljanje kemije 45 min poslijepodne", "Zubar u 16", "Trening 18-19"):
 * prepoznato vrijeme vrijedi samo ako nije u prošlosti; inače prvi slobodni termin navedenog
 * trajanja (ili trajanja raspona, ili 1 h) — od sada, a s dobom dana od početka tog doba (nikad prije
 * sada). Prazan unos ili nema mjesta → `null`.
 */
export function typedTodayDraft(
  text: string,
  occupied: readonly Timed[],
  nowMinutes: number,
): BlockDraft | null {
  const entry = parsePlanEntry(text);
  if (!entry) return null;
  const from = todayPlanStart(nowMinutes);
  const start = entry.start === null ? null : parseClock(entry.start);
  const parsedEnd = entry.end === null ? null : parseClock(entry.end);
  const minutes =
    start !== null && parsedEnd !== null && parsedEnd > start
      ? parsedEnd - start
      : (entry.minutes ?? TODAY_DEFAULT_MINUTES);
  if (start !== null && start >= from) {
    const end = parsedEnd ?? Math.min(start + minutes, LAST_END);
    if (end > start) return { title: entry.title, kind: 'task', start: clock(start), end: clock(end) };
  }
  const partFrom = entry.part === null ? from : Math.max(from, DAY_PART_START[entry.part]);
  const slot =
    nextFreeSlotFrom(occupied, minutes, partFrom) ??
    (partFrom > from ? nextFreeSlotFrom(occupied, minutes, from) : null);
  return slot === null ? null : { title: entry.title, kind: 'task', ...slot };
}

/** Početak nacrta je u prošlosti (više od `TODAY_PLAN_GRACE_MINUTES` prije sada). */
export function startsInPast(draft: Pick<BlockDraft, 'start'>, nowMinutes: number): boolean {
  const start = parseClock(draft.start);
  return start === null || start < nowMinutes - TODAY_PLAN_GRACE_MINUTES;
}

/**
 * Može li se plan za danas potvrditi: barem jedna stavka, sve prolaze validaciju bloka i nijedna ne
 * počinje u prošlosti (dok korisnik slaže plan, sat ide — tada stavku treba pomaknuti; mala zadrška je dopuštena).
 */
export function isTodayPlanValid(drafts: readonly BlockDraft[], nowMinutes: number): boolean {
  return (
    drafts.length > 0 &&
    drafts.every((draft) => isBlockDraftValid(draft) && !startsInPast(draft, nowMinutes))
  );
}
