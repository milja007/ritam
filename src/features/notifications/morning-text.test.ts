import { describe, expect, it } from '@jest/globals';
import { createInstance } from 'i18next';

import en from '@/i18n/en.json';
import hr from '@/i18n/hr.json';

import { morningBody } from './morning-text';

async function translator(lng: 'hr' | 'en') {
  const instance = createInstance();
  await instance.init({
    lng,
    resources: { hr: { translation: hr }, en: { translation: en } },
    interpolation: { escapeValue: false },
  });
  return instance.t;
}

describe('morningBody', () => {
  it('HR: množina blokova i zadataka, prvi blok', async () => {
    const t = await translator('hr');
    const first = { title: 'Posao', start: '09:00' };
    expect(morningBody(t, { blocks: 4, tasks: 2, first })).toBe(
      'Danas 4 bloka, od toga 2 zadatka. Prvi: Posao u 09:00.',
    );
    expect(morningBody(t, { blocks: 1, tasks: 1, first })).toBe(
      'Danas 1 blok, od toga 1 zadatak. Prvi: Posao u 09:00.',
    );
    expect(morningBody(t, { blocks: 5, tasks: 0, first })).toBe('Danas 5 blokova. Prvi: Posao u 09:00.');
    expect(morningBody(t, { blocks: 0, tasks: 0, first: null })).toBe(
      'Za danas još nemaš plan. Otvori Ritam i složi dan.',
    );
  });

  it('EN', async () => {
    const t = await translator('en');
    expect(morningBody(t, { blocks: 2, tasks: 1, first: { title: 'Work', start: '09:00' } })).toBe(
      'Today: 2 blocks, 1 of them a task. First: Work at 09:00.',
    );
  });
});
