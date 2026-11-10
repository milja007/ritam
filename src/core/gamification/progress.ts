/**
 * Sažetak napretka za UI (XP traka + streak na Danas i Profilu). Čista logika, sve izvedeno
 * iz `xp_events` i `checkins` — ništa se ne sprema.
 */
import type { Checkin } from '../domain/checkin';
import type { XpEvent } from '../domain/xp-event';
import { levelProgress, type LevelProgress } from './level';
import { mainStreak, type Streak } from './streak';
import { totalXp, xpForDate } from './xp';

export type ProgressSummary = {
  totalXp: number;
  /** XP zarađen danas (kalendarski dan). */
  todayXp: number;
  level: LevelProgress;
  /** Glavni streak (dani zaredom s ispunjenim večernjim upitom). */
  streak: Streak;
};

/**
 * @param today kalendarski dan za "XP danas"
 * @param checkinDay dan večernjeg upita (prije 04:00 je to jučer) — prema njemu se računa streak,
 *   da upit ispunjen iza ponoći ne izgleda kao da današnji još nije ubrojen.
 */
export function progressSummary(
  events: readonly Pick<XpEvent, 'date' | 'amount'>[],
  checkins: readonly Pick<Checkin, 'date' | 'kind' | 'dayRating'>[],
  today: string,
  checkinDay: string = today,
): ProgressSummary {
  const total = totalXp(events);
  return {
    totalXp: total,
    todayXp: xpForDate(events, today),
    level: levelProgress(total),
    streak: mainStreak(checkins, checkinDay),
  };
}
