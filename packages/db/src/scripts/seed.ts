import { databaseUrls, loadRootEnv, seedDatabase, seedPasswordRefusal } from '../internal';

loadRootEnv();
if (process.env.APP_ENV === 'production') {
  console.error('Seed data is sample schools only; it never runs in production.');
  process.exit(1);
}
const passwordRefusal = seedPasswordRefusal();
if (passwordRefusal !== null) {
  console.error(passwordRefusal);
  process.exit(1);
}
await seedDatabase(databaseUrls().ownerUrl);
console.log('Seed data is in place.');
