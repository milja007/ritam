import { describe, expect, it } from '@jest/globals';
import { createInstance } from 'i18next';

import en from '@/i18n/en.json';
import hr from '@/i18n/hr.json';

import { morningBody, morningText } from './morning-text';

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

describe('morningText', () => {
  const summary = { blocks: 5, tasks: 0, first: { title: 'Posao', start: '09:00' } };

  it('bez tjedne: običan naslov i pregled dana', async () => {
    const t = await translator('hr');
    expect(morningText(t, summary, false)).toEqual({
      title: 'Dobro jutro',
      body: 'Danas 5 blokova. Prvi: Posao u 09:00.',
    });
  });

  it('tjedna spremna: naslov i uputa na tab Tjedan, pa pregled dana (HR/EN)', async () => {
    const hrT = await translator('hr');
    expect(morningText(hrT, summary, true)).toEqual({
      title: 'Tjedna dijagnoza je spremna',
      body: 'Pogledaj kako ti je prošao tjedan na tabu Tjedan. Danas 5 blokova. Prvi: Posao u 09:00.',
    });
    const enT = await translator('en');
    expect(morningText(enT, { blocks: 0, tasks: 0, first: null }, true).title).toBe('Your week diagnosis is ready');
  });
});
