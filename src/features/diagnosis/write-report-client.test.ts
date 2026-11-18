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
import { DAY_REPORT_PROMPT_VERSION, WEEK_REPORT_PROMPT_VERSION } from '../../../supabase/functions/_shared/report-logic';
import { EXAMPLE_TIRED_TUESDAY, EXAMPLE_WEEK_EVENINGS } from '../../../supabase/functions/_shared/report-examples';
import { LLM_DAY_DIAGNOSIS_VERSION, LLM_WEEK_DIAGNOSIS_VERSION } from '@/core/diagnosis';

import {
  refineDayDiagnosis,
  refineWeekDiagnosis,
  requestWriteReport,
  requestWriteWeekReport,
  WRITE_REPORT_TIMEOUT_MS,
} from './write-report-client';
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

describe('requestWriteWeekReport (korak 31c)', () => {
  const weekBody = JSON.parse(JSON.stringify(EXAMPLE_WEEK_EVENINGS)) as Parameters<typeof requestWriteWeekReport>[0];
  const weekText = {
    version: 'llm-week-v1',
    summary: 'Tjedan kao prošli.',
    praise: [],
    noticed: ['Večeri padaju.'],
    problems: [],
    ideaWhy: 'Jutro je slobodnije.',
  };

  beforeEach(() => {
    mockClient = { auth: { getSession: mockGetSession }, functions: { invoke: mockInvoke } };
    mockInvoke.mockReset();
    jest.spyOn(console, 'warn').mockImplementation(() => undefined);
  });

  it('verzija prompta je ista u appu i na serveru', () => {
    expect(LLM_WEEK_DIAGNOSIS_VERSION).toBe(WEEK_REPORT_PROMPT_VERSION);
  });

  it('bez oblaka ne zove ništa i ne čita bazu', async () => {
    mockClient = null;
    expect(await requestWriteWeekReport(weekBody)).toBeNull();
    expect(await refineWeekDiagnosis('2026-11-09', 'hr', () => '')).toBeNull();
  });

  it('vraća provjeren tekst tjedna; dnevni oblik odgovora se ne prihvaća', async () => {
    mockInvoke.mockResolvedValueOnce({ data: { report: weekText }, error: null });
    expect(await requestWriteWeekReport(weekBody)).toEqual(weekText);
    expect(mockInvoke).toHaveBeenCalledWith('write-report', { body: weekBody, timeout: WRITE_REPORT_TIMEOUT_MS });
    mockInvoke.mockResolvedValueOnce({ data: { report }, error: null });
    expect(await requestWriteWeekReport(weekBody)).toBeNull();
  });
});
