import { Platform, TurboModuleRegistry } from 'react-native';
import type * as HealthKit from '@kingstinct/react-native-healthkit';
import type * as HealthConnect from 'react-native-health-connect';

import {
  dayQueryRange,
  healthAmount,
  healthNight,
  nightQueryRange,
  sleepSamplesFromHealthConnect,
  sleepSamplesFromHealthKit,
  type HealthNight,
  type HealthRange,
  type SleepSample,
} from '@/core/health';

/**
 * Korak 39: čitanje iz Apple Healtha (iOS, HealthKit) i Health Connecta (Android) — samo
 * čitanje sna, koraka i aktivnih kalorija (odluka Borne 94b).
 *
 * Paketi se učitavaju **opcionalno**: development build napravljen prije ovog koraka nema
 * native dio, a uvoz paketa bi tada srušio app. Zato se prvo provjeri postoji li native modul
 * (`TurboModuleRegistry.get`), a paket se uvozi tek tada (`import()`). Bez modula (stari build,
 * web, Health nije na uređaju) Health je jednostavno „nije dostupno“. Svaka greška pri čitanju
 * daje „nema podatka“ — ručni unos ostaje glavni put.
 */

export type HealthMetric = 'steps' | 'activeKcal';

export interface HealthReader {
  readonly kind: 'healthkit' | 'healthconnect';
  /** Traži dopuštenje za čitanje. `true` = upit je prošao (HealthKit ne otkriva je li odbijeno). */
  requestRead(): Promise<boolean>;
  sleepSamples(range: HealthRange): Promise<SleepSample[]>;
  total(metric: HealthMetric, range: HealthRange): Promise<number | null>;
}

export type HealthKitApi = Pick<
  typeof HealthKit,
  'isHealthDataAvailableAsync' | 'requestAuthorization' | 'queryCategorySamples' | 'queryStatisticsForQuantity'
>;

export type HealthConnectApi = Pick<
  typeof HealthConnect,
  'getSdkStatus' | 'initialize' | 'requestPermission' | 'readRecords' | 'aggregateRecord'
>;

const HK_SLEEP = 'HKCategoryTypeIdentifierSleepAnalysis';
const HK_STEPS = 'HKQuantityTypeIdentifierStepCount';
const HK_ACTIVE = 'HKQuantityTypeIdentifierActiveEnergyBurned';

export function createHealthKitReader(hk: HealthKitApi): HealthReader {
  return {
    kind: 'healthkit',
    async requestRead() {
      if (!(await hk.isHealthDataAvailableAsync())) return false;
      return hk.requestAuthorization({ toRead: [HK_SLEEP, HK_STEPS, HK_ACTIVE] });
    },
    async sleepSamples(range) {
      const records = await hk.queryCategorySamples(HK_SLEEP, {
        limit: 0,
        filter: { date: { startDate: range.start, endDate: range.end } },
      });
      return sleepSamplesFromHealthKit(records);
    },
    async total(metric, range) {
      const filter = { date: { startDate: range.start, endDate: range.end } };
      // Statistika HealthKita sama uklanja duplikate sata i mobitela.
      const response =
        metric === 'steps'
          ? await hk.queryStatisticsForQuantity(HK_STEPS, ['cumulativeSum'], { filter, unit: 'count' })
          : await hk.queryStatisticsForQuantity(HK_ACTIVE, ['cumulativeSum'], { filter, unit: 'kcal' });
      return healthAmount(response.sumQuantity?.quantity);
    },
  };
}

/** `SdkAvailabilityStatus.SDK_AVAILABLE` u Health Connectu. */
const HC_SDK_AVAILABLE = 3;
/** Najviše stranica sesija sna po upitu (jedna noć ih ima nekoliko). */
const HC_MAX_PAGES = 5;

