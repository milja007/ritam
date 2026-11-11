import { isAuthCallbackUrl } from '@/core/auth';

/**
 * Povratni link prijave (`ritam://auth/callback…`) nije ekran: sesiju postavlja `AuthLinkHandler`,
 * a router vodi na Profil, gdje odjeljak Račun pokazuje stanje prijave.
 */
export function redirectSystemPath({ path }: { path: string; initial: boolean }): string {
  try {
    return isAuthCallbackUrl(path) ? '/profile' : path;
  } catch {
    return path;
  }
}
