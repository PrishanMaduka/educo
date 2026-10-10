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
  {
    // The build split (D57): the pre-launch export swaps `(public)/_live` for the stubs in
    // site-export/prelaunch, so code that needs the API on the public pages lives there and is
    // reached only through its index. test/build-export.test.ts also catches dynamic imports.
    files: ['src/app/(public)/**'],
    ignores: ['src/app/(public)/_live/**'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              regex: String.raw`^@quad/client(?:/|$)|^@tanstack/react-query(?:/|$)|^@/lib/api(?:/|$)|(?:^|/)\(auth\)(?:/|$)`,
              message:
                'The pre-launch export cannot call the API: put this in (public)/_live and import it from there (D57).',
            },
            {
              regex: String.raw`(?:^|/)_live/.`,
              message:
                'Import (public)/_live through its index, which the pre-launch export swaps for stubs (D57).',
            },
          ],
        },
      ],
    },
  },
];
