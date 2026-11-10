/**
 * Drizzle shema lokalne SQLite baze. Stupci 1:1 s Zod shemama u `src/core/domain`
 * (camelCase u kodu, snake_case u bazi). Vremena su ISO tekst, datumi "YYYY-MM-DD", sati "HH:MM".
 * Nakon promjene: `npm run db:generate` (nova migracija u `src/db/migrations`).
 */
import { index, integer, real, sqliteTable, text, uniqueIndex } from 'drizzle-orm/sqlite-core';

import type {
  ActiveHours,
  BlockKind,
  BlockSource,
  BlockStatus,
  CheckinItemKind,
  CheckinKind,
  CheckinOutcome,
  ReportPeriod,
  ThemePreference,
  XpSource,
} from '@/core/domain';
import type { LanguagePreference } from '@/core/i18n/language';

const baseColumns = () => ({
  id: text('id').primaryKey().notNull(),
  userId: text('user_id').notNull(),
  createdAt: text('created_at').notNull(),
  updatedAt: text('updated_at').notNull(),
});

export const settings = sqliteTable(
  'settings',
  {
    ...baseColumns(),
    language: text('language').$type<LanguagePreference>().notNull(),
    wakeTime: text('wake_time').notNull(),
    weekendWakeTime: text('weekend_wake_time'),
    sleepHours: real('sleep_hours').notNull(),
    morningNotifTime: text('morning_notif_time').notNull(),
    eveningNotifTime: text('evening_notif_time').notNull(),
    windDownMinutes: integer('wind_down_minutes').notNull(),
    morningNotifEnabled: integer('morning_notif_enabled', { mode: 'boolean' }).notNull().default(true),
    eveningNotifEnabled: integer('evening_notif_enabled', { mode: 'boolean' }).notNull().default(true),
    windDownNotifEnabled: integer('wind_down_notif_enabled', { mode: 'boolean' }).notNull().default(true),
    blockRemindersEnabled: integer('block_reminders_enabled', { mode: 'boolean' }).notNull().default(true),
    theme: text('theme').$type<ThemePreference>().notNull(),
    googleCalendarConnected: integer('google_calendar_connected', { mode: 'boolean' }).notNull(),
    // Područja dnevnog rezultata (korak 16c); zadano samo plan.
    scorePlan: integer('score_plan', { mode: 'boolean' }).notNull().default(true),
    scoreRules: integer('score_rules', { mode: 'boolean' }).notNull().default(false),
    scoreSleep: integer('score_sleep', { mode: 'boolean' }).notNull().default(false),
  },
  (table) => [uniqueIndex('settings_user_id_unique').on(table.userId)],
);

export const scheduleBlocks = sqliteTable(
  'schedule_blocks',
  {
    ...baseColumns(),
    date: text('date').notNull(),
    title: text('title').notNull(),
    start: text('start').notNull(),
    end: text('end').notNull(),
    taskId: text('task_id'),
    kind: text('kind').$type<BlockKind>().notNull(),
    source: text('source').$type<BlockSource>().notNull(),
    status: text('status').$type<BlockStatus>().notNull(),
  },
  (table) => [index('schedule_blocks_user_date_idx').on(table.userId, table.date)],
);

export const checkins = sqliteTable(
  'checkins',
  {
    ...baseColumns(),
    date: text('date').notNull(),
    kind: text('kind').$type<CheckinKind>().notNull(),
    sleepStart: text('sleep_start'),
    wakeTime: text('wake_time'),
    mood: integer('mood'),
    dayRating: integer('day_rating'),
    note: text('note'),
  },
  // Jedan jutarnji i jedan večernji checkin po danu.
  (table) => [uniqueIndex('checkins_user_date_kind_unique').on(table.userId, table.date, table.kind)],
);

export const checkinItems = sqliteTable(
  'checkin_items',
  {
    ...baseColumns(),
    checkinId: text('checkin_id')
      .notNull()
      .references(() => checkins.id, { onDelete: 'cascade' }),
    kind: text('kind').$type<CheckinItemKind>().notNull(),
    refId: text('ref_id'),
    ok: integer('ok', { mode: 'boolean' }).notNull(),
    outcome: text('outcome').$type<CheckinOutcome>().notNull().default('ok'),
    comment: text('comment'),
    laterDate: text('later_date'),
    movedBlockId: text('moved_block_id'),
  },
  (table) => [index('checkin_items_checkin_idx').on(table.checkinId)],
);

export const rules = sqliteTable(
  'rules',
  {
    ...baseColumns(),
    title: text('title').notNull(),
    icon: text('icon'),
    /** JSON niz dana u tjednu, npr. `[1,2,3]`. */
    activeDays: text('active_days', { mode: 'json' }).$type<number[]>().notNull(),
    /** JSON `{ start, end }` ili NULL = cijeli dan. */
    activeHours: text('active_hours', { mode: 'json' }).$type<ActiveHours>(),
    why: text('why').notNull(),
    weight: integer('weight').notNull(),
  },
  (table) => [index('rules_user_idx').on(table.userId)],
);

export const ruleLogs = sqliteTable(
  'rule_logs',
  {
    ...baseColumns(),
    ruleId: text('rule_id')
      .notNull()
      .references(() => rules.id, { onDelete: 'cascade' }),
    date: text('date').notNull(),
    kept: integer('kept', { mode: 'boolean' }).notNull(),
    trigger: text('trigger'),
    checkinId: text('checkin_id').references(() => checkins.id, { onDelete: 'set null' }),
  },
  // Jedan zapis po zabrani po danu.
  (table) => [uniqueIndex('rule_logs_rule_date_unique').on(table.ruleId, table.date)],
);

export const xpEvents = sqliteTable(
  'xp_events',
  {
    ...baseColumns(),
    date: text('date').notNull(),
    source: text('source').$type<XpSource>().notNull(),
    sourceId: text('source_id'),
    amount: integer('amount').notNull(),
  },
  (table) => [index('xp_events_user_date_idx').on(table.userId, table.date)],
);

export const reports = sqliteTable(
  'reports',
  {
    ...baseColumns(),
    period: text('period').$type<ReportPeriod>().notNull(),
    periodStart: text('period_start').notNull(),
    /** JSON po dijelovima dijagnoze (Ukratko, Napredak, Pohvale…). */
    sections: text('sections', { mode: 'json' }).$type<unknown>().notNull(),
    /** JSON statistike razdoblja iz koje je dijagnoza nastala. */
    stats: text('stats', { mode: 'json' }).$type<unknown>().notNull(),
    promptVersion: text('prompt_version').notNull(),
    suggestion: text('suggestion'),
    suggestionAccepted: integer('suggestion_accepted', { mode: 'boolean' }),
    helpful: integer('helpful', { mode: 'boolean' }),
    feedbackComment: text('feedback_comment'),
  },
  // Jedna dijagnoza po razdoblju.
  (table) => [uniqueIndex('reports_user_period_start_unique').on(table.userId, table.period, table.periodStart)],
);
