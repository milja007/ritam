/**
 * Glavni tabovi appa (koncept, 2026-11-10): Dan · Tjedan · Mjesec · Godina · Profil.
 * Navike, san i epski questovi žive u Profilu, ne kao zasebni tabovi.
 */
export type TabId = 'day' | 'week' | 'month' | 'year' | 'profile';

export type TabSpec = {
  readonly id: TabId;
  /** Ime datoteke rute u `src/app/` (`index` = početni ekran). */
  readonly route: 'index' | 'week' | 'month' | 'year' | 'profile';
  readonly labelKey: `tabs.${TabId}`;
};

export const TABS: readonly TabSpec[] = [
  { id: 'day', route: 'index', labelKey: 'tabs.day' },
  { id: 'week', route: 'week', labelKey: 'tabs.week' },
  { id: 'month', route: 'month', labelKey: 'tabs.month' },
  { id: 'year', route: 'year', labelKey: 'tabs.year' },
  { id: 'profile', route: 'profile', labelKey: 'tabs.profile' },
];
