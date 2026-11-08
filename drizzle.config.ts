import { defineConfig } from 'drizzle-kit';

// Generiranje migracija za lokalnu bazu: `npm run db:generate`.
export default defineConfig({
  dialect: 'sqlite',
  driver: 'expo',
  schema: './src/db/schema.ts',
  out: './src/db/migrations',
});
