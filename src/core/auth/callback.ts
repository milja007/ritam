/**
 * Povratni link magic linka (`ritam://auth/callback…`).
 *
 * Klijent koristi PKCE, pa se prihvaća samo:
 * - PKCE: `?code=…` (zamjena koda radi samo s verifierom spremljenim na ovom uređaju)
 * - greška: `?error=…&error_description=…` (ili u fragmentu)
 *
 * Link s gotovim tokenima (`#access_token=…&refresh_token=…`) se **odbija**: takav link može
 * napraviti bilo tko, a postavljanje te sesije bi lokalne podatke poslalo na tuđi račun.
 * Prihvaća se samo točno očekivani povratni link (shema, host i putanja), ne bilo koja putanja
 * koja završava na `auth/callback`.
 */

export const AUTH_CALLBACK_PATH = 'auth/callback';

export type AuthCallback =
  | { kind: 'code'; code: string }
  | { kind: 'error'; message: string }
  | { kind: 'rejected'; reason: 'tokens' | 'no-code' }
  | { kind: 'none' };

function parseParams(part: string): Map<string, string> {
  const params = new Map<string, string>();
  for (const pair of part.split('&')) {
    if (pair === '') continue;
    const eq = pair.indexOf('=');
    const rawKey = eq === -1 ? pair : pair.slice(0, eq);
    const rawValue = eq === -1 ? '' : pair.slice(eq + 1);
    try {
      params.set(
        decodeURIComponent(rawKey.replace(/\+/g, ' ')),
        decodeURIComponent(rawValue.replace(/\+/g, ' ')),
      );
    } catch {
      // Neispravno kodiranje — preskoči taj par.
    }
  }
  return params;
}

function splitUrl(url: string): { path: string; query: string; fragment: string } {
  const hashAt = url.indexOf('#');
  const beforeHash = hashAt === -1 ? url : url.slice(0, hashAt);
  const fragment = hashAt === -1 ? '' : url.slice(hashAt + 1);
  const queryAt = beforeHash.indexOf('?');
  return {
    path: queryAt === -1 ? beforeHash : beforeHash.slice(0, queryAt),
    query: queryAt === -1 ? '' : beforeHash.slice(queryAt + 1),
    fragment,
  };
}

/** Normalizacija za usporedbu: shema malim slovima, `scheme:///x` = `scheme://x`, bez završnih `/`. */
function normalizeTarget(path: string): string {
  const schemeEnd = path.indexOf('://');
  let out = path;
  if (schemeEnd !== -1) {
    const scheme = path.slice(0, schemeEnd).toLowerCase();
    const rest = path.slice(schemeEnd + 3).replace(/^\/+/, '');
    out = `${scheme}://${rest}`;
  }
  return out.replace(/\/+$/, '');
}

/**
 * Izgleda li URL kao povratni link prijave (bilo koja shema / host, putanja završava na
 * `auth/callback`). Samo za usmjeravanje (router ga ne prikazuje kao ekran) — **ne** za prijavu;
 * prijava traži `parseAuthCallback` s točnim očekivanim linkom.
 */
export function isAuthCallbackUrl(url: string | null | undefined): boolean {
  if (!url) return false;
  const { path } = splitUrl(url);
  return path.replace(/\/+$/, '').endsWith(AUTH_CALLBACK_PATH);
}

/** Je li URL točno očekivani povratni link (npr. `ritam://auth/callback`), bez obzira na query/fragment. */
export function matchesCallbackTarget(url: string | null | undefined, expected: string): boolean {
  if (!url) return false;
  return normalizeTarget(splitUrl(url).path) === normalizeTarget(splitUrl(expected).path);
}

/**
 * Parsira povratni link prijave. `expected` je povratni link koji je app poslala Supabaseu
 * (`authRedirectUrl()`); drugi linkovi daju `none`.
 */
export function parseAuthCallback(url: string | null | undefined, expected: string): AuthCallback {
  if (!url || !matchesCallbackTarget(url, expected)) return { kind: 'none' };
  const { query, fragment } = splitUrl(url);
  const queryParams = parseParams(query);
  const fragmentParams = parseParams(fragment);
  const any = (key: string) => queryParams.get(key) || fragmentParams.get(key);

  const error = any('error_description') || any('error');
  if (error) return { kind: 'error', message: error };

  if (any('access_token') || any('refresh_token')) return { kind: 'rejected', reason: 'tokens' };

  // PKCE kod dolazi u queryju.
  const code = queryParams.get('code');
  if (code) return { kind: 'code', code };

  return { kind: 'rejected', reason: 'no-code' };
}
