module.exports = function (api) {
  api.cache(true);
  return {
    presets: ['babel-preset-expo'],
    // Drizzle migracije (`src/db/migrations/*.sql`) se ugrađuju u bundle kao stringovi.
    plugins: [['inline-import', { extensions: ['.sql'] }]],
  };
};
