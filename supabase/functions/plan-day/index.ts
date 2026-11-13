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
  type Message,
} from '../_shared/llm-provider.ts';

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

  let body: PlanDayRequest;
  try {
    body = await req.json();
  } catch {
    return errorResponse('Neispravan JSON', 400);
  }

  if (!isValidPlanDayRequest(body)) {
    return errorResponse('Neispravan zahtjev: potrebni date i priorities', 400);
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
// Tipovi (podskup iz src/core/schedule/edge-types.ts — ponovljeni za Deno)
// ---------------------------------------------------------------------------

type DayPriority = {
  title: string;
  durationMinutes: number | null;
  fixedStart: string | null;
  important: boolean;
};

type PlanPreferences = {
  morningEnergy: 'high' | 'low';
  afternoonEnergy: 'high' | 'low';
  eveningEnergy: 'high' | 'low';
  focusBlockMinutes: number;
  breakMinutes: number;
};

type PlanDayRequest = {
  date: string;
  priorities: DayPriority[];
  freeWindows: Array<{ start: string; end: string }>;
  preferences: PlanPreferences | null;
};

type PlannedBlock = {
  title: string;
  start: string;
  end: string;
  kind: 'fixed' | 'suggestion';
};

type PlanDayResponse = {
  schedule: PlannedBlock[];
  questions: string[];
  summary: string;
};

// ---------------------------------------------------------------------------
// Validacija zahtjeva
// ---------------------------------------------------------------------------

function isValidPlanDayRequest(body: unknown): body is PlanDayRequest {
  if (typeof body !== 'object' || body === null) return false;
  const b = body as Record<string, unknown>;
  return (
    typeof b.date === 'string' &&
    /^\d{4}-\d{2}-\d{2}$/.test(b.date) &&
    Array.isArray(b.priorities) &&
    Array.isArray(b.freeWindows)
  );
}

// ---------------------------------------------------------------------------
// LLM plan
// ---------------------------------------------------------------------------

async function buildPlanWithLLM(
  req: PlanDayRequest,
  provider: { complete: (messages: Message[], options?: unknown) => Promise<{ content: string }> },
): Promise<PlanDayResponse> {
  const system = buildSystemPrompt(req);
  const userMessage = buildUserMessage(req);

  const result = await (provider as Parameters<typeof withLogging>[0]).complete(
    [{ role: 'user', content: userMessage }],
    { system, maxTokens: 1024, temperature: 0.3 },
  );

  return parseAndValidatePlanResponse(result.content, req);
}

function buildSystemPrompt(req: PlanDayRequest): string {
  const prefs = req.preferences;
  const focusBlock = prefs?.focusBlockMinutes ?? 90;
  const breakTime = prefs?.breakMinutes ?? 15;

  return `\
Ti si pametan osobni planer. Dobijevaš korisnikove prioritete i slobodne prozore za ${req.date}.

Složi raspored koji:
1. Smješta sve prioritete unutar slobodnih prozora
2. Respektira fiksne početke (fixedStart) bez premještanja
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

function parseAndValidatePlanResponse(raw: string, req: PlanDayRequest): PlanDayResponse {
  const jsonText = raw.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '').trim();
  let parsed: unknown;
  try {
    parsed = JSON.parse(jsonText);
  } catch {
    // Ako parsiranje ne uspije, vrati fallback.
    return buildFallbackPlan(req);
  }

  if (typeof parsed !== 'object' || parsed === null) return buildFallbackPlan(req);
  const obj = parsed as Record<string, unknown>;

  const schedule: PlannedBlock[] = Array.isArray(obj.schedule)
    ? obj.schedule.map(normalizePlannedBlock).filter(Boolean) as PlannedBlock[]
    : [];

  const questions: string[] = Array.isArray(obj.questions)
    ? obj.questions.filter((q): q is string => typeof q === 'string').slice(0, 3)
    : [];

  const summary: string = typeof obj.summary === 'string' ? obj.summary.trim() : '';

  return { schedule, questions, summary };
}

// ---------------------------------------------------------------------------
// Fallback plan (bez LLM-a)
// ---------------------------------------------------------------------------

/**
 * Jednostavan fallback koji smješta prioritete jedan za drugim u prvi slobodni
 * prozor. Koristi se kad LLM ne odgovori ili vrati nevaljan odgovor.
 */
function buildFallbackPlan(req: PlanDayRequest): PlanDayResponse {
  if (req.freeWindows.length === 0 || req.priorities.length === 0) {
    return {
      schedule: [],
      questions: req.freeWindows.length === 0
        ? ['Kada si slobodan/na sutra? Navedi slobodne prozore (npr. 9:00–13:00).']
        : ['Što imaš sutra? Navedi prioritete.'],
      summary: 'Trebam više informacija da složim plan.',
    };
  }

  const schedule: PlannedBlock[] = [];
  let windowIndex = 0;
  let currentMinutes = timeToMinutes(req.freeWindows[0].start);
  const unscheduled: string[] = [];

  for (const priority of req.priorities) {
    const duration = priority.durationMinutes ?? 60;

    // Ako ima fiksni početak, smjesti ga direktno.
    if (priority.fixedStart) {
      const fixedStart = priority.fixedStart;
      const fixedEnd = minutesToTime(timeToMinutes(fixedStart) + duration);
      schedule.push({ title: priority.title, start: fixedStart, end: fixedEnd, kind: 'suggestion' });
      continue;
    }

    // Pronađi slobodni prozor u koji stane.
    while (windowIndex < req.freeWindows.length) {
      const windowEnd = timeToMinutes(req.freeWindows[windowIndex].end);
      if (currentMinutes + duration <= windowEnd) {
        const start = minutesToTime(currentMinutes);
        const end = minutesToTime(currentMinutes + duration);
        schedule.push({ title: priority.title, start, end, kind: 'suggestion' });
        currentMinutes += duration + 15; // 15 min pauza
        break;
      }
      windowIndex++;
      if (windowIndex < req.freeWindows.length) {
        currentMinutes = timeToMinutes(req.freeWindows[windowIndex].start);
      }
    }

    if (windowIndex >= req.freeWindows.length) {
      unscheduled.push(priority.title);
    }
  }

  const questions: string[] = unscheduled.length > 0
    ? [`Nije stalo sve: ${unscheduled.join(', ')}. Imaš li više vremena?`]
    : [];

  return {
    schedule,
    questions,
    summary: schedule.length > 0
      ? `Plan ima ${schedule.length} blok${schedule.length === 1 ? '' : 'a'}. Provjeri i odobri.`
      : 'Nije moguće složiti plan s danim prozorima.',
  };
}

// ---------------------------------------------------------------------------
// Pomoćne funkcije
// ---------------------------------------------------------------------------

function timeToMinutes(hhmm: string): number {
  const [h = '0', m = '0'] = hhmm.split(':');
  return Number(h) * 60 + Number(m);
}

function minutesToTime(minutes: number): string {
  const h = Math.floor(minutes / 60) % 24;
  const m = minutes % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

function normalizePlannedBlock(raw: unknown): PlannedBlock | null {
  if (typeof raw !== 'object' || raw === null) return null;
  const obj = raw as Record<string, unknown>;
  const title = typeof obj.title === 'string' ? obj.title.trim() : '';
  if (!title) return null;
  const start = isHHMM(obj.start) ? (obj.start as string) : null;
  const end = isHHMM(obj.end) ? (obj.end as string) : null;
  if (!start || !end) return null;
  const kind = obj.kind === 'fixed' ? 'fixed' : 'suggestion';
  return { title, start, end, kind };
}

function isHHMM(value: unknown): boolean {
  return typeof value === 'string' && /^\d{2}:\d{2}$/.test(value);
}
