import { describe, expect, it } from '@jest/globals';
import { createInstance } from 'i18next';

import en from '@/i18n/en.json';
import hr from '@/i18n/hr.json';

const i18n = createInstance();
void i18n.init({
  resources: { hr: { translation: hr }, en: { translation: en } },
  lng: 'hr',
  initAsync: false,
  interpolation: { escapeValue: false },
});

describe('tekstovi zabrana u planovima (korak 28)', () => {
  it('niz s množinom (HR one/few/other, EN one/other)', () => {
    const hrT = i18n.getFixedT('hr');
    const enT = i18n.getFixedT('en');
    expect(hrT('rules.streak', { count: 1 })).toBe('Niz: 1 dan');
    expect(hrT('rules.streak', { count: 3 })).toBe('Niz: 3 dana');
    expect(hrT('rules.streak', { count: 21 })).toBe('Niz: 21 dan');
    expect(hrT('rules.streak', { count: 7 })).toBe('Niz: 7 dana');
    expect(enT('rules.streak', { count: 1 })).toBe('Streak: 1 day');
    expect(enT('rules.streak', { count: 4 })).toBe('Streak: 4 days');
  });

  it('svako razdoblje ima naslov, prazno stanje i naslov urednika u oba jezika', () => {
    for (const lng of ['hr', 'en'] as const) {
      const t = i18n.getFixedT(lng);
      for (const period of ['week', 'month', 'year'] as const) {
        for (const key of ['heading', 'empty', 'emptyPast'] as const) {
          expect(t(`rules.${period}.${key}`)).not.toMatch(/^rules\./);
        }
        expect(t(`rules.editor.title.${period}`)).not.toMatch(/^rules\./);
      }
      for (const weight of [1, 2, 3] as const) expect(t(`rules.weight.${weight}`)).not.toMatch(/^rules\./);
      expect(t('rules.rowA11y', { title: 'X', streak: 'S', weight: 'W' })).toContain('X');
      expect(t('rules.editor.range', { from: 'A', to: 'B' })).toMatch(/A.*B/);
    }
  });
});
