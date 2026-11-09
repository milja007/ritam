import { describe, expect, it } from '@jest/globals';

import {
  baseEntitySchema,
  checkinItemSchema,
  checkinSchema,
  clockTimeSchema,
  isValidLocalDate,
  localDateSchema,
  ruleLogSchema,
  ruleSchema,
  scheduleBlockSchema,
  settingsSchema,
  timestampSchema,
  xpEventSchema,
} from './index';

const base = {
  id: 'id-1',
  userId: 'user-1',
  createdAt: '2026-11-07T19:43:00.000Z',
  updatedAt: '2026-11-07T19:43:00+01:00',
};

const valid = {
  settings: {
    ...base,
    language: 'hr',
    wakeTime: '07:00',
    weekendWakeTime: null,
    sleepHours: 7.5,
    morningNotifTime: '07:15',
    eveningNotifTime: '21:00',
    windDownMinutes: 45,
    morningNotifEnabled: true,
    eveningNotifEnabled: true,
    windDownNotifEnabled: true,
    theme: 'system',
    googleCalendarConnected: false,
  },
  block: {
    ...base,
    date: '2026-11-08',
    title: 'Teretana',
    start: '08:00',
    end: '09:30',
    taskId: null,
    kind: 'task',
    source: 'user',
    status: 'planned',
  },
  checkin: {
    ...base,
    date: '2026-11-07',
    kind: 'evening',
    sleepStart: null,
    wakeTime: null,
    mood: null,
    dayRating: 4,
    note: 'Dobar dan.',
  },
  checkinItem: {
    ...base,
    checkinId: 'checkin-1',
    kind: 'task',
    refId: 'block-1',
    ok: false,
    outcome: 'not',
    comment: 'Nisam stigao, sutra ujutro.',
    laterDate: '2026-11-10',
    movedBlockId: 'block-2',
  },
  rule: {
    ...base,
    title: 'Bez mobitela u krevetu',
    icon: null,
    activeDays: [0, 1, 2, 3, 4, 5, 6],
    activeHours: { start: '22:30', end: '06:00' },
    why: 'Bolji san.',
    weight: 2,
  },
  ruleLog: {
    ...base,
    ruleId: 'rule-1',
    date: '2026-11-07',
    kept: false,
    trigger: 'Dosada',
    checkinId: 'checkin-1',
  },
  xp: {
    ...base,
    date: '2026-11-07',
    source: 'checkin',
    sourceId: 'checkin-1',
    amount: 20,
  },
};

describe('common primitives', () => {
  it('accepts real calendar dates and rejects impossible ones', () => {
    expect(isValidLocalDate('2026-11-07')).toBe(true);
    expect(isValidLocalDate('2028-02-29')).toBe(true);
    expect(isValidLocalDate('2026-02-29')).toBe(false);
    expect(isValidLocalDate('2026-02-30')).toBe(false);
    expect(isValidLocalDate('2026-13-01')).toBe(false);
    expect(isValidLocalDate('2026-00-10')).toBe(false);
    expect(isValidLocalDate('2026-1-7')).toBe(false);
    expect(localDateSchema.safeParse('2026-11-07T10:00').success).toBe(false);
  });

  it('accepts only zero-padded HH:MM clock times', () => {
    expect(clockTimeSchema.safeParse('00:00').success).toBe(true);
    expect(clockTimeSchema.safeParse('23:59').success).toBe(true);
    for (const bad of ['24:00', '7:30', '07:60', '07:5', 'ab', '']) {
      expect(clockTimeSchema.safeParse(bad).success).toBe(false);
    }
  });

  it('requires ISO timestamps with a timezone', () => {
    expect(timestampSchema.safeParse('2026-11-07T19:43:00Z').success).toBe(true);
    expect(timestampSchema.safeParse('2026-11-07T19:43:00').success).toBe(false);
    expect(timestampSchema.safeParse('2026-11-07').success).toBe(false);
  });

  it('requires non-empty ids', () => {
    expect(baseEntitySchema.safeParse(base).success).toBe(true);
    expect(baseEntitySchema.safeParse({ ...base, id: '  ' }).success).toBe(false);
    expect(baseEntitySchema.safeParse({ ...base, userId: undefined }).success).toBe(false);
  });
});

describe('valid examples parse', () => {
  it.each([
    ['settings', settingsSchema, valid.settings],
    ['schedule block', scheduleBlockSchema, valid.block],
    ['checkin', checkinSchema, valid.checkin],
    ['checkin item', checkinItemSchema, valid.checkinItem],
    ['rule', ruleSchema, valid.rule],
    ['rule log', ruleLogSchema, valid.ruleLog],
    ['xp event', xpEventSchema, valid.xp],
  ] as const)('%s', (_name, schema, value) => {
    expect(schema.safeParse(value).success).toBe(true);
  });

  it('strips unknown keys instead of keeping them', () => {
    const parsed = xpEventSchema.parse({ ...valid.xp, extra: 1 });
    expect('extra' in parsed).toBe(false);
  });
});

describe('settings', () => {
  it.each([
    ['unsupported language', { language: 'de' }],
    ['bad wake time', { wakeTime: '7:00' }],
    ['too little sleep', { sleepHours: 3 }],
    ['sleep not in 15-min steps', { sleepHours: 7.3 }],
    ['negative wind-down', { windDownMinutes: -5 }],
    ['unknown theme', { theme: 'blue' }],
    ['missing calendar flag', { googleCalendarConnected: undefined }],
  ])('rejects %s', (_name, patch) => {
    expect(settingsSchema.safeParse({ ...valid.settings, ...patch }).success).toBe(false);
  });
});

