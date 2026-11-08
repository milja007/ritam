const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);

// Drizzle migracije su `.sql` datoteke koje se uvoze iz `src/db/migrations/migrations.js`.
config.resolver.sourceExts.push('sql');

module.exports = config;
