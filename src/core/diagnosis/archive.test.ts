import { describe, expect, it } from '@jest/globals';

import { archiveByMonth, archiveLimit, archivePage, ARCHIVE_PAGE, type ArchiveEntry } from './archive';

const entry = (date: string, over: Partial<ArchiveEntry> = {}): ArchiveEntry => ({
  date,
  trend: 'same',
  summary: { key: 'summary.same', params: { done: 3, total: 4 } },
  seen: true,
  ...over,
});

describe('archiveByMonth', () => {
  it('grupira po mjesecu, najnoviji mjesec i dan prvi', () => {
    const grouped = archiveByMonth([
      entry('2026-10-30'),
      entry('2026-11-02'),
      entry('2026-11-12'),
      entry('2026-09-01'),
    ]);
    expect(grouped.map((group) => group.month)).toEqual(['2026-11', '2026-10', '2026-09']);
    expect(grouped[0]?.entries.map((e) => e.date)).toEqual(['2026-11-12', '2026-11-02']);
  });

  it('isti dan se ne ponavlja — vrijedi prvi pročitani zapis', () => {
    const grouped = archiveByMonth([
      entry('2026-11-12', { trend: 'better' }),
      entry('2026-11-12', { trend: 'worse' }),
    ]);
    expect(grouped[0]?.entries).toHaveLength(1);
    expect(grouped[0]?.entries[0]?.trend).toBe('better');
  });

  it('neispravan dan se izbacuje, prazan ulaz daje prazan popis', () => {
    expect(archiveByMonth([entry('2026-11'), entry('')])).toEqual([]);
    expect(archiveByMonth([])).toEqual([]);
  });

  it('mjeseci se sortiraju i preko granice godine', () => {
    const grouped = archiveByMonth([entry('2025-12-31'), entry('2026-01-01')]);
    expect(grouped.map((group) => group.month)).toEqual(['2026-01', '2025-12']);
  });
});

describe('archiveLimit', () => {
  it('traži jedan zapis više od prikazanog, da se zna ima li još', () => {
    expect(archiveLimit(1)).toBe(ARCHIVE_PAGE + 1);
    expect(archiveLimit(3)).toBe(3 * ARCHIVE_PAGE + 1);
  });

  it('neispravna stranica se svodi na prvu', () => {
    expect(archiveLimit(0)).toBe(ARCHIVE_PAGE + 1);
    expect(archiveLimit(-2)).toBe(ARCHIVE_PAGE + 1);
    expect(archiveLimit(1.5)).toBe(ARCHIVE_PAGE + 1);
    expect(archiveLimit(Number.NaN)).toBe(ARCHIVE_PAGE + 1);
  });
});

describe('archivePage', () => {
  const many = (count: number) =>
    Array.from({ length: count }, (_, index) => entry(`2026-11-${String(index + 1).padStart(2, '0')}`));

  it('prikazuje stranicu i javlja da ima još kad je pročitan onaj jedan višak', () => {
    const page = archivePage(many(ARCHIVE_PAGE + 1), 1);
    expect(page.entries).toHaveLength(ARCHIVE_PAGE);
    expect(page.more).toBe(true);
  });

  it('bez viška nema „još“', () => {
    expect(archivePage(many(ARCHIVE_PAGE), 1).more).toBe(false);
    expect(archivePage(many(3), 1)).toEqual({ entries: many(3), more: false });
  });

  it('druga stranica prikazuje dvostruko', () => {
    const page = archivePage(many(2 * ARCHIVE_PAGE + 1), 2);
    expect(page.entries).toHaveLength(2 * ARCHIVE_PAGE);
    expect(page.more).toBe(true);
  });

  it('prazan ulaz i neispravna stranica ne ruše prikaz', () => {
    expect(archivePage([], 1)).toEqual({ entries: [], more: false });
    expect(archivePage(many(3), 0).entries).toHaveLength(3);
  });
});
