import { describe, expect, it } from '@jest/globals';

import { streakFromDates } from '@/core/gamification';
import { addDays } from '@/core/time/local-date';
import { dayMonth } from '@/features/ember/format';
import { createInstance } from 'i18next';

import en from '@/i18n/en.json';
import hr from '@/i18n/hr.json';

import { streakHintKey } from './streak-hint';

const TODAY = '2026-11-08';
const week = (last: string) => Array.from({ length: 7 }, (_, i) => addDays(last, i - 6) as string);

describe('streakHintKey', () => {
  it('danas ubrojen', () => {
    expect(streakHintKey(streakFromDates([TODAY], TODAY))).toBe('progress.streak.hintDone');
  });
  it('niz do jučer', () => {
    expect(streakHintKey(streakFromDates(['2026-11-07'], TODAY))).toBe('progress.streak.hintKeep');
  });
  it('žeravica čuva niz (jučer propušten)', () => {
    expect(streakHintKey(streakFromDates(week('2026-11-06'), TODAY))).toBe('progress.streak.hintFrozen');
  });
  it('bez niza', () => {
    expect(streakHintKey(streakFromDates([], TODAY))).toBe('progress.streak.hintStart');
  });
});

const i18n = createInstance();
void i18n.init({
  resources: { hr: { translation: hr }, en: { translation: en } },
  lng: 'hr',
  initAsync: false,
  interpolation: { escapeValue: false },
});

describe('tekstovi žeravice', () => {
  it('HR i EN imaju sve ključeve i množinu', () => {
    for (const lng of ['hr', 'en'] as const) {
      const t = i18n.getFixedT(lng);
      expect(t('progress.freeze.title', { held: 1, max: 2 })).toMatch(/1.*2/);
      expect(t('progress.freeze.nextIn', { count: 1 })).toMatch(/1/);
      expect(t('progress.freeze.nextIn', { count: 3 })).toMatch(/3/);
      expect(t('progress.streak.hintFrozen')).not.toBe('progress.streak.hintFrozen');
    }
    expect(i18n.getFixedT('hr')('progress.freeze.nextIn', { count: 1 })).toBe('Sljedeća za 1 dan zaredom.');
    expect(i18n.getFixedT('hr')('progress.freeze.nextIn', { count: 3 })).toBe('Sljedeća za 3 dana zaredom.');
  });
  it('datum sačuvanog dana', () => {
    expect(dayMonth('2026-11-12', 'hr')).toBe('12. studenoga');
    expect(dayMonth('2026-11-12', 'en')).toBe('November 12');
  });
});
