/**
 * Što od „prikazanog“ slavlja ostaje kad se promijeni level-up koji čeka (`key`, `null` = ništa ne
 * čeka ili se napredak učitava). Prikazano vrijedi samo dok isti level-up i dalje čeka: čim nestane
 * ili ga zamijeni drugi, briše se — pa ponovni prikaz mora opet proći fokus, blokadu i pauzu.
 * Čista logika, bez React importa.
 */
export function shownAfterPendingChange(shownKey: string | null, key: string | null): string | null {
  return shownKey !== null && shownKey === key ? shownKey : null;
}
