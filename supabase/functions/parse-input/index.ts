/**
 * parse-input Edge Function (Korak 21)
 *
 * Pretvara slobodan tekst u niz blokova rasporeda.
 * Ulaz:  POST body { text: string, locale: 'hr' | 'en' }
 * Izlaz: { blocks: ParsedBlock[] }
 *
 * Zahtijeva JWT korisnika — `Authorization: Bearer <token>`.
 * API ključ dolazi iz Supabase secrets (`ANTHROPIC_API_KEY`), nikad iz repoa.
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

// Supabase Edge Functions rute zahtjeva do Deno.serve() od Deno 2.
Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return corsPreflightResponse();
  if (req.method !== 'POST') return errorResponse('Samo POST', 405);

  // Provjera JWT-a — Supabase middleware već validira token i postavlja
  // Authorization zaglavlje; createClient s anon ključem ga poštuje.
  const authHeader = req.headers.get('Authorization');
  if (!authHeader) return errorResponse('Nedostaje Authorization zaglavlje', 401);

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')!;
  const userClient = createClient(supabaseUrl, supabaseAnonKey, {
    global: { headers: { Authorization: authHeader } },
  });

  const { data: { user }, error: authError } = await userClient.auth.getUser();
  if (authError || !user) return errorResponse('Nevaljan token', 401);

  // Tijelo zahtjeva
  let body: { text?: unknown; locale?: unknown };
  try {
    body = await req.json();
  } catch {
    return errorResponse('Neispravan JSON', 400);
  }

  const text = typeof body.text === 'string' ? body.text.trim() : '';
  const locale = body.locale === 'hr' || body.locale === 'en' ? body.locale : 'hr';
  if (text.length === 0) return errorResponse('Tekst je prazan', 400);
  if (text.length > 2000) return errorResponse('Tekst je predugačak (max 2000 znakova)', 400);

  // LLM poziv
  const provider = withLogging(createClaudeProvider(), user.id, 'parse-input');
  const systemPrompt = locale === 'hr'
    ? SYSTEM_PROMPT_HR
    : SYSTEM_PROMPT_EN;

  const messages: Message[] = [
    { role: 'user', content: `Tekst: ${text}` },
  ];

  let raw: string;
  try {
    const result = await provider.complete(messages, {
      system: systemPrompt,
      maxTokens: 512,
      temperature: 0.1, // deterministično za parsiranje
    });
    raw = result.content;
  } catch (err) {
    console.error('LLM greška u parse-input:', err);
    return errorResponse('LLM poziv nije uspio', 502);
  }

  // Pokušaj parsirati JSON koji je LLM vratio.
  let blocks: unknown;
  try {
    // LLM-u dajemo uputu da vraća samo JSON, ali ga može omotati u ```json...```
    const jsonText = raw.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '').trim();
    blocks = JSON.parse(jsonText);
  } catch {
    console.error('LLM nije vratio valjan JSON:', raw);
    // Fallback: prazan popis — bolje nego greška.
    blocks = [];
  }

  if (!Array.isArray(blocks)) blocks = [];

  // Normalizacija izlaza: strogi tipovi.
  const normalizedBlocks = (blocks as unknown[]).map(normalizeBlock).filter(Boolean);

  return jsonResponse({ blocks: normalizedBlocks });
});

// ---------------------------------------------------------------------------
// Sistemski promptovi
// ---------------------------------------------------------------------------

const SYSTEM_PROMPT_HR = `\
Ti si precizni ekstraktor rasporeda. Dobijevaš neformalan tekst na hrvatskom ili engleskom.
Izvuci sve aktivnosti i za svaku vrati JSON objekt s poljima:
  - title: string (naziv aktivnosti, kratak i jasan)
  - start: string | null ("HH:MM" u 24-satnom formatu, null ako nije navedeno)
  - end: string | null ("HH:MM" u 24-satnom formatu, null ako nije navedeno)
  - durationMinutes: number | null (trajanje u minutama, null ako nije navedeno)
  - timeOfDay: "morning" | "afternoon" | "evening" | "night" | null

Vrati SAMO JSON niz (bez objašnjenja, bez markdowna):
[{"title":"...","start":null,"end":null,"durationMinutes":null,"timeOfDay":null}]

Primjer ulaza: "15:00 sastanak s timom, traje sat, navečer teretana 45 min"
Primjer izlaza: [{"title":"Sastanak s timom","start":"15:00","end":"16:00","durationMinutes":60,"timeOfDay":"afternoon"},{"title":"Teretana","start":null,"end":null,"durationMinutes":45,"timeOfDay":"evening"}]
`.trim();

const SYSTEM_PROMPT_EN = `\
You are a precise schedule extractor. You receive informal text in Croatian or English.
Extract all activities and for each return a JSON object with fields:
  - title: string (activity name, short and clear)
  - start: string | null ("HH:MM" in 24-hour format, null if not given)
  - end: string | null ("HH:MM" in 24-hour format, null if not given)
  - durationMinutes: number | null (duration in minutes, null if not given)
  - timeOfDay: "morning" | "afternoon" | "evening" | "night" | null

Return ONLY a JSON array (no explanation, no markdown):
[{"title":"...","start":null,"end":null,"durationMinutes":null,"timeOfDay":null}]
`.trim();

// ---------------------------------------------------------------------------
// Normalizacija pojedinog bloka
// ---------------------------------------------------------------------------

type ParsedBlock = {
  title: string;
  start: string | null;
  end: string | null;
  durationMinutes: number | null;
  timeOfDay: 'morning' | 'afternoon' | 'evening' | 'night' | null;
};

function normalizeBlock(raw: unknown): ParsedBlock | null {
  if (typeof raw !== 'object' || raw === null) return null;
  const obj = raw as Record<string, unknown>;

  const title = typeof obj.title === 'string' ? obj.title.trim() : '';
  if (!title) return null;

  const start = isHHMM(obj.start) ? (obj.start as string) : null;
  const end = isHHMM(obj.end) ? (obj.end as string) : null;
  const durationMinutes =
    typeof obj.durationMinutes === 'number' && obj.durationMinutes > 0
      ? Math.round(obj.durationMinutes)
      : null;
  const TIME_OF_DAY = new Set(['morning', 'afternoon', 'evening', 'night']);
  const timeOfDay =
    typeof obj.timeOfDay === 'string' && TIME_OF_DAY.has(obj.timeOfDay)
      ? (obj.timeOfDay as ParsedBlock['timeOfDay'])
      : null;

  return { title, start, end, durationMinutes, timeOfDay };
}

function isHHMM(value: unknown): boolean {
  return typeof value === 'string' && /^\d{2}:\d{2}$/.test(value);
}
