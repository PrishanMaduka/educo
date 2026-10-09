import base from '@quad/config/eslint/base';

export default [
  ...base,
  {
    // These checks connect as the database roles themselves to inspect them, which withTenant()
    // cannot do; they read role attributes, never tenant rows.
    files: ['test/**/*.api.test.ts'],
    rules: { 'quad/no-raw-db-client': 'off' },
  },
  {
    // The e2e stack creates and drops its own run's database as the admin role (Task 18, D32), on
    // the maintenance database; it never reads tenant rows.
    files: ['e2e-stack.mjs'],
    rules: { 'quad/no-raw-db-client': 'off' },
  },
];
