import { databaseUrls, loadRootEnv, runMigrations } from '../internal';

loadRootEnv();
await runMigrations(databaseUrls().ownerUrl);
console.log('Migrations applied.');
