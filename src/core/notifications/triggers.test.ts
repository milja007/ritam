import { describe, expect, it } from '@jest/globals';

import {
  DEFAULT_SCHEDULE_DAYS,
  IOS_PENDING_NOTIFICATION_LIMIT,
  MAX_SCHEDULE_DAYS,
  dailyNotificationTimes,
  isDailyTriggerId,
  planReschedule,
  triggerId,
  upcomingTriggers,
  type NotificationSettings,
} from './triggers';

/** Zadane vrijednosti iz onboardinga: 07:00, 8 h, wind-down 45 min, večernji upit 21:15. */
const DEFAULTS: NotificationSettings = {
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

/** Lokalno vrijeme uređaja (testovi ne ovise o vremenskoj zoni). */
function at(year: number, month: number, day: number, hours: number, minutes = 0): Date {
  return new Date(year, month - 1, day, hours, minutes, 0, 0);
}

/** Redoslijed id-a po trenutku okidanja (wind-down poslije ponoći pripada sljedećem danu). */
function order(id: string): number {
  const match = /:(\d{4})-(\d{2})-(\d{2})@(\d{2}):(\d{2})$/.exec(id);
  if (!match) throw new Error(id);
  const [, y, mo, d, h, mi] = match.map(Number);
  return at(y ?? 0, mo ?? 0, d ?? 0, h ?? 0, mi ?? 0).getTime();
}

function summary(settings: NotificationSettings, now: Date, days?: number): string[] {
  const triggers = upcomingTriggers(settings, now, days === undefined ? {} : { days });
  if (triggers === null) throw new Error('expected triggers');
  return triggers.map((trigger) => trigger.id);
}

describe('dailyNotificationTimes', () => {
  it('zadane vrijednosti → wind-down 22:15', () => {
    expect(dailyNotificationTimes(DEFAULTS)).toEqual({
      morning: '07:00',
      evening: '21:15',
      windDown: '22:15',
    });
  });

  it('krevet i wind-down preko ponoći', () => {
    expect(
      dailyNotificationTimes({ ...DEFAULTS, wakeTime: '08:30', sleepHours: 7.5, windDownMinutes: 60 }),
    ).toMatchObject({ windDown: '00:00' });
    expect(
      dailyNotificationTimes({ ...DEFAULTS, wakeTime: '09:00', sleepHours: 7, windDownMinutes: 30 }),
    ).toMatchObject({ windDown: '01:30' });
  });

  it('wind-down 0 min → u vrijeme kreveta', () => {
    expect(dailyNotificationTimes({ ...DEFAULTS, windDownMinutes: 0 })).toMatchObject({
      windDown: '23:00',
    });
  });

  it('neispravan ulaz → null', () => {
    expect(dailyNotificationTimes({ ...DEFAULTS, morningNotifTime: '24:00' })).toBeNull();
    expect(dailyNotificationTimes({ ...DEFAULTS, eveningNotifTime: 'x' })).toBeNull();
    expect(dailyNotificationTimes({ ...DEFAULTS, wakeTime: '7' })).toBeNull();
    expect(dailyNotificationTimes({ ...DEFAULTS, sleepHours: Number.NaN })).toBeNull();
    expect(dailyNotificationTimes({ ...DEFAULTS, windDownMinutes: -5 })).toBeNull();
    expect(dailyNotificationTimes({ ...DEFAULTS, windDownMinutes: 1.5 })).toBeNull();
  });
});

describe('upcomingTriggers', () => {
  it('rano ujutro: svi okidači za zadani broj dana, sortirani', () => {
    expect(summary(DEFAULTS, at(2026, 11, 8, 5), 3)).toEqual([
      'morning:2026-11-08@07:00',
      'evening:2026-11-08@21:15',
      'windDown:2026-11-08@22:15',
      'morning:2026-11-09@07:00',
      'evening:2026-11-09@21:15',
      'windDown:2026-11-09@22:15',
      'morning:2026-11-10@07:00',
      'evening:2026-11-10@21:15',
      'windDown:2026-11-10@22:15',
    ]);
    expect(DEFAULT_SCHEDULE_DAYS).toBe(7);
    expect(summary(DEFAULTS, at(2026, 11, 8, 5))).toHaveLength(21);
  });

  it('današnji prošli okidači se preskaču', () => {
    expect(summary(DEFAULTS, at(2026, 11, 8, 21, 30), 2)).toEqual([
      'windDown:2026-11-08@22:15',
      'morning:2026-11-09@07:00',
      'evening:2026-11-09@21:15',
      'windDown:2026-11-09@22:15',
    ]);
  });

  it('okidač točno u `now` se preskače', () => {
    expect(summary(DEFAULTS, at(2026, 11, 8, 7, 0), 1)).toEqual([
      'evening:2026-11-08@21:15',
      'windDown:2026-11-08@22:15',
    ]);
  });

  it('daje lokalni trenutak, dan i vrijeme', () => {
    const triggers = upcomingTriggers(DEFAULTS, at(2026, 11, 8, 5), { days: 1 });
    expect(triggers?.[0]).toEqual({
      id: triggerId('morning', '2026-11-08', '07:00'),
      kind: 'morning',
      date: '2026-11-08',
      time: '07:00',
      fireAt: at(2026, 11, 8, 7, 0),
    });
  });

  it('wind-down poslije ponoći ide na kalendarski dan okidanja, sortirano po vremenu', () => {
    const late: NotificationSettings = {
      ...DEFAULTS,
      wakeTime: '09:00',
      sleepHours: 7,
      morningNotifTime: '09:00',
      eveningNotifTime: '23:00',
      windDownMinutes: 30,
    };
    expect(summary(late, at(2026, 11, 8, 12), 2)).toEqual([
      'evening:2026-11-08@23:00',
      'windDown:2026-11-09@01:30',
      'morning:2026-11-09@09:00',
      'evening:2026-11-09@23:00',
    ]);
  });

  it('isto vrijeme za dvije vrste → stabilan redoslijed po vrsti', () => {
    const same = { ...DEFAULTS, eveningNotifTime: '22:15' };
    expect(summary(same, at(2026, 11, 8, 22), 1)).toEqual([
      'evening:2026-11-08@22:15',
      'windDown:2026-11-08@22:15',
    ]);
  });

  it('prijelaz mjeseca i godine', () => {
    expect(summary(DEFAULTS, at(2026, 12, 31, 23), 2)).toEqual([
      'morning:2027-01-01@07:00',
      'evening:2027-01-01@21:15',
      'windDown:2027-01-01@22:15',
    ]);
  });

  it('broj dana se ograničava na [1, MAX] i nikad ne prelazi limit iOS-a', () => {
    expect(MAX_SCHEDULE_DAYS * 3).toBeLessThanOrEqual(IOS_PENDING_NOTIFICATION_LIMIT);
    const many = upcomingTriggers(DEFAULTS, at(2026, 11, 8, 5), { days: 1000 });
    expect(many).toHaveLength(MAX_SCHEDULE_DAYS * 3);
    expect(summary(DEFAULTS, at(2026, 11, 8, 5), 0)).toHaveLength(3);
    expect(summary(DEFAULTS, at(2026, 11, 8, 5), -4)).toHaveLength(3);
    expect(summary(DEFAULTS, at(2026, 11, 8, 5), Number.NaN)).toHaveLength(21);
    expect(summary(DEFAULTS, at(2026, 11, 8, 5), 2.9)).toHaveLength(6);
  });

  it('preko prijelaza na zimsko/ljetno vrijeme okidači ostaju u istom lokalnom satu', () => {
    for (const now of [at(2026, 10, 24, 5), at(2027, 3, 27, 5)]) {
      const triggers = upcomingTriggers(DEFAULTS, now, { days: 3 }) ?? [];
      expect(triggers).toHaveLength(9);
      for (const trigger of triggers) {
        const [hours, minutes] = trigger.time.split(':').map(Number);
        expect([trigger.fireAt.getHours(), trigger.fireAt.getMinutes()]).toEqual([hours, minutes]);
      }
    }
  });

  it('vikend buđenje: jutarnja se pomiče vikendom, večernji upit i wind-down prate buđenje sljedećeg dana', () => {
    const weekend: NotificationSettings = { ...DEFAULTS, weekendWakeTime: '09:00' };
    // Petak 13. 11. → subota i nedjelja vikend, ponedjeljak radni dan.
    expect(summary(weekend, at(2026, 11, 13, 5), 4)).toEqual([
      'morning:2026-11-13@07:00',
      'evening:2026-11-13@23:15',
      'morning:2026-11-14@09:00',
      'windDown:2026-11-14@00:15',
      'evening:2026-11-14@23:15',
      'morning:2026-11-15@09:00',
      'windDown:2026-11-15@00:15',
      'evening:2026-11-15@21:15',
      'windDown:2026-11-15@22:15',
      'morning:2026-11-16@07:00',
      'evening:2026-11-16@21:15',
      'windDown:2026-11-16@22:15',
    ].sort((a, b) => order(a) - order(b)));
  });

  it('vikend raniji od radnog dana: petak i subota navečer upit ranije, nedjelja normalno', () => {
    const early: NotificationSettings = { ...DEFAULTS, weekendWakeTime: '06:00' };
    expect(
      summary({ ...early, morningNotifEnabled: false, windDownNotifEnabled: false }, at(2026, 11, 13, 5), 3),
    ).toEqual(['evening:2026-11-13@20:15', 'evening:2026-11-14@20:15', 'evening:2026-11-15@21:15']);
  });

  it('isključene vrste se ne zakazuju', () => {
    const onlyEvening: NotificationSettings = {
      ...DEFAULTS,
      morningNotifEnabled: false,
      windDownNotifEnabled: false,
    };
    expect(summary(onlyEvening, at(2026, 11, 8, 5), 2)).toEqual([
      'evening:2026-11-08@21:15',
      'evening:2026-11-09@21:15',
    ]);
    const none = { ...onlyEvening, eveningNotifEnabled: false };
    expect(summary(none, at(2026, 11, 8, 5))).toEqual([]);
  });

  it('neispravne postavke ili vrijeme → null', () => {
    expect(upcomingTriggers({ ...DEFAULTS, morningNotifTime: '25:00' }, at(2026, 11, 8, 5))).toBeNull();
    expect(upcomingTriggers(DEFAULTS, new Date(Number.NaN))).toBeNull();
  });
});

describe('planReschedule', () => {
  const desired = upcomingTriggers(DEFAULTS, at(2026, 11, 8, 5), { days: 1 }) ?? [];

  it('ništa zakazano → zakaži sve', () => {
    expect(planReschedule([], desired)).toEqual({ toCancel: [], toSchedule: desired });
  });

  it('sve već zakazano → ništa', () => {
    expect(planReschedule(desired.map((t) => t.id), desired)).toEqual({ toCancel: [], toSchedule: [] });
  });

  it('djelomično: otkaži zastarjele, zakaži nove', () => {
    const plan = planReschedule(['morning:2026-11-07@07:00', 'evening:2026-11-08@21:15'], desired);
    expect(plan.toCancel).toEqual(['morning:2026-11-07@07:00']);
    expect(plan.toSchedule.map((t) => t.id)).toEqual([
      'morning:2026-11-08@07:00',
      'windDown:2026-11-08@22:15',
    ]);
  });

  it('promjena vremena u postavkama otkazuje stari okidač', () => {
    const moved = upcomingTriggers({ ...DEFAULTS, eveningNotifTime: '20:45' }, at(2026, 11, 8, 5), {
      days: 1,
    });
    const plan = planReschedule(
      desired.map((t) => t.id),
      moved ?? [],
    );
    expect(plan.toCancel).toEqual(['evening:2026-11-08@21:15']);
    expect(plan.toSchedule.map((t) => t.id)).toEqual(['evening:2026-11-08@20:45']);
  });

  it('duplikati u zakazanima se otkazuju jednom', () => {
    const id = 'morning:2026-11-07@07:00';
    expect(planReschedule([id, id], []).toCancel).toEqual([id]);
  });

  it('tuđe obavijesti i podsjetnici blokova se ne otkazuju', () => {
    const plan = planReschedule(['block:abc', 'neki-drugi-id', ...desired.map((t) => t.id)], desired);
    expect(plan).toEqual({ toCancel: [], toSchedule: [] });
  });
});

describe('isDailyTriggerId', () => {
  it('prepoznaje id-jeve iz upcomingTriggers', () => {
    for (const trigger of desiredForIds()) expect(isDailyTriggerId(trigger.id)).toBe(true);
  });

  it('odbija sve ostalo', () => {
    for (const id of ['', 'block:abc', 'morning:2026-11-08', 'lunch:2026-11-08@12:00', 'morning:2026-11-08@07:00x']) {
      expect(isDailyTriggerId(id)).toBe(false);
    }
  });
});

function desiredForIds() {
  return upcomingTriggers(DEFAULTS, at(2026, 11, 8, 5), { days: 2 }) ?? [];
}
