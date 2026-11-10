import { describe, expect, it } from '@jest/globals';

import type { ScheduleBlock } from '@/core/domain';
import { reminderBlocks, type NotificationSettings } from '@/core/notifications';

import {
  BLOCKS_CHANNEL_ID,
  cancelBlockReminders,
  cancelDailyNotifications,
  DAILY_CHANNEL_ID,
  scheduleSnooze,
  syncBlockReminders,
  syncDailyNotifications,
  type BlockReminderTexts,
  type DailyNotificationTexts,
  type NotificationRequest,
  type NotificationScheduler,
} from './sync';

const SETTINGS: NotificationSettings = {
  wakeTime: '07:00',
  weekendWakeTime: null,
  sleepHours: 8,
  morningNotifTime: '07:00',
  eveningNotifTime: '21:15',
  windDownMinutes: 45,
  morningNotifEnabled: true,
  eveningNotifEnabled: true,
  windDownNotifEnabled: true,
};

const TEXTS: DailyNotificationTexts = {
  morning: { title: 'Jutro', body: 'Tvoj dan' },
  evening: { title: 'Večer', body: 'Upit' },
  windDown: { title: 'Wind-down', body: 'Polako' },
};

/** 9. 11. 2026. u 05:00 lokalno — sva tri današnja okidača su još pred nama. */
const NOW = new Date(2026, 10, 9, 5, 0, 0, 0);

class FakeScheduler implements NotificationScheduler {
  readonly scheduled = new Map<string, NotificationRequest | null>();
  readonly calls: string[] = [];

  constructor(existing: string[] = []) {
    for (const id of existing) this.scheduled.set(id, null);
  }

  async scheduledIds() {
    return [...this.scheduled.keys()];
  }

  async cancel(id: string) {
    this.calls.push(`cancel ${id}`);
    this.scheduled.delete(id);
  }

  async schedule(request: NotificationRequest) {
    this.calls.push(`schedule ${request.identifier}`);
    this.scheduled.set(request.identifier, request);
  }
}

