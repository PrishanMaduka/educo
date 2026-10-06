import { defineConfig } from 'drizzle-kit';

/** `pnpm db:generate` diffs the schema against the migrations folder; it needs no database. */
export default defineConfig({
  dialect: 'postgresql',
  schema: './src/schema/index.ts',
  out: './migrations',
  strict: true,
  verbose: true,
});
