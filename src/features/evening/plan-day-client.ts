import { readPlanDayResponse, type PlanDayRequest, type PlanDayResponse } from '@/core/schedule';
import { getSupabase } from '@/features/auth/supabase';

/** Slaganje dana traje dulje od prepoznavanja unosa (veći model). */
export const PLAN_DAY_TIMEOUT_MS = 20000;

/**
 * Korak 22: „Složi mi dan“ kroz Edge Function `plan-day`. Samo s oblakom i prijavom; odgovor
 * se ponovno provjerava prema zahtjevu. Greška, istek vremena ili nevaljan odgovor → `null`
 * (pozivatelj kaže da nije uspjelo i popis ostaje kakav jest).
 */
export async function requestPlanDay(request: PlanDayRequest): Promise<PlanDayResponse | null> {
  const supabase = getSupabase();
  if (!supabase) return null;
  try {
    const { data: session } = await supabase.auth.getSession();
    if (!session.session) return null;
    const { data, error } = await supabase.functions.invoke('plan-day', {
      body: request,
      timeout: PLAN_DAY_TIMEOUT_MS,
    });
    if (error) {
      console.warn('plan-day failed', error.message);
      return null;
    }
    return readPlanDayResponse(data, request);
  } catch (error: unknown) {
    console.warn('plan-day failed', error);
    return null;
  }
}
