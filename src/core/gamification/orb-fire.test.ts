import { describe, expect, it } from '@jest/globals';

import { colorUniform, ORB_FIRE_MOTION, orbFireMotion } from './orb-fire';

describe('orbFireMotion', () => {
  it('ugašen nema plamena', () => {
    expect(orbFireMotion('unlit')).toBeNull();
  });

  it('topliji plamen je viši, brži i ima više žeravica', () => {
    const order = (['faint', 'low', 'warm', 'bright'] as const).map((heat) => orbFireMotion(heat));
    for (let i = 1; i < order.length; i += 1) {
      const before = order[i - 1];
      const now = order[i];
      expect(before).not.toBeNull();
      expect(now).not.toBeNull();
      if (before === null || now === null) return;
      expect(now.height).toBeGreaterThan(before.height);
      expect(now.speed).toBeGreaterThan(before.speed);
      expect(now.embers).toBeGreaterThan(before.embers);
    }
  });

  it('tinjajući plamen i dalje gori (nikad se ne gasi)', () => {
    expect(ORB_FIRE_MOTION.faint.height).toBeGreaterThan(0);
    expect(ORB_FIRE_MOTION.faint.speed).toBeGreaterThan(0);
  });

  it('sve vrijednosti su u 0–1', () => {
    for (const motion of Object.values(ORB_FIRE_MOTION)) {
      for (const value of [motion.height, motion.speed, motion.embers]) {
        expect(value).toBeGreaterThanOrEqual(0);
        expect(value).toBeLessThanOrEqual(1);
      }
    }
  });
});

describe('colorUniform', () => {
  it('pretvara hex u 0–1', () => {
    expect(colorUniform('#FF9F43')).toEqual([1, 159 / 255, 67 / 255, 1]);
    expect(colorUniform('#00000080')).toEqual([0, 0, 0, 128 / 255]);
    expect(colorUniform(' #ffffff ')).toEqual([1, 1, 1, 1]);
  });

  it('neispravno ili prozirno je prozirna crna', () => {
    expect(colorUniform('transparent')).toEqual([0, 0, 0, 0]);
    expect(colorUniform('#FFF')).toEqual([0, 0, 0, 0]);
    expect(colorUniform('rgb(1,2,3)')).toEqual([0, 0, 0, 0]);
  });
});
