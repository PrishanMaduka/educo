import pg from 'pg';

import {
  databaseUrls,
  loadRootEnv,
  runMigrations,
  seedDatabase,
  seedPasswordRefusal,
  seedSecrets,
} from '../internal';

const LOCAL_HOSTS = new Set(['localhost', '127.0.0.1', '[::1]']);

loadRootEnv();

function refuse(reason: string): never {
  console.error(`db:reset deletes every row, so it refuses to run: ${reason}`);
  process.exit(1);
}

if (process.env.APP_ENV !== 'local') {
  refuse(`APP_ENV must be local (it is ${process.env.APP_ENV ?? 'unset'}; see .env.example).`);
}
const { ownerUrl } = databaseUrls();
const host = new URL(ownerUrl).hostname;
if (!LOCAL_HOSTS.has(host)) {
  refuse(`the database must be on this machine (host is ${host}).`);
}

const passwordRefusal = seedPasswordRefusal();
if (passwordRefusal !== null) {
  refuse(passwordRefusal);
}

const client = new pg.Client({ connectionString: ownerUrl, application_name: 'quad-reset' });
await client.connect();
try {
  // quad_owner owns schema public, so it may drop it with everything inside. The first
  // migration recreates the extensions, schema grants and default privileges.
  await client.query(`
    drop schema if exists drizzle cascade;
    drop schema if exists public cascade;
    create schema public;
  `);
} finally {
  await client.end();
}
await runMigrations(ownerUrl);
await seedDatabase(ownerUrl, seedSecrets());
console.log('Database reset: schema recreated, migrations applied and seed data loaded.');
