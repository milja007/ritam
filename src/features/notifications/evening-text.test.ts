import { describe, expect, it } from '@jest/globals';
import { createInstance } from 'i18next';

import en from '@/i18n/en.json';
import hr from '@/i18n/hr.json';

import { eveningReminderText } from './evening-text';

async function translator(lng: 'hr' | 'en') {
  const instance = createInstance();
  await instance.init({
    lng,
    resources: { hr: { translation: hr }, en: { translation: en } },
    interpolation: { escapeValue: false },
  });
  return instance.t;
}

describe('eveningReminderText', () => {
  it('nothing missing → skip', async () => {
    const t = await translator('hr');
    expect(eveningReminderText(t, [], 0)).toBe('skip');
  });

  it('HR: names what is missing, with plural for unreported', async () => {
    const t = await translator('hr');
    const text = eveningReminderText(t, ['report', 'tomorrow', 'diagnosis'], 3);
    expect(text).not.toBe('skip');
    if (text === 'skip') return;
    expect(text.body).toContain('3 aktivnosti');
    expect(text.body).toContain('Sutra');
    expect(text.body).toContain('ijagnoz');
    expect(eveningReminderText(t, ['report'], 1)).toMatchObject({ body: expect.stringContaining('1 aktivnost ') });
  });

  it('EN: casual text', async () => {
    const t = await translator('en');
    expect(eveningReminderText(t, ['tomorrow'], 0)).toMatchObject({ body: expect.stringContaining('Tomorrow') });
  });
});
