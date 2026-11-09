import { describe, expect, it } from '@jest/globals';

import type { NotificationSettings } from '@/core/notifications';

import {
  cancelDailyNotifications,
  DAILY_CHANNEL_ID,
  syncDailyNotifications,
  type DailyNotificationRequest,
  type DailyNotificationTexts,
  type NotificationScheduler,
} from './sync';

const SETTINGS: NotificationSettings = {
  wakeTime: '07:00',
  sleepHours: 8,
  morningNotifTime: '07:00',
  eveningNotifTime: '21:15',
  windDownMinutes: 45,
};

const TEXTS: DailyNotificationTexts = {
  morning: { title: 'Jutro', body: 'Tvoj dan' },
  evening: { title: 'Večer', body: 'Upit' },
  windDown: { title: 'Wind-down', body: 'Polako' },
};

/** 9. 11. 2026. u 05:00 lokalno — sva tri današnja okidača su još pred nama. */
const NOW = new Date(2026, 10, 9, 5, 0, 0, 0);

class FakeScheduler implements NotificationScheduler {
  readonly scheduled = new Map<string, DailyNotificationRequest | null>();
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

  async schedule(request: DailyNotificationRequest) {
    this.calls.push(`schedule ${request.identifier}`);
    this.scheduled.set(request.identifier, request);
  }
}

describe('syncDailyNotifications', () => {
  it('prazno → zakaže 3 dana × 3 obavijesti s tekstom, kanalom i payloadom', async () => {
    const scheduler = new FakeScheduler();
    const result = await syncDailyNotifications(scheduler, SETTINGS, NOW, TEXTS);
    expect(result).toEqual({ cancelled: 0, scheduled: 9 });

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
    expect(result).toEqual({ cancelled: 3, scheduled: 3 });
    expect(scheduler.calls.slice(0, 3).every((call) => call.startsWith('cancel evening:'))).toBe(true);
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