describe('syncDailyNotifications', () => {
  it('prazno → zakaže 7 dana × 3 obavijesti s tekstom, kanalom i payloadom', async () => {
    const scheduler = new FakeScheduler();
    const result = await syncDailyNotifications(scheduler, SETTINGS, NOW, TEXTS);
    expect(result).toEqual({ cancelled: 0, scheduled: 21 });

    const first = scheduler.scheduled.get('morning:2026-11-09@07:00');
    expect(first).toEqual({
      identifier: 'morning:2026-11-09@07:00',
      fireAt: new Date(2026, 10, 9, 7, 0, 0, 0),
      channelId: DAILY_CHANNEL_ID,
      title: 'Jutro',
      body: 'Tvoj dan',
      data: { source: 'ritam', type: 'daily', kind: 'morning', triggerId: 'morning:2026-11-09@07:00' },
    });
    expect(scheduler.scheduled.get('windDown:2026-11-11@22:15')?.title).toBe('Wind-down');
  });

  it('drugi poziv ne radi ništa (idempotentno)', async () => {
    const scheduler = new FakeScheduler();
    await syncDailyNotifications(scheduler, SETTINGS, NOW, TEXTS);
    scheduler.calls.length = 0;
    expect(await syncDailyNotifications(scheduler, SETTINGS, NOW, TEXTS)).toEqual({
      cancelled: 0,
      scheduled: 0,
    });
    expect(scheduler.calls).toEqual([]);
  });

  it('sutradan: otkaže prošle, doda novi dan', async () => {
    const scheduler = new FakeScheduler();
    await syncDailyNotifications(scheduler, SETTINGS, NOW, TEXTS);
    // Sustav sam ukloni isporučene; ovdje simuliramo da su jučerašnje i dalje na popisu.
    const nextDay = new Date(2026, 10, 10, 5, 0, 0, 0);
    const result = await syncDailyNotifications(scheduler, SETTINGS, nextDay, TEXTS);
    expect(result).toEqual({ cancelled: 3, scheduled: 3 });
    expect([...scheduler.scheduled.keys()].filter((id) => id.includes('2026-11-09'))).toEqual([]);
    expect(scheduler.scheduled.has('evening:2026-11-12@21:15')).toBe(true);
  });

  it('promjena postavki otkazuje stara vremena prije zakazivanja novih', async () => {
    const scheduler = new FakeScheduler();
    await syncDailyNotifications(scheduler, SETTINGS, NOW, TEXTS);
    scheduler.calls.length = 0;
    const result = await syncDailyNotifications(
      scheduler,
      { ...SETTINGS, eveningNotifTime: '20:30' },
      NOW,
      TEXTS,
    );
    expect(result).toEqual({ cancelled: 7, scheduled: 7 });
    expect(scheduler.calls.slice(0, 7).every((call) => call.startsWith('cancel evening:'))).toBe(true);
  });

  it('isključena vrsta se otkazuje i više ne zakazuje', async () => {
    const scheduler = new FakeScheduler();
    await syncDailyNotifications(scheduler, SETTINGS, NOW, TEXTS);
    const result = await syncDailyNotifications(
      scheduler,
      { ...SETTINGS, windDownNotifEnabled: false },
      NOW,
      TEXTS,
    );
    expect(result).toEqual({ cancelled: 7, scheduled: 0 });
    expect([...scheduler.scheduled.keys()].some((id) => id.startsWith('windDown:'))).toBe(false);
  });

  it('tuđe obavijesti i podsjetnici blokova ostaju', async () => {
    const scheduler = new FakeScheduler(['block:abc', 'drugo']);
    await syncDailyNotifications(scheduler, SETTINGS, NOW, TEXTS);
    expect(scheduler.scheduled.has('block:abc')).toBe(true);
    expect(scheduler.scheduled.has('drugo')).toBe(true);
  });

  it('neispravne postavke → ništa se ne mijenja', async () => {
    const scheduler = new FakeScheduler(['morning:2026-11-09@07:00']);
    const result = await syncDailyNotifications(
      scheduler,
      { ...SETTINGS, wakeTime: '25:00' },
      NOW,
      TEXTS,
    );
    expect(result).toEqual({ cancelled: 0, scheduled: 0 });
    expect(scheduler.calls).toEqual([]);
  });
});

describe('cancelDailyNotifications', () => {
  it('otkaže samo naše dnevne', async () => {
    const scheduler = new FakeScheduler(['morning:2026-11-09@07:00', 'block:abc']);
    expect(await cancelDailyNotifications(scheduler)).toBe(1);
    expect([...scheduler.scheduled.keys()]).toEqual(['block:abc']);
  });
});

const BLOCK_TEXTS: BlockReminderTexts = {
  body: (r) => `Počinje ${r.start}–${r.end}`,
  snoozedBody: (b) => `Odgođeno ${b.start}–${b.end}`,
};

function block(id: string, start: string, overrides: Partial<ScheduleBlock> = {}): ScheduleBlock {
  return {
    id,
    userId: 'u',
    createdAt: '2026-11-09T04:00:00.000Z',
    updatedAt: '2026-11-09T04:00:00.000Z',
    date: '2026-11-09',
    title: `Blok ${id}`,
    start,
    end: '20:00',
    taskId: null,
    kind: 'task',
    source: 'user',
    status: 'planned',
    ...overrides,
  };
}

