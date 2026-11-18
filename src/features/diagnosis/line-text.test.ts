import { describe, expect, it } from '@jest/globals';
import type { TFunction } from 'i18next';

import { diagnosisLineText } from './line-text';

const t = ((key: string, params: Record<string, unknown>) => `${key}|${JSON.stringify(params)}`) as unknown as TFunction;

describe('diagnosisLineText (korak 31b)', () => {
  it('iznosi u centima postaju formatirani euri', () => {
    const text = diagnosisLineText(t, { key: 'noticed.moneyOver', params: { diffCents: 1500 } }, 'hr');
    expect(text).toMatch(/^diagnosis\.lines\.noticed\.moneyOver\|/);
    expect(text).toMatch(/"diff":"15,00\s€"/);
  });

  it('ostali parametri ostaju', () => {
    expect(diagnosisLineText(t, { key: 'noticed.caloriesOver', params: { diff: 300 } }, 'en')).toBe(
      'diagnosis.lines.noticed.caloriesOver|{"diff":300}',
    );
  });
});
