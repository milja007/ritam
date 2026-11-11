/**
 * Povratni link magic linka (`ritam://auth/callback…`).
 *
 * Supabase vraća sesiju na jedan od tri načina:
 * - implicit: `#access_token=…&refresh_token=…`
 * - PKCE: `?code=…`
 * - greška: `?error=…&error_description=…` (ili u fragmentu)
 */

export const AUTH_CALLBACK_PATH = 'auth/callback';

export type AuthCallback =
  | { kind: 'tokens'; accessToken: string; refreshToken: string }
  | { kind: 'code'; code: string }
  | { kind: 'error'; message: string }
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

/** Je li URL povratni link prijave (bilo koja shema / host, putanja završava na `auth/callback`). */
export function isAuthCallbackUrl(url: string | null | undefined): boolean {
  if (!url) return false;
  const { path } = splitUrl(url);
  return path.replace(/\/+$/, '').endsWith(AUTH_CALLBACK_PATH);
}

export function parseAuthCallback(url: string | null | undefined): AuthCallback {
  if (!url || !isAuthCallbackUrl(url)) return { kind: 'none' };
  const { query, fragment } = splitUrl(url);
  const params = parseParams(query);
  for (const [key, value] of parseParams(fragment)) params.set(key, value);

  const error = params.get('error_description') || params.get('error');
  if (error) return { kind: 'error', message: error };

  const accessToken = params.get('access_token');
  const refreshToken = params.get('refresh_token');
  if (accessToken && refreshToken) return { kind: 'tokens', accessToken, refreshToken };

  const code = params.get('code');
  if (code) return { kind: 'code', code };

  return { kind: 'none' };
}
