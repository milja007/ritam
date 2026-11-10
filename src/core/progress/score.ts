/**
 * Dnevni rezultat 0–100 (korak 16b, koncept "Napredak u odnosu na prošlost"): udio odrađenog
 * plana, poštovane zabrane i san na vrijeme. Boduju se samo područja koja je korisnik odabrao
 * (korak 16c, odluka P39), s težinama plan 50 / zabrane 30 / san 20 razmjerno preraspodijeljenima
 * na odabrana područja. Odabrano područje koje se taj dan ne bilježi ne ulazi.
 * Trackeri (kalorije, novac) dolaze u koraku 31b. Čista logika: bez React importa.
 */
import { SCORE_AREAS, type ScoreArea } from '../domain/settings';
import { BEDTIME_TOLERANCE_MINUTES } from '../gamification/xp';

/** Odstupanje kreveta od cilja na kojem san više ne donosi bodove (2 h). */
export const SLEEP_ZERO_AT_MINUTES = 120;

export const SCORE_PARTS = SCORE_AREAS;
export type ScorePart = ScoreArea;

/** Osnovne težine područja (odluka P39): plan 50, zabrane 30, san 20. */
export const SCORE_WEIGHTS: Readonly<Record<ScorePart, number>> = { plan: 50, rules: 30, sleep: 20 };

/**
 * Težine odabranih područja razmjerno preraspodijeljene na 100 (plan+san = 71/29, plan+zabrane =
 * 62/38, zabrane+san = 60/40, jedno = 100). Neodabrana područja imaju 0; bez odabira sve 0.
 * Zaokruženo za prikaz tako da je zbroj točno 100.
 */
export function scoreWeights(areas: readonly ScorePart[]): Record<ScorePart, number> {
  const selected = SCORE_PARTS.filter((part) => areas.includes(part));
  const total = selected.reduce((sum, part) => sum + SCORE_WEIGHTS[part], 0);
  const weights: Record<ScorePart, number> = { plan: 0, rules: 0, sleep: 0 };
  if (total === 0) return weights;
  for (const part of selected) weights[part] = Math.round((SCORE_WEIGHTS[part] / total) * 100);
  // Ostatak zaokruživanja ide najtežem području, da zbroj bude 100.
  const drift = 100 - selected.reduce((sum, part) => sum + weights[part], 0);
  const heaviest = selected[0];
  if (heaviest !== undefined) weights[heaviest] += drift;
  return weights;
}

/** Ono što rezultat treba od statistike dana (`DayStats` iz dijagnoze to zadovoljava). */
export type ScoreInput = {
  plan: { total: number; done: number; partial: number };
  rules: { activeWeight: number; keptWeight: number };
  sleep: { deviationMinutes: number | null } | null;
};

export type DayScore = {
  /** 0–100, `null` kad taj dan nema nijednog dijela. */
  score: number | null;
  /** Dijelovi 0–1; `null` = nije zabilježeno, ne ulazi. */
  parts: Record<ScorePart, number | null>;
};

/** San: unutar ±30 min od cilja = 1, zatim linearno do 0 na 2 h odstupanja. */
export function sleepPart(deviationMinutes: number): number {
  if (deviationMinutes <= BEDTIME_TOLERANCE_MINUTES) return 1;
  if (deviationMinutes >= SLEEP_ZERO_AT_MINUTES) return 0;
  return (SLEEP_ZERO_AT_MINUTES - deviationMinutes) / (SLEEP_ZERO_AT_MINUTES - BEDTIME_TOLERANCE_MINUTES);
}

/**
 * Rezultat dana za odabrana područja (`areas`, zadano sva tri). Neodabrano područje ima `null`
 * dio i ne ulazi; od odabranih ulaze samo ona s podacima tog dana, s osnovnim težinama
 * razmjerno preraspodijeljenima.
 */
export function dayScore(input: ScoreInput, areas: readonly ScorePart[] = SCORE_PARTS): DayScore {
  const { plan, rules, sleep } = input;
  const parts: DayScore['parts'] = {
    plan: areas.includes('plan') && plan.total > 0 ? (plan.done + plan.partial / 2) / plan.total : null,
    rules: areas.includes('rules') && rules.activeWeight > 0 ? rules.keptWeight / rules.activeWeight : null,
    sleep:
      areas.includes('sleep') && sleep && sleep.deviationMinutes !== null ? sleepPart(sleep.deviationMinutes) : null,
  };
  let weightSum = 0;
  let weighted = 0;
  for (const part of SCORE_PARTS) {
    const value = parts[part];
    if (value === null) continue;
    weightSum += SCORE_WEIGHTS[part];
    weighted += SCORE_WEIGHTS[part] * value;
  }
  if (weightSum === 0) return { score: null, parts };
  const fraction = weighted / weightSum;
  return { score: Math.round(Math.min(1, Math.max(0, fraction)) * 100), parts };
}
