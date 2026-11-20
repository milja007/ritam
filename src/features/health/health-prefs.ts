import { useEffect, useState, useSyncExternalStore } from 'react';
import { Platform } from 'react-native';

import type { HealthNight } from '@/core/health';
import { readDevicePref, writeDevicePref } from '@/ui/device-prefs';

import { readHealthNight, readHealthTotal, requestHealthRead, type HealthMetric } from './health-source';

/**
 * Korak 39: je li čitanje iz Healtha uključeno — **samo na ovom uređaju** (dopuštenje Healtha je
 * po uređaju, pa se ne sinkronizira i ne traži migraciju). Isključeno dok ga korisnik ne uključi
 * na Profilu; uključivanje traži dopuštenje za čitanje.
 */

const KEY = 'ritam.health';

/** Health postoji samo na mobitelu; na webu se odjeljak ne prikazuje. */
export const HEALTH_SUPPORTED = Platform.OS === 'ios' || Platform.OS === 'android';

export type HealthToggleResult = 'on' | 'off' | 'unavailable';

let enabled: boolean | null = null;
/** Raste pri svakoj promjeni, da se otvoreni ekrani ponovo pročitaju. */
let version = 0;
const listeners = new Set<() => void>();

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

function publish() {
  version += 1;
  for (const listener of listeners) listener();
}

export function getHealthEnabled(): boolean {
  enabled ??= HEALTH_SUPPORTED && readDevicePref(KEY) === 'on';
  return enabled;
}

/**
 * Uključi ili isključi. Uključivanje prvo traži dopuštenje; kad Health na uređaju nije dostupan
 * (stari build, nema Health Connecta) ostaje isključeno i vraća `'unavailable'`.
 */
export async function setHealthEnabled(next: boolean): Promise<HealthToggleResult> {
  if (!next) {
    enabled = false;
    writeDevicePref(KEY, 'off');
    publish();
    return 'off';
  }
  const granted = await requestHealthRead();
  if (!granted) return 'unavailable';
  enabled = true;
  writeDevicePref(KEY, 'on');
  publish();
  return 'on';
}

export function useHealthEnabled(): boolean {
  return useSyncExternalStore(subscribe, getHealthEnabled, () => false);
}

function useHealthVersion(): number {
  return useSyncExternalStore(
    subscribe,
    () => version,
    () => version,
  );
}

/** Noć koja završava jutrom `date` iz Healtha; `null` dok je isključeno, čita ili podatka nema. */
export function useHealthNight(date: string): HealthNight | null {
  const on = useHealthEnabled();
  const changed = useHealthVersion();
  const [night, setNight] = useState<{ key: string; value: HealthNight | null } | null>(null);
  const key = `${date}:${changed}`;

  useEffect(() => {
    if (!on) return;
    let alive = true;
    void readHealthNight(date).then((value) => {
      if (alive) setNight({ key, value });
    });
    return () => {
      alive = false;
    };
  }, [on, date, key]);

  return on && night?.key === key ? night.value : null;
}

/** Koraci ili aktivne kcal za dan `date`; `null` dok je isključeno, čita ili podatka nema. */
export function useHealthTotal(metric: HealthMetric, date: string): number | null {
  const on = useHealthEnabled();
  const changed = useHealthVersion();
  const [total, setTotal] = useState<{ key: string; value: number | null } | null>(null);
  const key = `${metric}:${date}:${changed}`;

  useEffect(() => {
    if (!on) return;
    let alive = true;
    void readHealthTotal(metric, date).then((value) => {
      if (alive) setTotal({ key, value });
    });
    return () => {
      alive = false;
    };
  }, [on, metric, date, key]);

  return on && total?.key === key ? total.value : null;
}

/** Samo za testove. */
export function resetHealthPrefsForTests(): void {
  enabled = null;
  version = 0;
  listeners.clear();
}
