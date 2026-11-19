import { beforeEach, describe, expect, it, jest } from '@jest/globals';

import {
  createHealthConnectReader,
  createHealthKitReader,
  loadHealthReader,
  readHealthNight,
  readHealthTotal,
  requestHealthRead,
  resetHealthReaderForTests,
  type HealthConnectApi,
  type HealthKitApi,
  type HealthReader,
} from './health-source';

const at = (day: number, hour: number, minute = 0) => new Date(2026, 10, day, hour, minute);

function fakeHealthKit(overrides: Partial<Record<keyof HealthKitApi, unknown>> = {}) {
  const calls: { method: string; args: unknown[] }[] = [];
  const record =
    (method: string, result: unknown) =>
    (...args: unknown[]) => {
      calls.push({ method, args });
      return Promise.resolve(result);
    };
  const api = {
    isHealthDataAvailableAsync: record('available', true),
    requestAuthorization: record('auth', true),
    queryCategorySamples: record('sleep', [
      { startDate: at(18, 23), endDate: at(19, 6, 30), value: 3 },
      { startDate: at(18, 22, 30), endDate: at(19, 6, 45), value: 0 },
    ]),
    queryStatisticsForQuantity: record('stats', { sumQuantity: { unit: 'count', quantity: 8421.4 } }),
    ...overrides,
  } as unknown as HealthKitApi;
  return { api, calls };
}

describe('HealthKit reader', () => {
  it('asks only for read access to sleep, steps and active energy', async () => {
    const { api, calls } = fakeHealthKit();
    await expect(createHealthKitReader(api).requestRead()).resolves.toBe(true);
    expect(calls[1]).toEqual({
      method: 'auth',
      args: [
        {
          toRead: [
            'HKCategoryTypeIdentifierSleepAnalysis',
            'HKQuantityTypeIdentifierStepCount',
            'HKQuantityTypeIdentifierActiveEnergyBurned',
          ],
        },
      ],
    });
  });

  it('does not ask when Health is not on the device', async () => {
    const { api, calls } = fakeHealthKit({ isHealthDataAvailableAsync: () => Promise.resolve(false) });
    await expect(createHealthKitReader(api).requestRead()).resolves.toBe(false);
    expect(calls.some((c) => c.method === 'auth')).toBe(false);
  });

  it('reads the night through the query range and maps stages', async () => {
    const { api, calls } = fakeHealthKit();
    const night = await readHealthNight('2026-11-19', createHealthKitReader(api));
    expect(night).toEqual({ sleepStart: '23:00', wakeTime: '06:30', minutes: 450, basis: 'asleep' });
    expect(calls[0]?.args[1]).toEqual({
      limit: 0,
      filter: { date: { startDate: at(18, 12), endDate: at(19, 14) } },
    });
  });

  it('sums steps in count and active energy in kcal for the local day', async () => {
    const { api, calls } = fakeHealthKit();
    const reader = createHealthKitReader(api);
    await expect(readHealthTotal('steps', '2026-11-19', reader)).resolves.toBe(8421);
    await readHealthTotal('activeKcal', '2026-11-19', reader);
    expect(calls[0]?.args).toEqual([
      'HKQuantityTypeIdentifierStepCount',
      ['cumulativeSum'],
      { filter: { date: { startDate: at(19, 0), endDate: at(20, 0) } }, unit: 'count' },
    ]);
    expect(calls[1]?.args[0]).toBe('HKQuantityTypeIdentifierActiveEnergyBurned');
    expect((calls[1]?.args[2] as { unit: string }).unit).toBe('kcal');
  });

  it('returns null when there is no sum or the query fails', async () => {
    const empty = fakeHealthKit({ queryStatisticsForQuantity: () => Promise.resolve({}) });
    await expect(readHealthTotal('steps', '2026-11-19', createHealthKitReader(empty.api))).resolves.toBeNull();
    const broken = fakeHealthKit({ queryCategorySamples: () => Promise.reject(new Error('denied')) });
    await expect(readHealthNight('2026-11-19', createHealthKitReader(broken.api))).resolves.toBeNull();
  });
});

