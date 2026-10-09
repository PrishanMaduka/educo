import next from '@quad/config/eslint/next';

export default [
  ...next,
  { ignores: ['next-env.d.ts', 'site-export/next-env.d.ts', 'site-export/out/**'] },
  {
    // The landing's Sign in is a plain link to /app on purpose: a full page load, so the portal's
    // server layout reads the session (D30). The rule reads /app as the `/app/[...page]` catch-all
    // (Task 20), which never matches /app itself, so it is off for the public pages only.
    files: ['src/app/(public)/**'],
    rules: { '@next/next/no-html-link-for-pages': 'off' },
  },
];
