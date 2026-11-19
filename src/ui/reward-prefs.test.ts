import { beforeEach, describe, expect, it, jest } from '@jest/globals';

import { getAvatarFrame, getDoneEffect, resetRewardPrefsForTests, setAvatarFrame, setDoneEffect } from './reward-prefs';

const mockPrefs = new Map<string, string>();
jest.mock('./device-prefs', () => ({
  readDevicePref: (key: string) => mockPrefs.get(key) ?? null,
  writeDevicePref: (key: string, value: string) => {
    mockPrefs.set(key, value);
  },
}));

describe('okvir i animacija na uređaju', () => {
  beforeEach(() => {
    mockPrefs.clear();
    resetRewardPrefsForTests();
  });

  it('bez zapisa su početni', () => {
    expect(getAvatarFrame()).toBe('plain');
    expect(getDoneEffect()).toBe('flare');
  });

  it('odabir se pamti i čita nakon ponovnog pokretanja', () => {
    setAvatarFrame('halo');
    setDoneEffect('wave');
    resetRewardPrefsForTests();
    expect(getAvatarFrame()).toBe('halo');
    expect(getDoneEffect()).toBe('wave');
    expect(mockPrefs.get('ritam.avatarFrame')).toBe('halo');
  });

  it('pokvaren zapis je početni', () => {
    mockPrefs.set('ritam.avatarFrame', '???');
    expect(getAvatarFrame()).toBe('plain');
  });
});
