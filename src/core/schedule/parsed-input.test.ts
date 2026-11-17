import { describe, expect, it } from '@jest/globals';

import type { ParsedBlock } from './edge-types';
import {
  MAX_PARSED_BLOCKS,
  parsedBlocksToDrafts,
  parsedBlockToEntry,
  readParseInputResponse,
  splitEntries,
  typedDrafts,
  wantsSmartParse,
} from './parsed-input';

const block = (patch: Partial<ParsedBlock> & { title: string }): ParsedBlock => ({
  start: null,
  end: null,
  durationMinutes: null,
  timeOfDay: null,
  ...patch,
});

describe('readParseInputResponse', () => {
  it('vraća null kad odgovor nije { blocks: [] }', () => {
    expect(readParseInputResponse(null)).toBeNull();
    expect(readParseInputResponse([])).toBeNull();
    expect(readParseInputResponse({ blocks: 'x' })).toBeNull();
    expect(readParseInputResponse('{"blocks":[]}')).toBeNull();
  });

  it('zadržava valjane, odbacuje nevaljane blokove', () => {
    const result = readParseInputResponse({
      blocks: [
        { title: '  Sastanak  s timom ', start: '15:00', end: '16:00', durationMinutes: 60, timeOfDay: 'afternoon' },
        { title: '', start: null },
        { title: 'Loše vrijeme', start: '99:99', end: null, durationMinutes: null, timeOfDay: null },
        { title: 'Loše trajanje', durationMinutes: 1.5 },
        { title: 'Loše doba', timeOfDay: 'noon' },
        null,
        'tekst',
        { title: 'Teretana', durationMinutes: 45, timeOfDay: 'evening' },
      ],
    });
    expect(result).toEqual([
      { title: 'Sastanak s timom', start: '15:00', end: '16:00', durationMinutes: 60, timeOfDay: 'afternoon' },
      { title: 'Teretana', start: null, end: null, durationMinutes: 45, timeOfDay: 'evening' },
    ]);
  });

  it('ograničava broj blokova', () => {
    const blocks = Array.from({ length: 50 }, (_, index) => ({ title: `A${index}` }));
    expect(readParseInputResponse({ blocks })).toHaveLength(MAX_PARSED_BLOCKS);
  });
});

describe('parsedBlockToEntry', () => {
  it('kraj bez ranijeg početka se ne koristi; noć je večer; ekstremno trajanje se ignorira', () => {
    expect(parsedBlockToEntry(block({ title: 'A', start: '10:00', end: '09:00' }))).toEqual({
      title: 'A',
      start: '10:00',
      end: null,
      minutes: null,
      part: null,
    });
    expect(parsedBlockToEntry(block({ title: 'B', end: '12:00', durationMinutes: 2000, timeOfDay: 'night' }))).toEqual({
      title: 'B',
      start: null,
      end: null,
      minutes: null,
      part: 'evening',
    });
  });
});

describe('parsedBlocksToDrafts', () => {
  it('slaže blokove bez preklapanja, poštuje izričito vrijeme i doba dana', () => {
    const drafts = parsedBlocksToDrafts(
      [
        block({ title: 'Sastanak', start: '15:00', end: '16:00' }),
        block({ title: 'Teretana', durationMinutes: 45, timeOfDay: 'evening' }),
        block({ title: 'Mejlovi', durationMinutes: 30 }),
        block({ title: 'Čitanje', durationMinutes: 30 }),
      ],
      [],
      '07:00',
    );
    expect(drafts).toEqual([
      { title: 'Sastanak', kind: 'task', start: '15:00', end: '16:00' },
      { title: 'Teretana', kind: 'task', start: '17:00', end: '17:45' },
      // Bez doba dana: iza zadnjeg bloka (kao tipkanje).
      { title: 'Mejlovi', kind: 'task', start: '17:45', end: '18:15' },
      { title: 'Čitanje', kind: 'task', start: '18:15', end: '18:45' },
    ]);
  });

  it('gleda i postojeće blokove sutrašnjeg dana', () => {
    const drafts = parsedBlocksToDrafts([block({ title: 'Kemija', durationMinutes: 60 })], [
      { start: '07:30', end: '15:00', kind: 'fixed' },
    ], '07:00');
    expect(drafts[0]).toMatchObject({ start: '15:00', end: '16:00' });
  });
});

describe('splitEntries / typedDrafts (lokalno, bez oblaka)', () => {
  it('dijeli na zarez, točku-zarez i novi red, ali ne u brojevima', () => {
    expect(splitEntries('Trening 18-19, zubar u 15; kemija 1,5 h\nručak 12,30')).toEqual([
      'Trening 18-19',
      'zubar u 15',
      'kemija 1,5 h',
      'ručak 12,30',
    ]);
    expect(splitEntries(' , ;\n')).toEqual([]);
  });

  it('svaka stavka postaje nacrt, slobodni termini se ne preklapaju', () => {
    expect(typedDrafts('Trening 18-19, kemija 45 min; mejlovi 30 min', [], '07:00')).toEqual([
      { title: 'Trening', kind: 'task', start: '18:00', end: '19:00' },
      { title: 'kemija', kind: 'task', start: '19:00', end: '19:45' },
      { title: 'mejlovi', kind: 'task', start: '19:45', end: '20:15' },
    ]);
  });

  it('jedna stavka radi kao prije', () => {
    expect(typedDrafts('Zubar u 16', [], '07:00')).toEqual([
      { title: 'Zubar', kind: 'task', start: '16:00', end: '17:00' },
    ]);
    expect(typedDrafts('   ', [], '07:00')).toEqual([]);
  });
});

describe('wantsSmartParse', () => {
  it('kratak jednostavan unos ide lokalno', () => {
    expect(wantsSmartParse('Trening 18-19')).toBe(false);
    expect(wantsSmartParse('Kemija 1,5 h poslijepodne')).toBe(false);
    expect(wantsSmartParse('  ')).toBe(false);
  });

  it('više stavki, veznici ili duga rečenica idu modelu', () => {
    expect(wantsSmartParse('Trening, kemija')).toBe(true);
    expect(wantsSmartParse('ujutro kemija pa trening')).toBe(true);
    expect(wantsSmartParse('meeting at 9 and then gym')).toBe(true);
    expect(wantsSmartParse('sutra moram završiti seminar iz povijesti koji traje otprilike tri sata')).toBe(true);
  });
});
