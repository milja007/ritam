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

describe('tekstovi planiranja tjedna (korak 25)', () => {
  it('„ostalo je N dana“ s množinom (HR one/few/other, EN one/other)', () => {
    const hrT = i18n.getFixedT('hr');
    const enT = i18n.getFixedT('en');
    expect(hrT('ember.week.daysLeft', { count: 1 })).toBe('Ostao je još 1 dan ovog tjedna');
    expect(hrT('ember.week.daysLeft', { count: 3 })).toBe('Ostala su još 3 dana ovog tjedna');
    expect(hrT('ember.week.daysLeft', { count: 5 })).toBe('Ostalo je još 5 dana ovog tjedna');
    expect(enT('ember.week.daysLeft', { count: 1 })).toBe('1 day left this week');
    expect(enT('ember.week.daysLeft', { count: 6 })).toBe('6 days left this week');
  });

  it('plan dana s Tjedna ima sve tekstove s imenom dana u oba jezika', () => {
    for (const lng of ['hr', 'en'] as const) {
      const t = i18n.getFixedT(lng);
      for (const key of ['overline', 'title', 'doneTitle'] as const) {
        expect(t(`evening.dayPlan.${key}`, { day: 'DAN' })).toContain('DAN');
      }
      for (const key of ['subtitle', 'newItems'] as const) {
        expect(t(`evening.dayPlan.${key}`)).not.toContain('evening.');
      }
      expect(t('evening.dayPlan.doneBody', { count: 2 })).toContain('2');
      for (const key of ['planHint', 'nextWeek', 'planDayHint', 'todayHint', 'emptyNext'] as const) {
        expect(t(`ember.week.${key}`)).not.toContain('ember.');
      }
    }
  });
});

describe('tekstovi ciljeva razdoblja (korak 25)', () => {
  it('svako razdoblje ima naslov, prazno stanje i primjer u oba jezika', () => {
    for (const lng of ['hr', 'en'] as const) {
      const t = i18n.getFixedT(lng);
      for (const period of ['week', 'month', 'year'] as const) {
        for (const key of ['heading', 'empty', 'emptyPast', 'placeholder'] as const) {
          expect(t(`goals.${period}.${key}`)).not.toBe(`goals.${period}.${key}`);
        }
      }
      expect(t('goals.progress', { done: 2, total: 3 })).toMatch(/2.*3/);
      expect(t('goals.limit', { max: 5 })).toContain('5');
      expect(t('goals.removeMessage', { title: 'T' })).toContain('T');
    }
  });
});