function fakeHealthConnect(overrides: Partial<Record<keyof HealthConnectApi, unknown>> = {}) {
  const calls: { method: string; args: unknown[] }[] = [];
  const pages = [
    {
      records: [{ startTime: at(18, 23, 15).toISOString(), endTime: at(19, 7).toISOString() }],
      pageToken: 'next',
    },
    { records: [] },
  ];
  const api = {
    getSdkStatus: () => Promise.resolve(3),
    initialize: jest.fn(() => Promise.resolve(true)),
    requestPermission: (...args: unknown[]) => {
      calls.push({ method: 'permission', args });
      return Promise.resolve([{ accessType: 'read', recordType: 'Steps' }]);
    },
    readRecords: (...args: unknown[]) => {
      calls.push({ method: 'read', args });
      return Promise.resolve(pages.shift() ?? { records: [] });
    },
    aggregateRecord: (...args: unknown[]) => {
      calls.push({ method: 'aggregate', args });
      const request = args[0] as { recordType: string };
      return Promise.resolve(
        request.recordType === 'Steps'
          ? { COUNT_TOTAL: 5120 }
          : { ACTIVE_CALORIES_TOTAL: { inKilocalories: 312.6, inCalories: 0, inJoules: 0, inKilojoules: 0 } },
      );
    },
    ...overrides,
  } as unknown as HealthConnectApi;
  return { api, calls };
}

describe('Health Connect reader', () => {
  it('asks only for read permissions', async () => {
    const { api, calls } = fakeHealthConnect();
    await expect(createHealthConnectReader(api).requestRead()).resolves.toBe(true);
    expect(calls[0]?.args[0]).toEqual([
      { accessType: 'read', recordType: 'SleepSession' },
      { accessType: 'read', recordType: 'Steps' },
      { accessType: 'read', recordType: 'ActiveCaloriesBurned' },
    ]);
  });

  it('follows pages of sleep sessions', async () => {
    const { api, calls } = fakeHealthConnect();
    const night = await readHealthNight('2026-11-19', createHealthConnectReader(api));
    expect(night).toEqual({ sleepStart: '23:15', wakeTime: '07:00', minutes: 465, basis: 'asleep' });
    expect(calls.filter((c) => c.method === 'read')).toHaveLength(2);
    expect((calls[1]?.args[1] as { pageToken?: string }).pageToken).toBe('next');
  });

  it('reads steps and active kcal from aggregates', async () => {
    const { api } = fakeHealthConnect();
    const reader = createHealthConnectReader(api);
    await expect(readHealthTotal('steps', '2026-11-19', reader)).resolves.toBe(5120);
    await expect(readHealthTotal('activeKcal', '2026-11-19', reader)).resolves.toBe(313);
  });

  it('is unavailable when the Health Connect app is missing, and initializes once', async () => {
    const missing = fakeHealthConnect({ getSdkStatus: () => Promise.resolve(1) });
    const reader = createHealthConnectReader(missing.api);
    await expect(reader.requestRead()).resolves.toBe(false);
    await expect(readHealthTotal('steps', '2026-11-19', reader)).resolves.toBeNull();
    expect(missing.calls).toHaveLength(0);

    const ok = fakeHealthConnect();
    const okReader = createHealthConnectReader(ok.api);
    await okReader.total('steps', { start: at(19, 0), end: at(20, 0) });
    await okReader.total('activeKcal', { start: at(19, 0), end: at(20, 0) });
    expect((ok.api as unknown as { initialize: jest.Mock }).initialize).toHaveBeenCalledTimes(1);
  });
});

describe('loading', () => {
  beforeEach(() => resetHealthReaderForTests());

  it('is unavailable without the native module (old development build) and does not throw', async () => {
    await expect(loadHealthReader()).resolves.toBeNull();
    await expect(requestHealthRead()).resolves.toBe(false);
    await expect(readHealthNight('2026-11-19')).resolves.toBeNull();
    await expect(readHealthTotal('steps', '2026-11-19')).resolves.toBeNull();
  });

  it('turns a failing permission request into false', async () => {
    const reader: HealthReader = {
      kind: 'healthkit',
      requestRead: () => Promise.reject(new Error('boom')),
      sleepSamples: () => Promise.resolve([]),
      total: () => Promise.resolve(null),
    };
    await expect(requestHealthRead(reader)).resolves.toBe(false);
  });

  it('rejects an invalid date without reading', async () => {
    const total = jest.fn(() => Promise.resolve(1));
    const reader: HealthReader = {
      kind: 'healthconnect',
      requestRead: () => Promise.resolve(true),
      sleepSamples: () => Promise.resolve([]),
      total,
    };
    await expect(readHealthTotal('steps', '2026-13-01', reader)).resolves.toBeNull();
    expect(total).not.toHaveBeenCalled();
  });
});
