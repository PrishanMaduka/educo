import {
  databaseUrls,
  loadRootEnv,
  localSeedRefusal,
  seedDatabase,
  seedPasswordRefusal,
  seedSecrets,
} from '../internal';

loadRootEnv();
const { ownerUrl } = databaseUrls();
// `pnpm db:seed` is a local tool: staging is seeded only by the api image's `seed` task (D28).
const refusal = localSeedRefusal(process.env, ownerUrl) ?? seedPasswordRefusal();
if (refusal !== null) {
  console.error(`Seed data is for local use; the seed refuses to run: ${refusal}`);
  process.exit(1);
}
await seedDatabase(ownerUrl, seedSecrets(), 'local');
console.log('Seed data is in place.');