describe('syncBlockReminders', () => {
  it('isključeni podsjetnici (Profil) → zakazani podsjetnici i odgode se otkažu, dnevne ostaju', async () => {
    const scheduler = new FakeScheduler(['morning:2026-11-09@07:00', 'snooze:a']);
    const blocks = [block('a', '09:00'), block('b', '10:00')];
    await syncBlockReminders(scheduler, reminderBlocks({ blockRemindersEnabled: true }, blocks), NOW, 10, BLOCK_TEXTS);
    expect(scheduler.scheduled.size).toBe(4);
    const result = await syncBlockReminders(
      scheduler,
      reminderBlocks({ blockRemindersEnabled: false }, blocks),
      NOW,
      10,
      BLOCK_TEXTS,
    );
    expect(result).toEqual({ cancelled: 3, scheduled: 0 });
    expect([...scheduler.scheduled.keys()]).toEqual(['morning:2026-11-09@07:00']);
  });

  it('zakaže podsjetnike s kategorijom akcija, kanalom blokova i payloadom bloka', async () => {
    const scheduler = new FakeScheduler(['morning:2026-11-09@07:00']);
    const blocks = [block('a', '09:00'), block('san', '22:00', { kind: 'sleep', end: '06:00' })];
    expect(await syncBlockReminders(scheduler, blocks, NOW, 10, BLOCK_TEXTS)).toEqual({
      cancelled: 0,
      scheduled: 1,
    });
    expect(scheduler.scheduled.get('block:a@2026-11-09T09:00')).toEqual({
      identifier: 'block:a@2026-11-09T09:00',
      fireAt: new Date(2026, 10, 9, 9, 0, 0, 0),
      channelId: BLOCKS_CHANNEL_ID,
      categoryId: 'block',
      title: 'Blok a',
      body: 'Počinje 09:00–20:00',
      data: { source: 'ritam', type: 'block', blockId: 'a' },
    });
    expect(scheduler.scheduled.has('morning:2026-11-09@07:00')).toBe(true);
  });

  it('gotov ili pomaknut blok → stari podsjetnik se otkaže; idempotentno', async () => {
    const scheduler = new FakeScheduler();
    await syncBlockReminders(scheduler, [block('a', '09:00'), block('b', '10:00')], NOW, 10, BLOCK_TEXTS);
    scheduler.calls.length = 0;
    expect(
      await syncBlockReminders(scheduler, [block('a', '09:00'), block('b', '10:00')], NOW, 10, BLOCK_TEXTS),
    ).toEqual({ cancelled: 0, scheduled: 0 });

    const result = await syncBlockReminders(
      scheduler,
      [block('a', '09:30'), block('b', '10:00', { status: 'done' })],
      NOW,
      10,
      BLOCK_TEXTS,
    );
    expect(result).toEqual({ cancelled: 2, scheduled: 1 });
    expect([...scheduler.scheduled.keys()]).toEqual(['block:a@2026-11-09T09:30']);
  });

  it('poštuje budžet', async () => {
    const scheduler = new FakeScheduler();
    const blocks = ['09:00', '10:00', '11:00'].map((start) => block(start.slice(0, 2), start));
    expect((await syncBlockReminders(scheduler, blocks, NOW, 2, BLOCK_TEXTS)).scheduled).toBe(2);
  });

  it('odgoda: zamjenjuje prethodnu; otkaže se kad blok više nije planiran', async () => {
    const scheduler = new FakeScheduler();
    const a = block('a', '09:00');
    await scheduleSnooze(scheduler, a, new Date(2026, 10, 9, 9, 15), BLOCK_TEXTS);
    await scheduleSnooze(scheduler, a, new Date(2026, 10, 9, 9, 30), BLOCK_TEXTS);
    expect(scheduler.scheduled.get('snooze:a')?.fireAt).toEqual(new Date(2026, 10, 9, 9, 30));
    expect(scheduler.scheduled.get('snooze:a')?.body).toBe('Odgođeno 09:00–20:00');
    expect(scheduler.scheduled.get('snooze:a')?.categoryId).toBe('block');

    const later = new Date(2026, 10, 9, 9, 20);
    await syncBlockReminders(scheduler, [a], later, 10, BLOCK_TEXTS);
    expect(scheduler.scheduled.has('snooze:a')).toBe(true);
    await syncBlockReminders(scheduler, [{ ...a, status: 'done' }], later, 10, BLOCK_TEXTS);
    expect(scheduler.scheduled.has('snooze:a')).toBe(false);
  });

  it('cancelBlockReminders otkaže podsjetnike i odgode, dnevne ne dira', async () => {
    const scheduler = new FakeScheduler(['block:a@2026-11-09T09:00', 'snooze:a', 'evening:2026-11-09@21:15']);
    expect(await cancelBlockReminders(scheduler)).toBe(2);
    expect([...scheduler.scheduled.keys()]).toEqual(['evening:2026-11-09@21:15']);
  });
});
