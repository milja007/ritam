/**
 * Arhiva dijagnoza (Ž12, dio koraka 37c): popis prošlih dnevnih dijagnoza, grupiran po mjesecu.
 * Čista logika: bez React importa i bez dodira baze — ulaz su već pročitani zapisi.
 */
import type { DiagnosisLine, Trend } from './day-diagnosis';

/** Jedan red u arhivi: dan, trend i „Ukratko“ redak spremljene dijagnoze. */
export type ArchiveEntry = {
  /** Dan dijagnoze "YYYY-MM-DD". */
  date: string;
  trend: Trend;
  summary: DiagnosisLine;
  /** Je li dijagnoza već pokupljena (otvorena na Dan). */
  seen: boolean;
};

/** Mjesec arhive: zaglavlje "YYYY-MM" i njegovi dani, najnoviji prvi. */
export type ArchiveMonth = { month: string; entries: ArchiveEntry[] };

/**
 * Arhiva po mjesecima, najnoviji mjesec i dan prvi. Zapisi s neispravnim danom se izbacuju, a
 * isti dan se ne ponavlja (prvi pročitani zapis za taj dan vrijedi).
 */
export function archiveByMonth(entries: readonly ArchiveEntry[]): ArchiveMonth[] {
  const seenDates = new Set<string>();
  const months = new Map<string, ArchiveEntry[]>();
  for (const entry of entries) {
    if (entry.date.length !== 10 || seenDates.has(entry.date)) continue;
    seenDates.add(entry.date);
    const month = entry.date.slice(0, 7);
    const list = months.get(month) ?? [];
    list.push(entry);
    months.set(month, list);
  }
  return [...months.entries()]
    .sort(([a], [b]) => b.localeCompare(a))
    .map(([month, list]) => ({
      month,
      entries: [...list].sort((a, b) => b.date.localeCompare(a.date)),
    }));
}

/** Koliko dijagnoza arhiva pokaže prije „Prikaži još“, i koliko ih svaki dodir doda. */
export const ARCHIVE_PAGE = 10;

/**
 * Koliko zapisa tražiti iz baze za stranicu `page` (prva je 1). Traži se jedan više od
 * prikazanog, da se zna postoji li još — bez zasebnog prebrojavanja.
 */
export function archiveLimit(page: number): number {
  const safe = Number.isInteger(page) && page > 0 ? page : 1;
  return safe * ARCHIVE_PAGE + 1;
}

/** Što prikazati od pročitanih zapisa i ima li ih još (ulaz je rezultat `archiveLimit(page)`). */
export function archivePage(
  entries: readonly ArchiveEntry[],
  page: number,
): { entries: ArchiveEntry[]; more: boolean } {
  const safe = Number.isInteger(page) && page > 0 ? page : 1;
  const shown = safe * ARCHIVE_PAGE;
  return { entries: entries.slice(0, shown), more: entries.length > shown };
}
