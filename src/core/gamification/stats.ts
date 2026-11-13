/**
 * Statovi (korak 34b, koncept: „iz stvarnog ponašanja“): Disciplina = plan, Volja = zabrane,
 * Energija = san; Zdravlje i Novac dolaze s trackerima (korak 31b) i do tada nemaju vrijednost.
 * Vrijednost 0–100 je prosjek tog dijela konačnog dnevnog rezultata zadnjih 30 dana.
 * Čista logika, bez React importa; ništa se ne sprema.
 */
import { isValidLocalDate } from '../domain/common';
import type { ScorePart } from '../progress/score';
import { addDays } from '../time/local-date';

export const STATS = ['discipline', 'will', 'energy', 'health', 'money'] as const;
export type Stat = (typeof STATS)[number];

/** Statovi koji se već mjere i dio rezultata iz kojeg dolaze. */
export const STAT_PARTS = { discipline: 'plan', will: 'rules', energy: 'sleep' } as const satisfies Partial<
  Record<Stat, ScorePart>
>;

/** Statovi koji čekaju svoj tracker (korak 31b). */
export const TRACKER_STATS = ['health', 'money'] as const satisfies readonly Stat[];

export const STAT_WINDOW_DAYS = 30;

export type StatDay = {
  date: string;
  final: boolean;
  /** Dijelovi rezultata 0–1; `null` = taj dan nije zabilježeno ili područje nije odabrano. */
  parts?: Readonly<Record<ScorePart, number | null>>;
};

export type StatValue = {
  stat: Stat;
  /** 0–100; `null` dok nema nijednog dana s tim dijelom (ili tracker ne postoji). */
  value: number | null;
  /** Koliko je dana ušlo u prosjek. */
  days: number;
  /** `tracker` = čeka tracker; `measured` = mjeri se iz rezultata. */
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
        if (value === null || !Number.isFinite(value)) continue;
        const sum = sums.get(part) ?? { total: 0, days: 0 };
        sum.total += Math.min(1, Math.max(0, value));
        sum.days += 1;
        sums.set(part, sum);
      }
    }
  }
  return STATS.map((stat): StatValue => {
    if (stat === 'health' || stat === 'money') return { stat, value: null, days: 0, source: 'tracker' };
    const sum = sums.get(STAT_PARTS[stat]);
    return sum === undefined
      ? { stat, value: null, days: 0, source: 'measured' }
      : { stat, value: Math.round((sum.total / sum.days) * 100), days: sum.days, source: 'measured' };
  });
}
