/**
 * Vrijeme u danu kao "HH:MM" (24h) ↔ minute od ponoći.
 * Čista logika: bez React importa, bez iznimki — neispravan unos vraća `null`.
 */

export const MINUTES_PER_DAY = 24 * 60;

const CLOCK_PATTERN = /^(\d{1,2}):(\d{2})$/;

/** "07:30" → 450. Prihvaća "7:30". Vraća `null` za neispravan unos (npr. "24:00", "7:5", "ab"). */
export function parseClock(value: string): number | null {
  const match = CLOCK_PATTERN.exec(value.trim());
  if (!match) return null;
  const hours = Number(match[1]);
  const minutes = Number(match[2]);
  if (hours > 23 || minutes > 59) return null;
  return hours * 60 + minutes;
}

/** 450 → "07:30". Vraća `null` ako nije cijeli broj u rasponu [0, 1440). */
export function formatClock(minutesSinceMidnight: number): string | null {
  if (
    !Number.isInteger(minutesSinceMidnight) ||
    minutesSinceMidnight < 0 ||
    minutesSinceMidnight >= MINUTES_PER_DAY
  ) {
    return null;
  }
  const hours = Math.floor(minutesSinceMidnight / 60);
  const minutes = minutesSinceMidnight % 60;
  return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
}
