/**
 * Brzi odabiri koji uče iz povijesti (odluka P25, 2026-11-10): blok koji se ponavlja (npr. trening
 * svako jutro ili večer) nudi se u svom uobičajenom terminu; korisnik ga uvijek može prilagoditi.
 * Čista logika: bez React importa.
 */
import type { ScheduleBlock } from '../domain';
import { parseClock } from '../time/clock';
import { addDays } from '../time/local-date';
import { weekdayOf } from './wake';
import type { BlockDraft } from './block-draft';

/** Koliko dana unatrag se gleda povijest. */
export const LEARNED_WINDOW_DAYS = 28;
/** Blok se "ponavlja" kad se pojavi barem ovoliko različitih dana u prozoru. */
export const LEARNED_MIN_DAYS = 2;
/** Najviše naučenih odabira u popisu. */
export const LEARNED_MAX_PICKS = 6;

type HistoryBlock = Pick<ScheduleBlock, 'date' | 'title' | 'start' | 'end' | 'kind' | 'status'>;

export type LearnedPick = BlockDraft & {
  /** Ključ grupe (normalizirani naziv) — stabilan za React `key` i za skrivanje već dodanih. */
  key: string;
  /** Broj različitih dana u prozoru. */
  days: number;
  /** Od toga isti dan u tjednu kao ciljni dan. */
  sameWeekdayDays: number;
};

/** Naziv za usporedbu: mala slova, jedan razmak. */
export function pickKey(title: string): string {
  return title.trim().replace(/\s+/g, ' ').toLocaleLowerCase();
}

/** Ulazi li blok u učenje: samo ručni Zadatak / Fiksno, ne premješten (njegov termin nije stvaran). */
function learnable(block: HistoryBlock): block is HistoryBlock & { kind: 'task' | 'fixed' } {
  return (block.kind === 'task' || block.kind === 'fixed') && block.status !== 'moved';
}

/** Najčešća vrijednost; izjednačenje → najnovija (popis je od najnovijeg). */
function mostCommon<T>(values: readonly T[]): T | undefined {
  const counts = new Map<T, number>();
  for (const value of values) counts.set(value, (counts.get(value) ?? 0) + 1);
  let best: T | undefined;
  let bestCount = 0;
  for (const value of values) {
    const count = counts.get(value) ?? 0;
    if (count > bestCount) {
      best = value;
      bestCount = count;
    }
  }
  return best;
}

/**
 * Naučeni brzi odabiri za dan `date` iz blokova prethodnih `LEARNED_WINDOW_DAYS` dana. Blok se nudi
 * kad se isti naziv pojavio barem `LEARNED_MIN_DAYS` različitih dana; termin i vrsta su najčešći —
 * prednost imaju pojave na isti dan u tjednu (trening utorkom u 18:00). Nazivi koji su već u planu
 * tog dana (`existingTitles`) se preskaču. Poredano: isti dan u tjednu, broj dana, najnovije.
 */
export function learnedQuickPicks(
  history: readonly HistoryBlock[],
  date: string,
  existingTitles: readonly string[] = [],
): LearnedPick[] {
  const from = addDays(date, -LEARNED_WINDOW_DAYS);
  const weekday = weekdayOf(date);
  if (from === null || weekday === null) return [];
  const skip = new Set(existingTitles.map(pickKey));

  const groups = new Map<string, (HistoryBlock & { kind: 'task' | 'fixed' })[]>();
  const recent = [...history]
    .filter((block) => block.date >= from && block.date < date)
    .sort((a, b) => b.date.localeCompare(a.date) || b.start.localeCompare(a.start));
  for (const block of recent) {
    if (!learnable(block)) continue;
    const start = parseClock(block.start);
    const end = parseClock(block.end);
    if (start === null || end === null || end <= start) continue;
    const key = pickKey(block.title);
    if (key.length === 0 || skip.has(key)) continue;
    const group = groups.get(key) ?? [];
    group.push(block);
    groups.set(key, group);
  }

  const picks: (LearnedPick & { latest: string })[] = [];
  for (const [key, blocks] of groups) {
    const days = new Set(blocks.map((block) => block.date)).size;
    if (days < LEARNED_MIN_DAYS) continue;
    const sameWeekday = blocks.filter((block) => weekdayOf(block.date) === weekday);
    const basis = sameWeekday.length > 0 ? sameWeekday : blocks;
    const slot = mostCommon(basis.map((block) => `${block.start}-${block.end}`));
    const kind = mostCommon(blocks.map((block) => block.kind));
    const latest = blocks[0];
    if (slot === undefined || kind === undefined || latest === undefined) continue;
    const [start = latest.start, end = latest.end] = slot.split('-');
    picks.push({
      key,
      title: latest.title.trim(),
      kind,
      start,
      end,
      days,
      sameWeekdayDays: new Set(sameWeekday.map((block) => block.date)).size,
      latest: latest.date,
    });
  }

  return picks
    .sort(
      (a, b) =>
        b.sameWeekdayDays - a.sameWeekdayDays ||
        b.days - a.days ||
        b.latest.localeCompare(a.latest) ||
        a.start.localeCompare(b.start),
    )
    .slice(0, LEARNED_MAX_PICKS)
    .map(({ latest: _latest, ...pick }) => pick);
}
