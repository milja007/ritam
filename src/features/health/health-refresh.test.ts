import { beforeEach, describe, expect, it, jest } from '@jest/globals';

import {
  getHealthRefresh,
  onHealthAppState,
  resetHealthPrefsForTests,
  subscribeHealthRefresh,
} from './health-prefs';

const mockRemove = jest.fn();
const mockAdd = jest.fn((_event: string, _handler: (state: string) => void) => ({ remove: mockRemove }));
jest.mock('react-native', () => ({
  Platform: { OS: 'ios' },
  AppState: { addEventListener: (event: string, handler: (state: string) => void) => mockAdd(event, handler) },
}));
jest.mock('@/ui/device-prefs', () => ({ readDevicePref: () => null, writeDevicePref: () => undefined }));
jest.mock('./health-source', () => ({
  requestHealthRead: () => Promise.resolve(true),
  readHealthNight: () => Promise.resolve(null),
  readHealthTotal: () => Promise.resolve(null),
}));

beforeEach(() => {
  resetHealthPrefsForTests();
  mockAdd.mockClear();
  mockRemove.mockClear();
});

describe('Health osvježavanje pri povratku u app (Codex P2, #73)', () => {
  it('re-reads when the app comes back to the foreground, not when it leaves', () => {
    const listener = jest.fn();
    const stop = subscribeHealthRefresh(listener);
    expect(mockAdd).toHaveBeenCalledTimes(1);
    const handler = mockAdd.mock.calls[0]?.[1];
    handler?.('background');
    expect(listener).not.toHaveBeenCalled();
    expect(getHealthRefresh()).toBe(0);
    handler?.('active');
    expect(listener).toHaveBeenCalledTimes(1);
    expect(getHealthRefresh()).toBe(1);
    stop();
  });

  it('shares one AppState listener and removes it with the last screen', () => {
    const stopA = subscribeHealthRefresh(() => undefined);
    const stopB = subscribeHealthRefresh(() => undefined);
    expect(mockAdd).toHaveBeenCalledTimes(1);
    stopA();
    expect(mockRemove).not.toHaveBeenCalled();
    stopB();
    expect(mockRemove).toHaveBeenCalledTimes(1);
    onHealthAppState('active');
    expect(getHealthRefresh()).toBe(1);
  });
});
