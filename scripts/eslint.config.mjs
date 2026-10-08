import base from '@quad/config/eslint/base';

export default [
  ...base,
  {
    // These checks connect as the database roles themselves to inspect them, which withTenant()
    // cannot do; they read role attributes, never tenant rows.
    files: ['test/**/*.api.test.ts'],
    rules: { 'quad/no-raw-db-client': 'off' },
  },
];