describe('schedule blocks', () => {
  it('rejects a block that ends before or when it starts', () => {
    const result = scheduleBlockSchema.safeParse({ ...valid.block, start: '10:00', end: '10:00' });
    expect(result.success).toBe(false);
    expect(result.error?.issues[0]?.path).toEqual(['end']);
    expect(scheduleBlockSchema.safeParse({ ...valid.block, end: '07:00' }).success).toBe(false);
  });

  it('lets sleep cross midnight but not be empty', () => {
    const sleep = { ...valid.block, title: 'San', kind: 'sleep', start: '23:00', end: '07:00' };
    expect(scheduleBlockSchema.safeParse(sleep).success).toBe(true);
    expect(scheduleBlockSchema.safeParse({ ...sleep, end: '23:00' }).success).toBe(false);
  });

  it.each([
    ['empty title', { title: ' ' }],
    ['unknown kind', { kind: 'meeting' }],
    ['unknown source', { source: 'ai' }],
    ['unknown status', { status: 'cancelled' }],
    ['impossible date', { date: '2026-02-30' }],
    ['empty task id', { taskId: '' }],
  ])('rejects %s', (_name, patch) => {
    expect(scheduleBlockSchema.safeParse({ ...valid.block, ...patch }).success).toBe(false);
  });
});

describe('checkins', () => {
  it('accepts a morning sleep report', () => {
    const morning = {
      ...valid.checkin,
      kind: 'morning',
      sleepStart: '23:40',
      wakeTime: '07:05',
      mood: 3,
      dayRating: null,
      note: null,
    };
    expect(checkinSchema.safeParse(morning).success).toBe(true);
  });

  it.each([
    ['rating 0', { dayRating: 0 }],
    ['rating 6', { dayRating: 6 }],
    ['fractional mood', { mood: 2.5 }],
    ['unknown kind', { kind: 'noon' }],
    ['bad sleep time', { sleepStart: '25:00' }],
    ['too long note', { note: 'x'.repeat(2001) }],
  ])('rejects %s', (_name, patch) => {
    expect(checkinSchema.safeParse({ ...valid.checkin, ...patch }).success).toBe(false);
  });

  it('checkin items need a checkin and a known kind', () => {
    expect(checkinItemSchema.safeParse({ ...valid.checkinItem, refId: null }).success).toBe(true);
    expect(checkinItemSchema.safeParse({ ...valid.checkinItem, kind: 'open-question' }).success).toBe(true);
    expect(checkinItemSchema.safeParse({ ...valid.checkinItem, checkinId: '' }).success).toBe(false);
    expect(checkinItemSchema.safeParse({ ...valid.checkinItem, kind: 'mood' }).success).toBe(false);
    expect(checkinItemSchema.safeParse({ ...valid.checkinItem, ok: 'yes' }).success).toBe(false);
  });

  it('checkin item outcome: U redu / Djelomično / Nije, `ok` only for U redu', () => {
    const partial = { ...valid.checkinItem, outcome: 'partial' };
    expect(checkinItemSchema.safeParse(partial).success).toBe(true);
    expect(checkinItemSchema.safeParse({ ...partial, outcome: 'half' }).success).toBe(false);
    expect(checkinItemSchema.safeParse({ ...partial, ok: true }).success).toBe(false);
    const done = { ...valid.checkinItem, ok: true, outcome: 'ok', laterDate: null, movedBlockId: null };
    expect(checkinItemSchema.safeParse(done).success).toBe(true);
    expect(checkinItemSchema.safeParse({ ...done, laterDate: '2026-11-10' }).success).toBe(false);
    expect(checkinItemSchema.safeParse({ ...valid.checkinItem, laterDate: '2026-02-30' }).success).toBe(false);
  });
});

describe('rules', () => {
  it('allows all-day rules', () => {
    expect(ruleSchema.safeParse({ ...valid.rule, activeHours: null }).success).toBe(true);
  });

  it.each([
    ['weight 0', { weight: 0 }],
    ['weight 4', { weight: 4 }],
    ['no active days', { activeDays: [] }],
    ['duplicate day', { activeDays: [1, 1] }],
    ['weekday 7', { activeDays: [7] }],
    ['empty active hours', { activeHours: { start: '10:00', end: '10:00' } }],
    ['empty title', { title: '' }],
  ])('rejects %s', (_name, patch) => {
    expect(ruleSchema.safeParse({ ...valid.rule, ...patch }).success).toBe(false);
  });

  it('rule logs record a trigger only for broken rules', () => {
    expect(ruleLogSchema.safeParse({ ...valid.ruleLog, kept: true, trigger: null }).success).toBe(true);
    expect(ruleLogSchema.safeParse({ ...valid.ruleLog, trigger: null }).success).toBe(true);
    expect(ruleLogSchema.safeParse({ ...valid.ruleLog, kept: true }).success).toBe(false);
    expect(ruleLogSchema.safeParse({ ...valid.ruleLog, ruleId: '' }).success).toBe(false);
  });
});

describe('xp events', () => {
  it.each([
    ['zero amount', { amount: 0 }],
    ['penalty', { amount: -10 }],
    ['fractional amount', { amount: 1.5 }],
    ['unknown source', { source: 'login' }],
  ])('rejects %s', (_name, patch) => {
    expect(xpEventSchema.safeParse({ ...valid.xp, ...patch }).success).toBe(false);
  });

  it('allows events without a source id', () => {
    expect(xpEventSchema.safeParse({ ...valid.xp, sourceId: null }).success).toBe(true);
  });
});
