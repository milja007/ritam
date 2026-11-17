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

// eslint-disable-next-line import/first -- moduli se uvoze nakon mockova
import { PARSE_INPUT_TIMEOUT_MS, requestParseInput } from './parse-input-client';

describe('requestParseInput (korak 21)', () => {
  beforeEach(() => {
    mockClient = { auth: { getSession: mockGetSession }, functions: { invoke: mockInvoke } };
    mockGetSession.mockClear();
    mockInvoke.mockReset();
    jest.spyOn(console, 'warn').mockImplementation(() => undefined);
  });

  it('bez oblaka ne zove ništa', async () => {
    mockClient = null;
    expect(await requestParseInput('a, b', 'hr')).toBeNull();
  });

  it('bez prijave ne zove funkciju', async () => {
    mockGetSession.mockResolvedValueOnce({ data: { session: null } });
    expect(await requestParseInput('a, b', 'hr')).toBeNull();
    expect(mockInvoke).not.toHaveBeenCalled();
  });

  it('šalje tekst i jezik s rokom i vraća provjerene blokove', async () => {
    mockInvoke.mockResolvedValueOnce({
      data: { blocks: [{ title: 'Trening', start: '18:00', end: '19:00', durationMinutes: 60, timeOfDay: null }, { title: '' }] },
      error: null,
    });
    expect(await requestParseInput('trening 18-19 pa zubar', 'en')).toEqual([
      { title: 'Trening', start: '18:00', end: '19:00', durationMinutes: 60, timeOfDay: null },
    ]);
    expect(mockInvoke).toHaveBeenCalledWith('parse-input', {
      body: { text: 'trening 18-19 pa zubar', locale: 'en' },
      timeout: PARSE_INPUT_TIMEOUT_MS,
    });
  });

  it('greška, iznimka, nevaljan ili prazan odgovor → lokalno (null)', async () => {
    mockInvoke.mockResolvedValueOnce({ data: null, error: { message: '502' } });
    expect(await requestParseInput('a, b', 'hr')).toBeNull();
    mockInvoke.mockRejectedValueOnce(new Error('timeout'));
    expect(await requestParseInput('a, b', 'hr')).toBeNull();
    mockInvoke.mockResolvedValueOnce({ data: 'nije json', error: null });
    expect(await requestParseInput('a, b', 'hr')).toBeNull();
    mockInvoke.mockResolvedValueOnce({ data: { blocks: [] }, error: null });
    expect(await requestParseInput('a, b', 'hr')).toBeNull();
  });
});
