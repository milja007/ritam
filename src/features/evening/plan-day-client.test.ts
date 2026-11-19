/**
 * @jest-environment node
 */
import { beforeEach, describe, expect, it, jest } from '@jest/globals';

import type { PlanDayRequest } from '@/core/schedule';

type InvokeResult = { data: unknown; error: { message: string } | null };

let mockClient: unknown = null;
const mockGetSession = jest.fn(async (): Promise<{ data: { session: object | null } }> => ({
  data: { session: { access_token: 't' } },
}));
const mockInvoke = jest.fn(async (_name: string, _options: unknown): Promise<InvokeResult> => ({
  data: null,
  error: null,
}));

jest.mock('@/features/auth/supabase', () => ({
  getSupabase: () => mockClient,
}));

// eslint-disable-next-line import/first -- moduli se uvoze nakon mockova
import { PLAN_DAY_TIMEOUT_MS, requestPlanDay } from './plan-day-client';

const request: PlanDayRequest = {
  date: '2026-11-19',
  locale: 'hr',
  priorities: [{ title: 'Kemija', durationMinutes: 45, fixedStart: null, important: false }],
  freeWindows: [{ start: '07:30', end: '23:00' }],
  preferences: null,
  context: { goals: [], tasks: [], rules: [] },
  answers: [],
};

describe('requestPlanDay (korak 22)', () => {
  beforeEach(() => {
    mockClient = { auth: { getSession: mockGetSession }, functions: { invoke: mockInvoke } };
    mockInvoke.mockReset();
    jest.spyOn(console, 'warn').mockImplementation(() => undefined);
  });

  it('bez oblaka ili prijave ne zove funkciju', async () => {
    mockClient = null;
    expect(await requestPlanDay(request)).toBeNull();
    mockClient = { auth: { getSession: mockGetSession }, functions: { invoke: mockInvoke } };
    mockGetSession.mockResolvedValueOnce({ data: { session: null } });
    expect(await requestPlanDay(request)).toBeNull();
    expect(mockInvoke).not.toHaveBeenCalled();
  });

  it('šalje zahtjev s rokom i vraća provjeren prijedlog', async () => {
    mockInvoke.mockResolvedValueOnce({
      data: { schedule: [{ title: 'Kemija', start: '08:00', end: '08:45', kind: 'suggestion' }], questions: [], summary: 'OK' },
      error: null,
    });
    expect(await requestPlanDay(request)).toEqual({
      schedule: [{ title: 'Kemija', start: '08:00', end: '08:45', kind: 'suggestion' }],
      questions: [],
      summary: 'OK',
    });
    expect(mockInvoke).toHaveBeenCalledWith('plan-day', { body: request, timeout: PLAN_DAY_TIMEOUT_MS });
  });

  it('greška, iznimka ili blok izvan prozora → null', async () => {
    mockInvoke.mockResolvedValueOnce({ data: null, error: { message: '500' } });
    expect(await requestPlanDay(request)).toBeNull();
    mockInvoke.mockRejectedValueOnce(new Error('timeout'));
    expect(await requestPlanDay(request)).toBeNull();
    mockInvoke.mockResolvedValueOnce({
      data: { schedule: [{ title: 'Kemija', start: '05:00', end: '05:45' }] },
      error: null,
    });
    expect(await requestPlanDay(request)).toBeNull();
  });
});
