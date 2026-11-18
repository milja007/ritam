/**
 * Statovi (korak 34b, koncept: „iz stvarnog ponašanja“): Disciplina = plan, Volja = zabrane,
 * Energija = san, Zdravlje = kalorije, Novac = budžet (zadnja dva samo s uključenim trackerima,
 * korak 31b — bez dana s tim dijelom nemaju vrijednost).
 * Vrijednost 0–100 je prosjek tog dijela konačnog dnevnog rezultata zadnjih 30 dana.
 * Čista logika, bez React importa; ništa se ne sprema.
 */
import { isValidLocalDate } from '../domain/common';
import type { ScorePart } from '../progress/score';
import { addDays } from '../time/local-date';

export const STATS = ['discipline', 'will', 'energy', 'health', 'money'] as const;
export type Stat = (typeof STATS)[number];

/** Statovi koji se već mjere i dio rezultata iz kojeg dolaze. */
export const STAT_PARTS = {
  discipline: 'plan',
  will: 'rules',
  energy: 'sleep',
  health: 'calories',
  money: 'money',
} as const satisfies Record<Stat, ScorePart>;

/** Statovi koji se mjere samo s uključenim trackerom (korak 31b). */
export const TRACKER_STATS = ['health', 'money'] as const satisfies readonly Stat[];

export const STAT_WINDOW_DAYS = 30;

export type StatDay = {
  date: string;
  final: boolean;
  /** Dijelovi rezultata 0–1; `null` = taj dan nije zabilježeno ili područje nije odabrano. */
  parts?: Readonly<Partial<Record<ScorePart, number | null>>>;
};

export type StatValue = {
  stat: Stat;
  /** 0–100; `null` dok nema nijednog dana s tim dijelom (ili tracker ne postoji). */
  value: number | null;
  /** Koliko je dana ušlo u prosjek. */
  days: number;
  /** `tracker` = nema vrijednosti dok tracker nije uključen i nema dana s unosima; `measured` = iz rezultata. */
  source: 'measured' | 'tracker';
};

/**
 * Statovi za dan `today`: prosjek dijelova konačnih rezultata u zadnjih `STAT_WINDOW_DAYS` dana
 * (uključujući `today`). Rezultat „u tijeku“ ne ulazi (isto pravilo kao žar). Uvijek vraća svih
 * pet statova istim redom; neispravan `today` daje sve bez vrijednosti.
 */
export function statValues(days: readonly StatDay[], today: string): StatValue[] {
  const from = isValidLocalDate(today) ? addDays(today, -(STAT_WINDOW_DAYS - 1)) : null;
  const sums = new Map<ScorePart, { total: number; days: number }>();
  if (from !== null) {
    const seen = new Set<string>();
    for (const day of days) {
      if (!day.final || day.parts === undefined) continue;
      if (!isValidLocalDate(day.date) || day.date < from || day.date > today || seen.has(day.date)) continue;
      seen.add(day.date);
      for (const part of Object.values(STAT_PARTS)) {
        const value = day.parts[part];
        if (value === null || value === undefined || !Number.isFinite(value)) continue;
        const sum = sums.get(part) ?? { total: 0, days: 0 };
        sum.total += Math.min(1, Math.max(0, value));
        sum.days += 1;
        sums.set(part, sum);
      }
    }
  }
  return STATS.map((stat): StatValue => {
    const sum = sums.get(STAT_PARTS[stat]);
    const tracker = (TRACKER_STATS as readonly Stat[]).includes(stat);
    return sum === undefined
      ? { stat, value: null, days: 0, source: tracker ? 'tracker' : 'measured' }
      : { stat, value: Math.round((sum.total / sum.days) * 100), days: sum.days, source: 'measured' };
  });
}
