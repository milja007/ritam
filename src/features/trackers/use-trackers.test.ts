import { beforeEach, describe, expect, it, jest } from '@jest/globals';

/**
 * P2 Codexa (PR #49, #50): unos trackera mora osvježiti rezultat dana (`notifyProgressChanged`),
 * a sync s drugog uređaja (koji javlja `notifyProgressChanged`) mora osvježiti unose. Hook se
 * poziva izravno — React hookovi su zamijenjeni najjednostavnijim oblikom.
 */
jest.mock('react', () => ({
  useCallback: (fn: unknown) => fn,
  useMemo: (fn: () => unknown, deps: unknown[]) => {
    mockMemoDeps.push(deps);
    return fn();
  },
  useSyncExternalStore: (_subscribe: unknown, get: () => unknown) => get(),
}));

const mockMemoDeps: unknown[][] = [];
let mockProgressVersion = 0;
const mockNotifyProgress = jest.fn(() => {
  mockProgressVersion += 1;
});
jest.mock('@/features/progress', () => ({
  notifyProgressChanged: () => mockNotifyProgress(),
  useProgressVersion: () => mockProgressVersion,
}));

const mockList = jest.fn(() => [] as unknown[]);
const mockAdd = jest.fn();
const mockDelete = jest.fn(() => true);
jest.mock('@/db/repos', () => ({
  listTrackerEntries: () => mockList(),
  addTrackerEntry: () => mockAdd(),
  deleteTrackerEntry: () => mockDelete(),
}));
jest.mock('@/db/open', () => ({ getDb: () => ({}) }));

/* eslint-disable import/first -- modul se uvozi nakon mockova */
import { useTrackerEntries } from './use-trackers';

describe('useTrackerEntries — osvježavanje (P2 Codexa)', () => {
  beforeEach(() => {
    mockMemoDeps.length = 0;
    mockNotifyProgress.mockClear();
    mockList.mockClear();
  });

  it('dodavanje i uklanjanje unosa javljaju promjenu napretka (rezultat dana)', () => {
    const { add, remove } = useTrackerEntries('2026-11-18', '2026-11-18');
    expect(add({ date: '2026-11-18', kind: 'calories', amount: 600, note: '' })).toBe(true);
    expect(mockNotifyProgress).toHaveBeenCalledTimes(1);
    expect(remove('id-1')).toBe(true);
    expect(mockNotifyProgress).toHaveBeenCalledTimes(2);
  });

  it('promjena napretka (npr. nakon synca) mijenja ključ čitanja unosa', () => {
    useTrackerEntries('2026-11-18', '2026-11-18');
    const before = mockMemoDeps.at(-1);
    mockProgressVersion += 1;
    useTrackerEntries('2026-11-18', '2026-11-18');
    const after = mockMemoDeps.at(-1);
    expect(after).not.toEqual(before);
    expect(mockList).toHaveBeenCalledTimes(2);
  });
});
