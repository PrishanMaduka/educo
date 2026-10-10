// The build split (D57): in `src/app/(public)`, only `_live` may import the API client, React
// Query, the sign-in pages or the API helpers, because the pre-launch export swaps `_live` for
// stubs. Lints real source text through the staff app's own ESLint config.
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { ESLint } from 'eslint';
import { describe, expect, it } from 'vitest';

const app = join(dirname(fileURLToPath(import.meta.url)), '..');
// Only the import rule runs, without type information: the linted files do not exist on disk, so
// the TypeScript project service could not load them.
const eslint = new ESLint({
  cwd: app,
  overrideConfig: { languageOptions: { parserOptions: { projectService: false, project: null } } },
  ruleFilter: ({ ruleId }) => ruleId === 'no-restricted-imports',
});

/** The `no-restricted-imports` messages ESLint reports for `code` saved at `file`. */
async function restricted(file: string, code: string): Promise<string[]> {
  const [result] = await eslint.lintText(code, { filePath: join(app, file) });
  const messages = result?.messages ?? [];
  // A file ESLint could not parse reports nothing else, so it would pass the "allows" cases.
  expect(messages.filter((message) => message.fatal)).toEqual([]);
  return messages
    .filter((message) => message.ruleId === 'no-restricted-imports')
    .map((message) => message.message);
}

const IMPORTS = [
  "import { createBrowserApi } from '@quad/client';\nexport const api = createBrowserApi;\n",
  "import { useQuery } from '@tanstack/react-query';\nexport const q = useQuery;\n",
  "import { apiBase } from '@/lib/api';\nexport const a = apiBase;\n",
  "import { SignInFlow } from '../../(auth)/sign-in/_components/SignInFlow';\nexport const f = SignInFlow;\n",
  "export { SignInFlow } from '@/app/(auth)/sign-in/_components/SignInFlow';\n",
];

describe('imports in the public pages (D57)', () => {
  it.each(IMPORTS)('refuses %s outside (public)/_live', async (code) => {
    const messages = await restricted('src/app/(public)/_components/X.tsx', code);
    expect(messages).toHaveLength(1);
    expect(messages[0]).toMatch(/\(public\)\/_live/);
  });

  it.each(IMPORTS)('allows %s inside (public)/_live', async (code) => {
    expect(await restricted('src/app/(public)/_live/X.tsx', code)).toEqual([]);
  });

  it('refuses a deep import into _live, which the export could not swap', async () => {
    const code =
      "import { LiveSignIn } from '../_live/LiveSignIn';\nexport const s = LiveSignIn;\n";
    const messages = await restricted('src/app/(public)/_components/X.tsx', code);
    expect(messages).toHaveLength(1);
    expect(messages[0]).toMatch(/index/);
  });

  it('allows the _live index from the public pages', async () => {
    const code = "import { LiveSignIn } from '../_live';\nexport const s = LiveSignIn;\n";
    expect(await restricted('src/app/(public)/_components/X.tsx', code)).toEqual([]);
  });

  it('leaves the portal alone', async () => {
    expect(await restricted('src/app/(app)/X.tsx', IMPORTS[0] ?? '')).toEqual([]);
  });
});
