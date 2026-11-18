/**
 * @jest-environment node
 */
import { beforeEach, describe, expect, it, jest } from '@jest/globals';

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
// Baza se u ovim testovima ne otvara (refineDayDiagnosis bez oblaka izlazi prije čitanja).
jest.mock('@/db/open', () => ({
  getDb: () => {
    throw new Error('baza se ne smije otvoriti bez oblaka');
  },
}));

/* eslint-disable import/first -- moduli se uvoze nakon mockova */
import { DAY_REPORT_PROMPT_VERSION } from '../../../supabase/functions/_shared/report-logic';
import { EXAMPLE_TIRED_TUESDAY } from '../../../supabase/functions/_shared/report-examples';
import { LLM_DAY_DIAGNOSIS_VERSION } from '@/core/diagnosis';

import { refineDayDiagnosis, requestWriteReport, WRITE_REPORT_TIMEOUT_MS } from './write-report-client';
/* eslint-enable import/first */

const body = JSON.parse(JSON.stringify(EXAMPLE_TIRED_TUESDAY)) as Parameters<typeof requestWriteReport>[0];
const report = {
  version: 'llm-day-v1',
  summary: 'Teži dan.',
  praise: [],
  noticed: [],
  problems: [],
  ideas: ['Lakši utorak.'],
};

describe('requestWriteReport (korak 31)', () => {
  beforeEach(() => {
    mockClient = { auth: { getSession: mockGetSession }, functions: { invoke: mockInvoke } };
    mockGetSession.mockClear();
    mockInvoke.mockReset();
    jest.spyOn(console, 'warn').mockImplementation(() => undefined);
  });

  it('verzija prompta je ista u appu i na serveru', () => {
    expect(LLM_DAY_DIAGNOSIS_VERSION).toBe(DAY_REPORT_PROMPT_VERSION);
  });

  it('bez oblaka ne zove ništa i ne čita bazu', async () => {
    mockClient = null;
    expect(await requestWriteReport(body)).toBeNull();
    expect(await refineDayDiagnosis('2026-11-17', 'hr', () => '')).toBeNull();
  });

  it('bez prijave ne zove funkciju', async () => {
    mockGetSession.mockResolvedValueOnce({ data: { session: null } });
    expect(await requestWriteReport(body)).toBeNull();
    expect(mockInvoke).not.toHaveBeenCalled();
  });

  it('šalje zahtjev s rokom i vraća provjeren tekst', async () => {
    mockInvoke.mockResolvedValueOnce({ data: { report }, error: null });
    expect(await requestWriteReport(body)).toEqual(report);
    expect(mockInvoke).toHaveBeenCalledWith('write-report', { body, timeout: WRITE_REPORT_TIMEOUT_MS });
  });

  it('greška, iznimka, `report: null` ili krivi oblik → lokalna dijagnoza (null)', async () => {
    mockInvoke.mockResolvedValueOnce({ data: null, error: { message: '502' } });
    expect(await requestWriteReport(body)).toBeNull();
    mockInvoke.mockRejectedValueOnce(new Error('timeout'));
    expect(await requestWriteReport(body)).toBeNull();
    mockInvoke.mockResolvedValueOnce({ data: { report: null }, error: null });
    expect(await requestWriteReport(body)).toBeNull();
    mockInvoke.mockResolvedValueOnce({ data: { report: { ...report, ideas: [] } }, error: null });
    expect(await requestWriteReport(body)).toBeNull();
  });
});
