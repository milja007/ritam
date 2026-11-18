import type { BlockStatus } from '../domain';

/**
 * Haptika (Ž11, dio koraka 35): koji osjet ide uz koji trenutak u appu. Čista logika — poziv
 * uređaja je u `src/ui/haptics.ts`.
 *
 * Načelo: haptika potvrđuje ono što je korisnik upravo napravio ili zaradio, nikad ne zove
 * pažnju sama od sebe. Slabije za svakodnevno (Gotovo, Preskoči), jače za rijetko (niz,
 * postignuće, nova razina). Kad se više povoda dogodi u istom trenutku (Gotovo → +XP → niz
 * naraste), osjeti se samo najjači.
 */

/** Povodi haptike u appu. */
export type HapticEvent =
  /** Aktivnost prijavljena kao odrađena. */
  | 'done'
  /** Aktivnost preskočena ili vraćena na „nije prijavljeno“. */
  | 'skip'
  /** Korak odbrojavanja razine u slavlju level-upa. */
  | 'tick'
  /** Niz je narastao. */
  | 'streak'
  /** Zarađeno: smrzavanje, ostvaren quest, cilj razdoblja. */
  | 'achievement'
  /** Prasak nove razine. */
  | 'levelUp';

/** Vrsta osjeta koju uređaj zna odsvirati (preslikava se na `expo-haptics`). */
export type HapticKind = 'selection' | 'light' | 'medium' | 'success';

export const HAPTIC_KIND: Readonly<Record<HapticEvent, HapticKind>> = {
  done: 'medium',
  skip: 'light',
  tick: 'selection',
  streak: 'success',
  achievement: 'success',
  levelUp: 'success',
};

/** Jačina povoda: kad se dva poklope, osjeti se jači. */
const STRENGTH: Readonly<Record<HapticEvent, number>> = {
  tick: 0,
  skip: 1,
  done: 2,
  streak: 3,
  achievement: 3,
  levelUp: 4,
};

/**
 * Povodi unutar ovog razmaka smatraju se istim trenutkom (Gotovo, +XP i bljesak niza stižu u
 * nekoliko renderiranja). Kraće od najkraćeg namjernog niza (odbrojavanje razine, 220 ms).
 */
export const HAPTIC_COALESCE_MS = 180;

/** Zadnji odsvirani osjet; `null` = još ništa. */
export type HapticState = { at: number; event: HapticEvent } | null;

/**
 * Treba li odsvirati `event` u trenutku `now` (ms) s obzirom na zadnji osjet. Unutar
 * `HAPTIC_COALESCE_MS` svira samo jači povod od zadnjeg (slabiji ili isti se proguta), pa
 * „Gotovo“ pa „niz“ zaredom daju dva osjeta samo ako je niz jači — i tada drugi prekrije prvi.
 * Sat koji ide unatrag (promjena vremena) ne blokira haptiku.
 */
export function nextHaptic(
  state: HapticState,
  event: HapticEvent,
  now: number,
): { play: HapticKind | null; state: HapticState } {
  if (state !== null) {
    const gap = now - state.at;
    if (gap >= 0 && gap < HAPTIC_COALESCE_MS && STRENGTH[event] <= STRENGTH[state.event]) {
      return { play: null, state };
    }
  }
  return { play: HAPTIC_KIND[event], state: { at: now, event } };
}

/** Jedan osjet u vremenskoj crti (ms od početka slavlja). */
export type HapticCue = { at: number; event: HapticEvent };

/**
 * Haptika slavlja nove razine, usklađena s animacijom (`LevelUpCelebration`): tik na svaki korak
 * odbrojavanja nakon što se traka napuni, pa uspjeh kad iskre polete. `steps` su razine koje se
 * odbroje (prva je početna, bez tika). Uz „smanji kretanje“ animacije nema, pa ostaje samo jedan
 * uspjeh odmah.
 */
export function levelUpHaptics(
  steps: readonly number[],
  timing: { fillMs: number; stepMs: number },
  reduceMotion: boolean,
): HapticCue[] {
  if (reduceMotion) return [{ at: 0, event: 'levelUp' }];
  const ticks = Math.max(0, steps.length - 1);
  const cues: HapticCue[] = [];
  // Zadnji korak odbrojavanja poklapa se s praskom (animacija prasak pokreće korak prije kraja),
  // pa on dobiva uspjeh umjesto tika.
  for (let i = 0; i < ticks - 1; i += 1) {
    cues.push({ at: timing.fillMs + i * timing.stepMs, event: 'tick' });
  }
  const burstAt = Math.max(0, timing.fillMs + (ticks - 1) * timing.stepMs);
  cues.push({ at: burstAt, event: 'levelUp' });
  return cues;
}

/**
 * Osjet uz promjenu statusa aktivnosti: „odrađeno“ je potvrda (srednji udar), sve ostalo —
 * djelomično, preskočeno, pomaknuto, vraćeno na planirano — lagani dodir.
 */
export function blockStatusHaptic(next: BlockStatus): HapticEvent {
  return next === 'done' ? 'done' : 'skip';
}
