import Storage from 'expo-sqlite/kv-store';

/**
 * Male postavke koje žive **samo na ovom uređaju** (tema boja, zadnja viđena razina): ključ →
 * tekst u `expo-sqlite/kv-store`. Ne ulaze u `settings` ni u sinkronizaciju, pa ne traže migraciju.
 * Čitanje i pisanje su sinkroni; greška spremišta nikad ne ruši ekran — vrijednost se tada samo
 * ne pamti do sljedećeg pokretanja.
 */
export function readDevicePref(key: string): string | null {
  try {
    return Storage.getItemSync(key);
  } catch (error) {
    console.warn('Reading device preference failed', key, error);
    return null;
  }
}

export function writeDevicePref(key: string, value: string): void {
  try {
    Storage.setItemSync(key, value);
  } catch (error) {
    console.warn('Saving device preference failed', key, error);
  }
}
