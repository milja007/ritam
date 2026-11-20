import { beforeEach, describe, expect, it, jest } from '@jest/globals';

import en from '@/i18n/en.json';
import hr from '@/i18n/hr.json';

import { getHealthEnabled, resetHealthPrefsForTests, setHealthEnabled } from './health-prefs';

const mockPrefs = new Map<string, string>();
jest.mock('@/ui/device-prefs', () => ({
  readDevicePref: (key: string) => mockPrefs.get(key) ?? null,
  writeDevicePref: (key: string, value: string) => {
    mockPrefs.set(key, value);
  },
}));

let mockGranted = true;
const mockRequest = jest.fn(() => Promise.resolve(mockGranted));
jest.mock('./health-source', () => ({
  requestHealthRead: () => mockRequest(),
  readHealthNight: () => Promise.resolve(null),
  readHealthTotal: () => Promise.resolve(null),
}));

beforeEach(() => {
  mockPrefs.clear();
  mockGranted = true;
  mockRequest.mockClear();
  resetHealthPrefsForTests();
});

describe('Health prekidač (korak 39)', () => {
  it('is off until the user turns it on', () => {
    expect(getHealthEnabled()).toBe(false);
  });

  it('asks for read permission when turned on and remembers it on the device', async () => {
    await expect(setHealthEnabled(true)).resolves.toBe('on');
    expect(mockRequest).toHaveBeenCalledTimes(1);
    expect(getHealthEnabled()).toBe(true);
    expect(mockPrefs.get('ritam.health')).toBe('on');
    resetHealthPrefsForTests();
    expect(getHealthEnabled()).toBe(true);
  });

  it('stays off when Health is not available on the device', async () => {
    mockGranted = false;
    await expect(setHealthEnabled(true)).resolves.toBe('unavailable');
    expect(getHealthEnabled()).toBe(false);
    expect(mockPrefs.has('ritam.health')).toBe(false);
  });

  it('turns off without asking anything', async () => {
    await setHealthEnabled(true);
    mockRequest.mockClear();
    await expect(setHealthEnabled(false)).resolves.toBe('off');
    expect(mockRequest).not.toHaveBeenCalled();
    expect(getHealthEnabled()).toBe(false);
    expect(mockPrefs.get('ritam.health')).toBe('off');
  });
});

describe('Health i18n', () => {
  it('HR i EN imaju iste ključeve, s mjestom za izvor gdje treba', () => {
    expect(Object.keys(hr.health).sort()).toEqual(Object.keys(en.health).sort());
    for (const dict of [hr.health, en.health]) {
      for (const value of Object.values(dict)) expect(value.length).toBeGreaterThan(0);
      for (const key of ['label', 'unavailable', 'permissionHint', 'sleepFilled'] as const) {
        expect(dict[key]).toContain('{{source}}');
      }
    }
  });
});
