/** Odluka o dopuštenju za obavijesti iz statusa sustava. Čista logika. */

export type PermissionSnapshot = {
  /** `granted` | `denied` | `undetermined` (kao u expo-modules-core). */
  status: string;
  granted: boolean;
  canAskAgain: boolean;
  /** iOS: privremeno (provisional) dopuštenje — obavijesti stižu tiho, ali stižu. */
  iosProvisional?: boolean;
};

/**
 * `allowed` → smijemo zakazivati; `ask` → pitaj (samo dok korisnik još nije odlučio);
 * `denied` → ne pitaj ponovo i ne zakazuj (korisnik to mijenja u postavkama sustava).
 */
export type PermissionDecision = 'allowed' | 'ask' | 'denied';

export function decidePermission(snapshot: PermissionSnapshot): PermissionDecision {
  if (snapshot.granted || snapshot.iosProvisional === true) return 'allowed';
  if (snapshot.status === 'undetermined' && snapshot.canAskAgain) return 'ask';
  return 'denied';
}
