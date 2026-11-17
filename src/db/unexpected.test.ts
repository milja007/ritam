/**
 * @jest-environment node
 */
import { describe, expect, it } from '@jest/globals';

import {
  applyUnexpected,
  createBlock,
  listBlocksForDate,
  listXpEvents,
  setBlockNote,
  setBlockStatus,
} from './repos';
import { createTestDb, testDeps } from './testing/test-db';

const USER = 'user-1';
const DATE = '2026-11-10';
const at = (clock: string) => Number(clock.slice(0, 2)) * 60 + Number(clock.slice(3));

async function setup() {
  const { db } = await createTestDb();
  const deps = testDeps('2026-11-10T09:00:00.000Z');
  const block = (title: string, start: string, end: string, date = DATE) =>
    createBlock(db, USER, { date, title, start, end, taskId: null, kind: 'task', source: 'user', status: 'planned' }, deps);
  return { db, deps, block };
}

describe('applyUnexpected (Nešto je iskrslo)', () => {
  it('kasnije danas, sutra, drugi dan i preskoči; razlog kao bilješka; XP jednom', async () => {
    const { db, deps, block } = await setup();
    const a = await block('Trčanje', '10:00', '10:30');
    const b = await block('Mailovi', '10:30', '11:00');
    const c = await block('Čitanje', '10:45', '11:15');
    const d = await block('Zvati mamu', '10:50', '11:00');
    const outside = await block('Ručak', '13:00', '14:00');

    const result = applyUnexpected(
      db,
      USER,
      {
        date: DATE,
        nowMinutes: at('10:00'),
        duration: 60,
        what: '  Hitan sastanak  ',
        answers: {
          [a.id]: { choice: 'laterToday' },
          [b.id]: { choice: 'tomorrow' },
          [c.id]: { choice: 'other', otherDate: '2026-11-14' },
          [d.id]: { choice: 'skip' },
        },
      },
      deps,
    );
    expect(result).toEqual({ laterToday: 1, moved: 2, skipped: 1, xp: 5 });

    const today = await listBlocksForDate(db, USER, DATE);
    const byId = new Map(today.map((row) => [row.id, row]));
    expect(byId.get(a.id)).toMatchObject({ start: '11:00', end: '11:30', status: 'planned', note: 'Hitan sastanak' });
    expect(byId.get(b.id)).toMatchObject({ status: 'moved', note: 'Hitan sastanak' });
    expect(byId.get(c.id)).toMatchObject({ status: 'moved' });
    expect(byId.get(d.id)).toMatchObject({ status: 'skipped' });
    expect(byId.get(outside.id)).toMatchObject({ start: '13:00', status: 'planned', note: null });
    expect((await listBlocksForDate(db, USER, '2026-11-11')).map((row) => [row.title, row.start, row.status])).toEqual([
      ['Mailovi', '10:30', 'planned'],
    ]);
    expect((await listBlocksForDate(db, USER, '2026-11-14')).map((row) => row.title)).toEqual(['Čitanje']);

    // Drugi put isti dan: preraspoređeno, ali XP već ima.
    const again = applyUnexpected(
      db,
      USER,
      { date: DATE, nowMinutes: at('11:00'), duration: 15, what: 'Opet', answers: {} },
      deps,
    );
    expect(again).toEqual({ laterToday: 1, moved: 0, skipped: 0, xp: 0 });
    const xp = (await listXpEvents(db, USER)).filter((event) => event.sourceId === null);
    expect(xp.map((event) => event.amount)).toEqual([5]);

    // XP preraspoređivanja ostaje kad se blok kasnije prijavi (syncBlockTaskXp ga ne briše).
    setBlockStatus(db, USER, a.id, 'done', deps);
    expect((await listXpEvents(db, USER)).filter((event) => event.sourceId === null)).toHaveLength(1);
  });

  it('postojeća bilješka ostaje; bez razloga i samo preskoči → bez XP-a; nevaljan drugi dan → sutra', async () => {
    const { db, deps, block } = await setup();
    const a = await block('A', '10:00', '10:30');
    setBlockNote(db, USER, a.id, 'moja bilješka', deps);
    const b = await block('B', '10:10', '10:20');
    const result = applyUnexpected(
      db,
      USER,
      {
        date: DATE,
        nowMinutes: at('10:00'),
        duration: 'rest',
        what: '   ',
        answers: { [a.id]: { choice: 'skip' }, [b.id]: { choice: 'other', otherDate: '2026-12-31' } },
      },
      deps,
    );
    expect(result).toEqual({ laterToday: 0, moved: 1, skipped: 1, xp: 0 });
    const today = new Map((await listBlocksForDate(db, USER, DATE)).map((row) => [row.id, row]));
    expect(today.get(a.id)).toMatchObject({ status: 'skipped', note: 'moja bilješka' });
    expect(today.get(b.id)).toMatchObject({ status: 'moved', note: null });
    expect((await listBlocksForDate(db, USER, '2026-11-11')).map((row) => row.title)).toEqual(['B']);
  });

  it('kasnije danas bez termina → sutra; ništa pogođeno → ništa', async () => {
    const { db, deps, block } = await setup();
    const late = await block('Kasno', '22:00', '23:30');
    expect(
      applyUnexpected(
        db,
        USER,
        { date: DATE, nowMinutes: at('22:00'), duration: 30, what: 'x', answers: { [late.id]: { choice: 'laterToday' } } },
        deps,
      ),
    ).toEqual({ laterToday: 0, moved: 1, skipped: 0, xp: 5 });
    expect(
      applyUnexpected(db, USER, { date: DATE, nowMinutes: at('06:00'), duration: 15, what: 'x', answers: {} }, deps),
    ).toEqual({ laterToday: 0, moved: 0, skipped: 0, xp: 0 });
  });
});
