import { beforeEach, describe, expect, it, jest } from '@jest/globals';

import { getHapticsEnabled, playHaptic, resetHapticsForTests, setHapticsEnabled } from './haptics';

const mockPrefs = new Map<string, string>();
jest.mock('./device-prefs', () => ({
  readDevicePref: (key: string) => mockPrefs.get(key) ?? null,
  writeDevicePref: (key: string, value: string) => {
    mockPrefs.set(key, value);
  },
}));

const mockCalls: string[] = [];
jest.mock('expo-haptics', () => ({
  ImpactFeedbackStyle: { Light: 'light', Medium: 'medium' },
  NotificationFeedbackType: { Success: 'success' },
  selectionAsync: () => {
    mockCalls.push('selection');
    return Promise.resolve();
  },
  impactAsync: (style: string) => {
    mockCalls.push(`impact:${style}`);
    return style === 'light' ? Promise.reject(new Error('no engine')) : Promise.resolve();
  },
  notificationAsync: (type: string) => {
    mockCalls.push(`notification:${type}`);
    return Promise.resolve();
  },
}));

describe('haptika na uređaju', () => {
  let now = 10_000;
  beforeEach(() => {
    mockPrefs.clear();
    mockCalls.length = 0;
    resetHapticsForTests();
    now += 10_000;
    jest.spyOn(Date, 'now').mockImplementation(() => now);
  });

  it('uključena po defaultu i svira pravu vrstu', () => {
    expect(getHapticsEnabled()).toBe(true);
    playHaptic('done');
    now += 1000;
    playHaptic('tick');
    now += 1000;
    playHaptic('levelUp');
    expect(mockCalls).toEqual(['impact:medium', 'selection', 'notification:success']);
  });

  it('povodi u istom trenutku daju jedan osjet (jači)', () => {
    playHaptic('done');
    now += 50;
    playHaptic('done');
    now += 50;
    playHaptic('streak');
    expect(mockCalls).toEqual(['impact:medium', 'notification:success']);
  });

  it('isključena ne svira i pamti se', () => {
    setHapticsEnabled(false);
    playHaptic('done');
    expect(mockCalls).toEqual([]);
    expect(mockPrefs.get('ritam.haptics')).toBe('off');
    resetHapticsForTests();
    expect(getHapticsEnabled()).toBe(false);
  });

  it('uključivanje odmah odsvira probni osjet', () => {
    mockPrefs.set('ritam.haptics', 'off');
    setHapticsEnabled(true);
    expect(mockCalls).toEqual(['impact:medium']);
    expect(mockPrefs.get('ritam.haptics')).toBe('on');
  });

  it('greška uređaja ne ruši poziv', async () => {
    const warn = jest.spyOn(console, 'warn').mockImplementation(() => undefined);
    expect(() => playHaptic('skip')).not.toThrow();
    await Promise.resolve();
    await Promise.resolve();
    expect(warn).toHaveBeenCalled();
    warn.mockRestore();
  });
});
