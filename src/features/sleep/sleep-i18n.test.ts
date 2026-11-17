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

describe('tekstovi sna (korak 29)', () => {
  it('lakše jutro: množina sati i aktivnosti', () => {
    const hrT = i18n.getFixedT('hr');
    const enT = i18n.getFixedT('en');
    expect(hrT('morning.ease.hours', { count: 1 })).toBe('1 sat');
    expect(hrT('morning.ease.hours', { count: 2 })).toBe('2 sata');
    expect(hrT('morning.ease.hours', { count: 5 })).toBe('5 sati');
    expect(enT('morning.ease.hours', { count: 2 })).toBe('2 hours');
    expect(hrT('morning.ease.action', { count: 1 })).toBe('Olakšaj jutro (1 aktivnost)');
    expect(hrT('morning.ease.action', { count: 3 })).toBe('Olakšaj jutro (3 aktivnosti)');
    expect(enT('morning.ease.action', { count: 1 })).toBe('Ease the morning (1 activity)');
    expect(hrT('morning.ease.title', { deficit: '1 sat' })).toBe('Spavao si 1 sat manje od cilja');
  });

  it('kartica sna ima sve ključeve u oba jezika', () => {
    expect(Object.keys(hr.sleepCard).sort()).toEqual(Object.keys(en.sleepCard).sort());
    for (const t of [i18n.getFixedT('hr'), i18n.getFixedT('en')]) {
      expect(t('sleepCard.tonightStep', { time: '23:45', target: '23:00' })).toMatch(/23:45.*23:00/);
      expect(t('sleepCard.rested', { count: 3, total: 5 })).toMatch(/3.*5/);
      expect(t('sleepCard.nightLabel', { day: 'd', duration: '7 h 0 min', start: '00:00' })).toContain('00:00');
    }
  });
});
