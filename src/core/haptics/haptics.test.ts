import { describe, expect, it } from '@jest/globals';

import { HAPTIC_COALESCE_MS, levelUpHaptics, nextHaptic, type HapticState } from './haptics';

describe('nextHaptic', () => {
  it('prvi povod uvijek svira', () => {
    expect(nextHaptic(null, 'done', 1000)).toEqual({ play: 'medium', state: { at: 1000, event: 'done' } });
    expect(nextHaptic(null, 'skip', 0).play).toBe('light');
    expect(nextHaptic(null, 'tick', 0).play).toBe('selection');
    expect(nextHaptic(null, 'levelUp', 0).play).toBe('success');
  });

  it('isti ili slabiji povod u istom trenutku se proguta', () => {
    const state: HapticState = { at: 1000, event: 'done' };
    expect(nextHaptic(state, 'done', 1000 + HAPTIC_COALESCE_MS - 1)).toEqual({ play: null, state });
    expect(nextHaptic(state, 'skip', 1050).play).toBeNull();
    expect(nextHaptic(state, 'tick', 1050).play).toBeNull();
  });

  it('jači povod u istom trenutku svira i postaje zadnji', () => {
    const after = nextHaptic({ at: 1000, event: 'done' }, 'streak', 1100);
    expect(after).toEqual({ play: 'success', state: { at: 1100, event: 'streak' } });
    // Niz i postignuće su iste jačine: drugi se proguta.
    expect(nextHaptic(after.state, 'achievement', 1150).play).toBeNull();
    expect(nextHaptic(after.state, 'levelUp', 1150).play).toBe('success');
  });

  it('nakon razmaka sve opet svira', () => {
    const state: HapticState = { at: 1000, event: 'levelUp' };
    expect(nextHaptic(state, 'tick', 1000 + HAPTIC_COALESCE_MS).play).toBe('selection');
  });

  it('sat unatrag ne blokira', () => {
    expect(nextHaptic({ at: 5000, event: 'levelUp' }, 'done', 1000).play).toBe('medium');
  });
});

describe('levelUpHaptics', () => {
  const timing = { fillMs: 700, stepMs: 220 };

  it('jedna razina: samo uspjeh kad se traka napuni', () => {
    expect(levelUpHaptics([4, 5], timing, false)).toEqual([{ at: 700, event: 'levelUp' }]);
  });

  it('više razina: tik po koraku, zadnji korak je prasak', () => {
    expect(levelUpHaptics([2, 3, 4, 5], timing, false)).toEqual([
      { at: 700, event: 'tick' },
      { at: 920, event: 'tick' },
      { at: 1140, event: 'levelUp' },
    ]);
  });

  it('bez koraka prasak ne ide prije nule', () => {
    expect(levelUpHaptics([5], { fillMs: 100, stepMs: 220 }, false)).toEqual([{ at: 0, event: 'levelUp' }]);
  });

  it('smanji kretanje: jedan uspjeh odmah', () => {
    expect(levelUpHaptics([2, 3, 4], timing, true)).toEqual([{ at: 0, event: 'levelUp' }]);
  });
});
