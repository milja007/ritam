/**
 * write-report Edge Function (korak 31)
 *
 * Dnevna dijagnoza riječima: app šalje činjenice dana (statistika, komentari, zabrane, san, XP),
 * kratku povijest i ranije dijagnoze s odgovorom „Pomoglo / Nije pomoglo“; model piše Ukratko,
 * Pohvale, Što smo primijetili, Velike probleme i Ideje (prompt `llm-day-v1` u
 * `_shared/report-logic.ts`). Ništa ne piše u bazu — app sprema tekst uz lokalnu dijagnozu.
 *
 * Ulaz:  POST body: WriteReportRequest
 * Izlaz: { report: WriteReportText | null } — `null` kad model ne uspije ili vrati krivi oblik;
 *        app tada ostaje na lokalnoj dijagnozi.
 *
 * Zahtijeva JWT korisnika — `Authorization: Bearer <token>`.
 * API ključ dolazi iz Supabase secrets (`ANTHROPIC_API_KEY`), nikad iz repoa.
 */

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { corsPreflightResponse, errorResponse, jsonResponse } from '../_shared/cors.ts';
import { createClaudeProvider, withLogging } from '../_shared/llm-provider.ts';
import {
  acceptModelReport,
  buildReportSystemPrompt,
  buildReportUserMessage,
  parseWriteReportRequest,
  type WriteReportText,
} from '../_shared/report-logic.ts';

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return corsPreflightResponse();
  if (req.method !== 'POST') return errorResponse('Samo POST', 405);

  const authHeader = req.headers.get('Authorization');
  if (!authHeader) return errorResponse('Nedostaje Authorization zaglavlje', 401);

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')!;
  const userClient = createClient(supabaseUrl, supabaseAnonKey, {
    global: { headers: { Authorization: authHeader } },
  });

  const { data: { user }, error: authError } = await userClient.auth.getUser();
  if (authError || !user) return errorResponse('Nevaljan token', 401);

  let raw: unknown;
  try {
    raw = await req.json();
  } catch {
    return errorResponse('Neispravan JSON', 400);
  }

  const body = parseWriteReportRequest(raw);
  if (body === null) return errorResponse('Neispravan zahtjev: date, trend i today moraju biti valjani', 400);

  let report: WriteReportText | null = null;
  try {
    const provider = withLogging(createClaudeProvider('write-report'), user.id, 'write-report');
    const result = await provider.complete([{ role: 'user', content: buildReportUserMessage(body) }], {
      system: buildReportSystemPrompt(body.locale),
      maxTokens: 900,
      temperature: 0.4,
    });
    report = acceptModelReport(result.content);
    if (report === null) console.warn('write-report: odgovor modela nije u traženom obliku');
  } catch (err) {
    console.warn('LLM write-report nije uspio:', err);
  }

  return jsonResponse({ report });
});
