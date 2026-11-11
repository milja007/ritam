/**
 * Konflikti: zadnji `updatedAt` pobjeđuje (cijeli redak). Jednako vrijeme → lokalni ostaje,
 * da pull ne prepisuje redak koji je upravo poslan.
 */

function time(value: string): number {
  const ms = Date.parse(value);
  return Number.isNaN(ms) ? Number.NEGATIVE_INFINITY : ms;
}

export function isRemoteNewer(localUpdatedAt: string | null | undefined, remoteUpdatedAt: string): boolean {
  if (localUpdatedAt === null || localUpdatedAt === undefined) return true;
  return time(remoteUpdatedAt) > time(localUpdatedAt);
}

/** Najveća vrijednost kursora (ISO vremena poslužitelja); prazan popis → postojeći kursor. */
export function nextCursor(current: string | null, seen: readonly string[]): string | null {
  let best = current;
  for (const value of seen) {
    if (best === null || time(value) > time(best)) best = value;
  }
  return best;
}
