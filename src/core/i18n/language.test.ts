import { describe, expect, it } from '@jest/globals';

import { FALLBACK_LANGUAGE, resolveLanguage, toSupportedLanguage } from './language';

describe('toSupportedLanguage', () => {
  it.each([
    ['hr', 'hr'],
    ['hr-HR', 'hr'],
    ['HR', 'hr'],
    ['en_US', 'en'],
    ['en-GB', 'en'],
    [' en ', 'en'],
  ])('%s → %s', (tag, expected) => {
    expect(toSupportedLanguage(tag)).toBe(expected);
  });

  it.each(['de', 'de-DE', 'sr-Latn-RS', '', 'h', 'hrv'])('nepodržano: %p → null', (tag) => {
    expect(toSupportedLanguage(tag)).toBeNull();
  });

  it('null/undefined → null', () => {
    expect(toSupportedLanguage(null)).toBeNull();
    expect(toSupportedLanguage(undefined)).toBeNull();
  });
});

describe('resolveLanguage', () => {
  it('ručna preferencija pobjeđuje jezik uređaja', () => {
    expect(resolveLanguage('en', ['hr-HR'])).toBe('en');
    expect(resolveLanguage('hr', ['en-US'])).toBe('hr');
  });

  it('system: hrvatski uređaj → hr', () => {
    expect(resolveLanguage('system', ['hr-HR'])).toBe('hr');
  });

  it('system: engleski uređaj → en', () => {
    expect(resolveLanguage('system', ['en-US'])).toBe('en');
  });

  it('system: uzima prvi podržani jezik po redoslijedu uređaja', () => {
    expect(resolveLanguage('system', ['de-DE', 'hr-HR', 'en-US'])).toBe('hr');
    expect(resolveLanguage('system', ['de-DE', null, 'en-US', 'hr-HR'])).toBe('en');
  });

  it('system: nijedan podržan ili prazan popis → fallback', () => {
    expect(resolveLanguage('system', ['de-DE', 'fr-FR'])).toBe(FALLBACK_LANGUAGE);
    expect(resolveLanguage('system', [])).toBe(FALLBACK_LANGUAGE);
  });
});
