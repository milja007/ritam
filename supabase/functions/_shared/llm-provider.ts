/**
 * LLM provider modul (Korak 20).
 *
 * Sučelje `LLMProvider` s implementacijom za Anthropic Claude. Svaki poziv
 * se zapisuje u `llm_calls` (service role, bez RLS) — provider, model,
 * ulazni/izlazni tokeni, trajanje i uspjeh.
 *
 * Ključ `ANTHROPIC_API_KEY` dolazi isključivo iz Supabase secrets — nikad
 * iz repoa ni iz env datoteke.
 *
 * DeepSeek implementacija dolazi kada Borna promijeni provider (korak iz
 * faze 4). Jedina promjena tada: zamijeniti `createClaudeProvider()` s
 * `createDeepSeekProvider()` u svakoj Edge Function koja ovaj modul koristi.
 */

// deno-lint-ignore-file no-explicit-any

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

// ---------------------------------------------------------------------------
// Javno sučelje
// ---------------------------------------------------------------------------

export type Message = {
  role: 'user' | 'assistant';
  content: string;
};

export type CompletionOptions = {
  /** System prompt (upute za model, ne mjenja se između poziva). */
  system?: string;
  /** Maksimalni broj izlaznih tokena. Zadano: 2048. */
  maxTokens?: number;
  /** Temperatura (0–1). Zadano: 0.7. */
  temperature?: number;
};

export type CompletionResult = {
  content: string;
  usage: {
    inputTokens: number;
    outputTokens: number;
  };
};

/** Svaki provider izlaže jednu metodu. */
export interface LLMProvider {
  readonly providerName: string;
  readonly modelName: string;
  complete(messages: Message[], options?: CompletionOptions): Promise<CompletionResult>;
}

// ---------------------------------------------------------------------------
// Logger: upisuje u llm_calls (service role)
// ---------------------------------------------------------------------------

type LlmCallParams = {
  userId: string;
  functionName: string;
  provider: string;
  model: string;
  inputTokens: number | null;
  outputTokens: number | null;
  ms: number | null;
  ok: boolean;
};

async function logLlmCall(params: LlmCallParams): Promise<void> {
  const url = Deno.env.get('SUPABASE_URL');
  const key = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (!url || !key) return; // U lokalu bez Supabasea nema kamo logirati.
  const db = createClient(url, key);
  await db.from('llm_calls').insert({
    user_id: params.userId,
    function: params.functionName,
    provider: params.provider,
    model: params.model,
    input_tokens: params.inputTokens,
    output_tokens: params.outputTokens,
    ms: params.ms,
    ok: params.ok,
  });
  // Greška logginga ne prekida poziv — provider je to već završio.
}

// ---------------------------------------------------------------------------
// Claude (Anthropic) implementacija
// ---------------------------------------------------------------------------

const CLAUDE_API_URL = 'https://api.anthropic.com/v1/messages';
const CLAUDE_VERSION_HEADER = '2023-06-01';

export function createClaudeProvider(model = 'claude-sonnet-4-5'): LLMProvider {
  const apiKey = Deno.env.get('ANTHROPIC_API_KEY');
  if (!apiKey) throw new Error('ANTHROPIC_API_KEY nije postavljen u Supabase secrets.');

  return {
    providerName: 'anthropic',
    modelName: model,

    async complete(messages: Message[], options: CompletionOptions = {}): Promise<CompletionResult> {
      const { system, maxTokens = 2048, temperature = 0.7 } = options;
      const body: Record<string, any> = {
        model,
        max_tokens: maxTokens,
        temperature,
        messages,
      };
      if (system) body.system = system;

      const res = await fetch(CLAUDE_API_URL, {
        method: 'POST',
        headers: {
          'x-api-key': apiKey,
          'anthropic-version': CLAUDE_VERSION_HEADER,
          'content-type': 'application/json',
        },
        body: JSON.stringify(body),
      });

      if (!res.ok) {
        const text = await res.text();
        throw new Error(`Anthropic API greška ${res.status}: ${text}`);
      }

      const data = await res.json();
      const content: string = data.content?.[0]?.text ?? '';
      const inputTokens: number = data.usage?.input_tokens ?? 0;
      const outputTokens: number = data.usage?.output_tokens ?? 0;

      return { content, usage: { inputTokens, outputTokens } };
    },
  };
}

// ---------------------------------------------------------------------------
// Wrapper koji dodaje logiranje bez mijenjanja sučelja
// ---------------------------------------------------------------------------

/**
 * Omota provider s logiranjem u `llm_calls`. Koristi se ovako:
 *
 * ```ts
 * const provider = withLogging(createClaudeProvider(), userId, 'parse-input');
 * const result = await provider.complete(messages, options);
 * // → logira automatski, neovisno o tome je li poziv uspio
 * ```
 */
export function withLogging(
  inner: LLMProvider,
  userId: string,
  functionName: string,
): LLMProvider {
  return {
    providerName: inner.providerName,
    modelName: inner.modelName,

    async complete(messages: Message[], options?: CompletionOptions): Promise<CompletionResult> {
      const start = Date.now();
      let ok = false;
      let inputTokens: number | null = null;
      let outputTokens: number | null = null;

      try {
        const result = await inner.complete(messages, options);
        ok = true;
        inputTokens = result.usage.inputTokens;
        outputTokens = result.usage.outputTokens;
        return result;
      } finally {
        const ms = Date.now() - start;
        // Fire-and-forget — greška logginga ne prekida tok.
        logLlmCall({
          userId,
          functionName,
          provider: inner.providerName,
          model: inner.modelName,
          inputTokens,
          outputTokens,
          ms,
          ok,
        }).catch(console.error);
      }
    },
  };
}
