/**
 * @jest-environment node
 */
import { beforeEach, describe, expect, it, jest } from '@jest/globals';

const mockSetSession = jest.fn(async (_arg: unknown) => ({ error: null }));
const mockExchange = jest.fn(async (_arg: unknown) => ({ error: null }));

jest.mock('expo-linking', () => ({
  createURL: (path: string) => `ritam://${path}`,
}));
jest.mock('./supabase', () => ({
  getSupabase: () => ({ auth: { setSession: mockSetSession, exchangeCodeForSession: mockExchange } }),
}));

// eslint-disable-next-line import/first -- moduli se uvoze nakon mockova
import { completeSignInFromUrl } from './auth-api';

describe('completeSignInFromUrl (P0 audita)', () => {
  beforeEach(() => {
    mockSetSession.mockClear();
    mockExchange.mockClear();
  });

  it('link s napadačevim tokenima ne postavlja sesiju (pa ni sync ne kreće)', async () => {
    const result = await completeSignInFromUrl(
      'ritam://auth/callback#access_token=attacker&refresh_token=attacker&type=magiclink',
    );
    expect(result).toEqual({ ok: false, message: 'Sign-in link rejected (tokens)' });
    expect(mockSetSession).not.toHaveBeenCalled();
    expect(mockExchange).not.toHaveBeenCalled();
  });

  it('tuđi link koji samo završava na auth/callback se ignorira', async () => {
    expect(await completeSignInFromUrl('evil://x/auth/callback?code=abc')).toBeNull();
    expect(mockExchange).not.toHaveBeenCalled();
  });

  it('PKCE kod s točnog povratnog linka se mijenja za sesiju', async () => {
    expect(await completeSignInFromUrl('ritam://auth/callback?code=abc')).toEqual({ ok: true });
    expect(mockExchange).toHaveBeenCalledWith('abc');
    expect(mockSetSession).not.toHaveBeenCalled();
  });
});
