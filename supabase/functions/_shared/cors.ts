/**
 * CORS zaglavlja za Supabase Edge Functions.
 * Sve funkcije vraćaju isti set zaglavlja — porijeklo se ne ograničava
 * jer pristup kontrolira JWT + RLS, ne HTTP porijeklo.
 */
export const CORS_HEADERS: Record<string, string> = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, x-client-info, apikey',
};

/** Odgovor na OPTIONS preflight zahtjev. */
export function corsPreflightResponse(): Response {
  return new Response(null, { status: 204, headers: CORS_HEADERS });
}

/** JSON odgovor s CORS zaglavljima. */
export function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
  });
}

/** Odgovor greške s CORS zaglavljima. */
export function errorResponse(message: string, status = 500): Response {
  return jsonResponse({ error: message }, status);
}
