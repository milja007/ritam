import { describe, expect, it } from '@jest/globals';

import { parsePlanEntry } from '.';

describe('parsePlanEntry', () => {
  it.each([
    ['Ponavljanje kemije 45 min poslijepodne', { title: 'Ponavljanje kemije', minutes: 45, part: 'afternoon' }],
    ['Trening 1h', { title: 'Trening', minutes: 60, part: null }],
    ['Čitanje 1,5 h navečer', { title: 'Čitanje', minutes: 90, part: 'evening' }],
    ['Engleski 20min ujutro', { title: 'Engleski', minutes: 20, part: 'morning' }],
    ['Projekt 2 sata', { title: 'Projekt', minutes: 120, part: null }],
    ['Walk 30 minutes tonight', { title: 'Walk', minutes: 30, part: 'evening' }],
    ['Gym in the afternoon', { title: 'Gym', minutes: null, part: 'afternoon' }],
    ['Kupiti mlijeko', { title: 'Kupiti mlijeko', minutes: null, part: null }],
  ])('%s', (text, expected) => {
    expect(parsePlanEntry(text)).toMatchObject({ ...expected, start: null, end: null });
  });

  it('vrijeme se čita prije trajanja ("u 15h" nije trajanje)', () => {
    expect(parsePlanEntry('Zubar u 15h')).toEqual({
      title: 'Zubar',
      start: '15:00',
      end: null,
      minutes: null,
      part: null,
    });
    expect(parsePlanEntry('Trening u 18 1h')).toMatchObject({ title: 'Trening', start: '18:00', minutes: 60 });
    expect(parsePlanEntry('Trening 18-19')).toMatchObject({ start: '18:00', end: '19:00', minutes: null });
  });

  it('trajanje izvan 5 min – 12 h ostaje u nazivu', () => {
    expect(parsePlanEntry('Pauza 2 min')).toMatchObject({ title: 'Pauza 2 min', minutes: null });
    expect(parsePlanEntry('Put 20 h')).toMatchObject({ title: 'Put 20 h', minutes: null });
  });

  it('naziv samo od trajanja ostaje kakav je; prazno → null', () => {
    expect(parsePlanEntry('45 min')).toMatchObject({ title: '45 min', minutes: null, part: null });
    expect(parsePlanEntry('  ')).toBeNull();
  });

  it('riječ unutar druge riječi nije doba dana', () => {
    expect(parsePlanEntry('Jutarnja rutina')).toMatchObject({ title: 'Jutarnja rutina', part: null });
  });
});
