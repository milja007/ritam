// This file is required for Expo/React Native SQLite migrations - https://orm.drizzle.team/quick-sqlite/expo

import journal from './meta/_journal.json';
import m0000 from './0000_init.sql';
import m0001 from './0001_evening_refinements.sql';
import m0002 from './0002_settings_refinements.sql';
import m0003 from './0003_reports.sql';
import m0004 from './0004_score_areas.sql';
import m0005 from './0005_block_reminders.sql';
import m0006 from './0006_checkin_score_areas.sql';
import m0007 from './0007_block_notes.sql';
import m0008 from './0008_day_close.sql';
import m0009 from './0009_sync.sql';
import m0010 from './0010_color_theme.sql';
import m0011 from './0011_quests.sql';
import m0012 from './0012_goals.sql';
import m0013 from './0013_tasks.sql';

  export default {
    journal,
    migrations: {
      m0000,
m0001,
m0002,
m0003,
m0004,
m0005,
m0006,
m0007,
m0008,
m0009,
m0010,
m0011,
m0012,
m0013
    }
  }
  