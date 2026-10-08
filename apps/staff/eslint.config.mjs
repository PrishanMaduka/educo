import next from '@quad/config/eslint/next';

export default [
  ...next,
  { ignores: ['next-env.d.ts', 'site-export/next-env.d.ts', 'site-export/out/**'] },
];
