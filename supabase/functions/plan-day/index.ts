/**
 * plan-day Edge Function (Korak 22)
 *
 * Slaže raspored sutrašnjeg dana na temelju korisnikovih prioriteta,
 * slobodnih prozora i preferencija. Vraća prijedlog koji korisnik mora
 * odobriti — ništa ne piše u bazu, samo vraća odgovor.
 *
 * Ulaz:  POST body: PlanDayRequest (src/core/schedule/edge-types.ts)
 * Izlaz: PlanDayResponse (src/core/schedule/edge-types.ts)
 *
 * Zahtijeva JWT korisnika — `Authorization: Bearer <token>`.
 * API ključ dolazi iz Supabase secrets (`ANTHROPIC_API_KEY`), nikad iz repoa.
 *
 * Fallback: ako LLM poziv ne uspije, raspored se slaže lokalnim pravilima
 * (najduži prioriteti ujutro, kratki popodne, sve unutar slobodnih prozora).
 */

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import {
  corsPreflightResponse,
  errorResponse,
  jsonResponse,
} from '../_shared/cors.ts';
import {
  createClaudeProvider,
  withLogging,
  type LLMProvider,
} from '../_shared/llm-provider.ts';
import {
  acceptModelPlan,
  buildFallbackPlan,
  parsePlanDayRequest,
  type PlanDayRequest,
  type PlanDayResponse,
} from '../_shared/plan-logic.ts';

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

  const body = parsePlanDayRequest(raw);
  if (body === null) {
    return errorResponse('Neispravan zahtjev: date, priorities i freeWindows moraju biti valjani', 400);
  }

  // Pokušaj LLM plan; ako ne uspije, koristi fallback.
  let response: PlanDayResponse;
  try {
    const provider = withLogging(createClaudeProvider(), user.id, 'plan-day');
    response = await buildPlanWithLLM(body, provider);
  } catch (err) {
    console.warn('LLM plan-day nije uspio, koristim fallback:', err);
    response = buildFallbackPlan(body);
  }

  return jsonResponse(response);
});

// ---------------------------------------------------------------------------
// LLM plan
// ---------------------------------------------------------------------------

async function buildPlanWithLLM(req: PlanDayRequest, provider: LLMProvider): Promise<PlanDayResponse> {
  const system = buildSystemPrompt(req);
  const userMessage = buildUserMessage(req);

  const result = await provider.complete(
    [{ role: 'user', content: userMessage }],
    { system, maxTokens: 1024, temperature: 0.3 },
  );

  // Raspored koji krši ograničenja (izvan prozora, preklapanje, pomaknut fiksni) → lokalni.
  return acceptModelPlan(result.content, req) ?? buildFallbackPlan(req);
}

function buildSystemPrompt(req: PlanDayRequest): string {
  const prefs = req.preferences;
  const focusBlock = prefs?.focusBlockMinutes ?? 90;
  const breakTime = prefs?.breakMinutes ?? 15;

  return `\
Ti si pametan osobni planer. Dobijevaš korisnikove prioritete i slobodne prozore za ${req.date}.

Složi raspored koji:
1. Smješta sve prioritete unutar slobodnih prozora
2. Respektira fiksne početke (fixedStart) bez premještanja — fiksni blok ima "kind":"fixed" i točno taj naslov i početak
5. Svaki blok koji nije fiksni mora biti unutar jednog slobodnog prozora; blokovi se ne preklapaju
3. Koristi fokus-blokove od ${focusBlock} min s pauzama od ${breakTime} min između
4. Postavlja zahtjevne zadatke u jutarnje/doručernje prozore (bolja koncentracija)

Vrati SAMO JSON objekt (bez markdowna):
{
  "schedule": [{"title":"...","start":"HH:MM","end":"HH:MM","kind":"suggestion"}],
  "questions": ["Pitanje za korisnika ako nešto nije jasno (maks 3)"],
  "summary": "Kratki sažetak plana na jeziku korisnikovih prioriteta (1-2 rečenice)"
}

Ako ne možeš smjestiti sve prioritete, napiši pitanje. Ako su slobodni prozori prazni, traži ih pitanjem.
`.trim();
}

function buildUserMessage(req: PlanDayRequest): string {
  const lines: string[] = [];
  lines.push(`Datum: ${req.date}`);

  if (req.freeWindows.length > 0) {
    lines.push('Slobodni prozori: ' + req.freeWindows.map((w) => `${w.start}–${w.end}`).join(', '));
  } else {
    lines.push('Slobodni prozori: nisu navedeni');
  }

  if (req.priorities.length > 0) {
    lines.push('Prioriteti:');
    for (const p of req.priorities) {
      let desc = `- ${p.title}`;
      if (p.durationMinutes) desc += ` (${p.durationMinutes} min)`;
      if (p.fixedStart) desc += ` [fiksno u ${p.fixedStart}]`;
      if (p.important) desc += ' ⭐';
      lines.push(desc);
    }
  } else {
    lines.push('Prioriteti: nisu navedeni');
  }

  return lines.join('\n');
}
