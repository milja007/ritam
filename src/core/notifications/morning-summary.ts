/**
 * Fiksni sadržaj jutarnje obavijesti (odluka P33, 2026-11-10): "Danas 4 bloka, od toga 2 zadatka.
 * Prvi: Posao u 09:00." Čista logika: bez Reacta i bez expo-notifications.
 */
import type { ScheduleBlock } from '../domain';

export type MorningSummary = {
  /** Blokovi dana osim sna (premješteni i preskočeni se ne broje). */
  blocks: number;
  /** Od toga blokovi vrste Zadatak. */
  tasks: number;
  /** Najraniji blok dana, ili `null` kad dan nema blokova. */
  first: { title: string; start: string } | null;
};

/** Ulazi li blok u jutarnji pregled dana. */
function counts(block: Pick<ScheduleBlock, 'kind' | 'status'>): boolean {
  return block.kind !== 'sleep' && block.status !== 'moved' && block.status !== 'skipped';
}

/** Pregled dana `date` iz blokova (blokovi drugih dana se ignoriraju). */
export function morningSummary(
  blocks: readonly Pick<ScheduleBlock, 'date' | 'title' | 'start' | 'kind' | 'status'>[],
  date: string,
): MorningSummary {
  const day = blocks
    .filter((block) => block.date === date && counts(block))
    .sort((a, b) => a.start.localeCompare(b.start) || a.title.localeCompare(b.title));
  const first = day[0];
  return {
    blocks: day.length,
    tasks: day.filter((block) => block.kind === 'task').length,
    first: first === undefined ? null : { title: first.title, start: first.start },
  };
}

/**
 * Kratki, stabilni ključ sadržaja (djb2, base36) — dodaje se id-ju jutarnje obavijesti, pa promjena
 * plana dana daje novi id i usklađivanje ponovo zakaže obavijest s novim tekstom.
 */
export function contentKey(text: string): string {
  let hash = 5381;
  for (let index = 0; index < text.length; index += 1) {
    hash = ((hash * 33) ^ text.charCodeAt(index)) >>> 0;
  }
  return hash.toString(36);
}