export function createHealthConnectReader(hc: HealthConnectApi): HealthReader {
  let ready: Promise<boolean> | null = null;
  const init = (): Promise<boolean> => {
    ready ??= (async () => {
      if ((await hc.getSdkStatus()) !== HC_SDK_AVAILABLE) return false;
      return hc.initialize();
    })().catch(() => false);
    return ready;
  };
  const between = (range: HealthRange) => ({
    operator: 'between' as const,
    startTime: range.start.toISOString(),
    endTime: range.end.toISOString(),
  });

  return {
    kind: 'healthconnect',
    async requestRead() {
      if (!(await init())) return false;
      const granted = await hc.requestPermission([
        { accessType: 'read', recordType: 'SleepSession' },
        { accessType: 'read', recordType: 'Steps' },
        { accessType: 'read', recordType: 'ActiveCaloriesBurned' },
      ]);
      return granted.length > 0;
    },
    async sleepSamples(range) {
      if (!(await init())) return [];
      const sessions: HealthConnect.RecordResult<'SleepSession'>[] = [];
      let pageToken: string | undefined;
      for (let page = 0; page < HC_MAX_PAGES; page += 1) {
        const result = await hc.readRecords('SleepSession', { timeRangeFilter: between(range), pageToken });
        sessions.push(...result.records);
        pageToken = result.pageToken;
        if (!pageToken) break;
      }
      return sleepSamplesFromHealthConnect(sessions);
    },
    async total(metric, range) {
      if (!(await init())) return null;
      if (metric === 'steps') {
        const result = await hc.aggregateRecord({ recordType: 'Steps', timeRangeFilter: between(range) });
        return healthAmount(result.COUNT_TOTAL);
      }
      const result = await hc.aggregateRecord({ recordType: 'ActiveCaloriesBurned', timeRangeFilter: between(range) });
      return healthAmount(result.ACTIVE_CALORIES_TOTAL.inKilocalories);
    },
  };
}

let cached: Promise<HealthReader | null> | undefined;

async function loadReader(): Promise<HealthReader | null> {
  try {
    if (Platform.OS === 'ios') {
      if (!TurboModuleRegistry.get('NitroModules')) return null;
      const hk = await import('@kingstinct/react-native-healthkit');
      return createHealthKitReader(hk);
    }
    if (Platform.OS === 'android') {
      if (!TurboModuleRegistry.get('HealthConnect')) return null;
      const hc = await import('react-native-health-connect');
      return createHealthConnectReader(hc);
    }
  } catch {
    // Paket je tu, ali native dio nije (ili se ne može pokrenuti) — Health nije dostupan.
  }
  return null;
}

/** Čitač za ovaj uređaj ili `null` kad Health nije dostupan. Učitava se jednom. */
export function loadHealthReader(): Promise<HealthReader | null> {
  cached ??= loadReader();
  return cached;
}

/** Samo za testove: zaboravi učitani čitač. */
export function resetHealthReaderForTests(): void {
  cached = undefined;
}

/** Traži dopuštenje; `false` kad Health nije dostupan ili upit ne uspije. */
export async function requestHealthRead(reader?: HealthReader | null): Promise<boolean> {
  const source = reader === undefined ? await loadHealthReader() : reader;
  if (!source) return false;
  try {
    return await source.requestRead();
  } catch {
    return false;
  }
}

/** Noć koja završava jutrom `wakeDate` iz Healtha, ili `null`. */
export async function readHealthNight(wakeDate: string, reader?: HealthReader | null): Promise<HealthNight | null> {
  const range = nightQueryRange(wakeDate);
  const source = reader === undefined ? await loadHealthReader() : reader;
  if (!range || !source) return null;
  try {
    return healthNight(await source.sleepSamples(range), wakeDate);
  } catch {
    return null;
  }
}

/** Koraci ili aktivne kcal za lokalni dan `date`, ili `null`. */
export async function readHealthTotal(
  metric: HealthMetric,
  date: string,
  reader?: HealthReader | null,
): Promise<number | null> {
  const range = dayQueryRange(date);
  const source = reader === undefined ? await loadHealthReader() : reader;
  if (!range || !source) return null;
  try {
    return await source.total(metric, range);
  } catch {
    return null;
  }
}
