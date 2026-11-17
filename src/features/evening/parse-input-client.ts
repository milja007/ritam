import { readParseInputResponse, type ParsedBlock, type ParseInputRequest } from '@/core/schedule';
import { getSupabase } from '@/features/auth/supabase';

/** Dulje od ovoga korisnik ne čeka — unos se razumije lokalno. */
export const PARSE_INPUT_TIMEOUT_MS = 8000;

/**
 * Korak 21: slobodan tekst → blokovi kroz Edge Function `parse-input`. Samo kad je oblak
 * uključen i korisnik prijavljen (funkcija traži JWT). Svaka greška, istek vremena ili
 * prazan/nevaljan odgovor vraća `null` — pozivatelj tada radi lokalno.
 */
export async function requestParseInput(text: string, locale: ParseInputRequest['locale']): Promise<ParsedBlock[] | null> {
  const supabase = getSupabase();
  if (!supabase) return null;
  try {
    const { data: session } = await supabase.auth.getSession();
    if (!session.session) return null;
    const body: ParseInputRequest = { text, locale };
    const { data, error } = await supabase.functions.invoke('parse-input', {
      body,
      timeout: PARSE_INPUT_TIMEOUT_MS,
    });
    if (error) {
      console.warn('parse-input failed, parsing locally', error.message);
      return null;
    }
    const blocks = readParseInputResponse(data);
    return blocks && blocks.length > 0 ? blocks : null;
  } catch (error: unknown) {
    console.warn('parse-input failed, parsing locally', error);
    return null;
  }
}
