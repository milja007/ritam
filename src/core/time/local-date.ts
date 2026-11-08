/**
 * Aritmetika nad lokalnim kalendarskim danom "YYYY-MM-DD".
 * Čista logika: bez React importa. Računa u UTC-u, pa vremenske zone i DST ne utječu na rezultat.
 */

const LOCAL_DATE_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/;
const MS_PER_DAY = 24 * 60 * 60 * 1000;

function toUtcMs(date: string): number | null {
  const match = LOCAL_DATE_PATTERN.exec(date);
  if (!match) return null;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const ms = Date.UTC(year, month - 1, day);
  const check = new Date(ms);
  if (check.getUTCFullYear() !== year || check.getUTCMonth() !== month - 1 || check.getUTCDate() !== day) {
    return null;
  }
  return ms;
}

function fromUtcMs(ms: number): string {
  const d = new Date(ms);
  const year = String(d.getUTCFullYear()).padStart(4, '0');
  const month = String(d.getUTCMonth() + 1).padStart(2, '0');
  const day = String(d.getUTCDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/** "2026-11-30" + 1 → "2026-12-01". Vraća `null` za neispravan datum ili necijeli pomak. */
export function addDays(date: string, days: number): string | null {
  const ms = toUtcMs(date);
  if (ms === null || !Number.isInteger(days)) return null;
  return fromUtcMs(ms + days * MS_PER_DAY);
}

/** Broj dana od `from` do `to` (pozitivno ako je `to` kasnije). `null` za neispravan datum. */
export function daysBetween(from: string, to: string): number | null {
  const a = toUtcMs(from);
  const b = toUtcMs(to);
  if (a === null || b === null) return null;
  return Math.round((b - a) / MS_PER_DAY);
}

/** Lokalni dan iz `Date` objekta (po vremenskoj zoni uređaja). */
export function localDateOf(date: Date): string {
  const year = String(date.getFullYear()).padStart(4, '0');
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}
