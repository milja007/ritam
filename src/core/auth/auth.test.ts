import { describe, expect, it } from '@jest/globals';

import {
  isAuthCallbackUrl,
  isFlagOn,
  isValidEmail,
  isValidEmailCode,
  normalizeEmail,
  normalizeEmailCode,
  parseAuthCallback,
  readCloudConfig,
} from './index';

const URL_OK = 'https://imsbokdyusrwyvyjvjfw.supabase.co';

describe('readCloudConfig', () => {
  it('je isključen bez flaga, čak i s URL-om i ključem', () => {
    expect(readCloudConfig({ url: URL_OK, key: 'pk' })).toEqual({ enabled: false, reason: 'flag-off' });
    expect(readCloudConfig({ url: URL_OK, key: 'pk', featureAuth: '0' }).enabled).toBe(false);
  });

  it('traži URL i ključ kad je flag uključen', () => {
    expect(readCloudConfig({ featureAuth: '1', key: 'pk' })).toEqual({ enabled: false, reason: 'missing-url' });
    expect(readCloudConfig({ featureAuth: '1', url: URL_OK, key: '  ' })).toEqual({
      enabled: false,
      reason: 'missing-key',
    });
    expect(readCloudConfig({ featureAuth: '1', url: 'nije-url', key: 'pk' })).toEqual({
      enabled: false,
      reason: 'invalid-url',
    });
  });

  it('uključen je s flagom, URL-om i ključem; uklanja završnu kosu crtu', () => {
    expect(readCloudConfig({ featureAuth: 'true', url: `${URL_OK}/`, key: ' pk ' })).toEqual({
      enabled: true,
      url: URL_OK,
      key: 'pk',
    });
  });

  it('isFlagOn prepoznaje uobičajene vrijednosti', () => {
    for (const v of ['1', 'true', 'TRUE', ' yes ', 'on']) expect(isFlagOn(v)).toBe(true);
    for (const v of [undefined, '', '0', 'false', 'no']) expect(isFlagOn(v)).toBe(false);
  });
});

describe('email', () => {
  it('normalizira i provjerava', () => {
    expect(normalizeEmail('  Borna@Example.COM ')).toBe('borna@example.com');
    expect(isValidEmail('borna@example.com')).toBe(true);
    expect(isValidEmail(' Borna@Example.hr ')).toBe(true);
    for (const bad of ['', 'borna', 'borna@', '@example.com', 'borna@example', 'a b@example.com']) {
      expect(isValidEmail(bad)).toBe(false);
    }
  });
});

describe('kod s maila', () => {
  it('prihvaća 6–10 znamenki, uz razmake i crtice', () => {
    expect(normalizeEmailCode(' 123 456 ')).toBe('123456');
    expect(isValidEmailCode('123-456')).toBe(true);
    expect(isValidEmailCode('12345')).toBe(false);
    expect(isValidEmailCode('12345a')).toBe(false);
    expect(isValidEmailCode('1234567890')).toBe(true);
    expect(isValidEmailCode('12345678901')).toBe(false);
  });
});

describe('parseAuthCallback', () => {
  it('čita tokene iz fragmenta (implicit)', () => {
    expect(
      parseAuthCallback('ritam://auth/callback#access_token=abc&refresh_token=def&expires_in=3600&type=magiclink'),
    ).toEqual({ kind: 'tokens', accessToken: 'abc', refreshToken: 'def' });
  });

  it('čita PKCE kod iz upita', () => {
    expect(parseAuthCallback('ritam://auth/callback?code=xyz')).toEqual({ kind: 'code', code: 'xyz' });
    expect(parseAuthCallback('exp://192.168.1.2:8081/--/auth/callback?code=xyz')).toEqual({
      kind: 'code',
      code: 'xyz',
    });
  });

  it('vraća grešku s dekodiranim opisom', () => {
    expect(
      parseAuthCallback(
        'ritam://auth/callback#error=access_denied&error_code=otp_expired&error_description=Email+link+is+invalid+or+has+expired',
      ),
    ).toEqual({ kind: 'error', message: 'Email link is invalid or has expired' });
  });

  it('ignorira druge linkove i prazne callbacke', () => {
    expect(parseAuthCallback(null)).toEqual({ kind: 'none' });
    expect(parseAuthCallback('ritam://profile?code=xyz')).toEqual({ kind: 'none' });
    expect(parseAuthCallback('ritam://auth/callback')).toEqual({ kind: 'none' });
    expect(parseAuthCallback('ritam://auth/callback#access_token=abc')).toEqual({ kind: 'none' });
  });

  it('isAuthCallbackUrl', () => {
    expect(isAuthCallbackUrl('ritam://auth/callback/')).toBe(true);
    expect(isAuthCallbackUrl('ritam:///auth/callback?code=1')).toBe(true);
    expect(isAuthCallbackUrl('ritam://auth')).toBe(false);
    expect(isAuthCallbackUrl(undefined)).toBe(false);
  });
});
