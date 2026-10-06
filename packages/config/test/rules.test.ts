import { RuleTester } from 'eslint';
import tseslint from 'typescript-eslint';
import { describe, it } from 'vitest';

import { quad } from '../eslint/plugin.mjs';

RuleTester.describe = describe;
RuleTester.it = it;
RuleTester.itOnly = it.only;

const tester = new RuleTester({
  languageOptions: { ecmaVersion: 2022, sourceType: 'module', parser: tseslint.parser },
});

// RuleTester resolves filenames against cwd; the repo root is found by walking up to pnpm-workspace.yaml.
const repo = (rel: string) => new URL(`../../../${rel}`, import.meta.url).pathname;
const rawRule = quad.rules['no-raw-db-client'];
const platformRule = quad.rules['no-with-platform-outside-platform'];

const raw = [{ messageId: 'raw' as const }];
const platform = [{ messageId: 'platform' as const }];

tester.run('quad/no-raw-db-client', rawRule, {
  valid: [
    { code: "import { Pool } from 'pg';", filename: repo('packages/db/src/client.ts') },
    {
      code: "import { x } from '@quad/db/internal';",
      filename: repo('packages/db/test/a.test.ts'),
    },
    { code: "import { withTenant } from '@quad/db';", filename: repo('apps/api/src/x.ts') },
    { code: "import type { Pool } from 'pg';", filename: repo('apps/api/src/x.ts') },
    { code: "import { type Pool } from 'pg';", filename: repo('apps/api/src/x.ts') },
    { code: "import { Pool } from 'pg-extra';", filename: repo('apps/api/src/x.ts') },
  ],
  invalid: [
    { code: "import { Pool } from 'pg';", filename: repo('apps/api/src/x.ts'), errors: raw },
    { code: "import pg from 'pg-pool';", filename: repo('apps/api/src/x.ts'), errors: raw },
    { code: "import postgres from 'postgres';", filename: repo('apps/api/src/x.ts'), errors: raw },
    {
      code: "import { drizzle } from 'drizzle-orm/node-postgres';",
      filename: repo('packages/domain/src/x.ts'),
      errors: raw,
    },
    {
      code: "import { drizzle } from 'drizzle-orm/postgres-js';",
      filename: repo('apps/api/src/x.ts'),
      errors: raw,
    },
    {
      code: "import { raw } from '@quad/db/internal';",
      filename: repo('apps/api/src/x.ts'),
      errors: raw,
    },
    {
      code: "import { raw } from '@quad/db/src/client';",
      filename: repo('apps/api/src/x.ts'),
      errors: raw,
    },
    { code: "export * from 'pg';", filename: repo('apps/api/src/x.ts'), errors: raw },
    { code: "export { Pool } from 'pg';", filename: repo('apps/api/src/x.ts'), errors: raw },
    { code: "const m = import('pg');", filename: repo('apps/api/src/x.ts'), errors: raw },
    { code: "const m = require('pg');", filename: repo('apps/api/src/x.ts'), errors: raw },
    { code: "import 'pg';", filename: repo('apps/api/src/x.ts'), errors: raw },
  ],
});

tester.run('quad/no-with-platform-outside-platform', platformRule, {
  valid: [
    {
      code: "import { withPlatform } from '@quad/db';",
      filename: repo('apps/api/src/platform/tenants/t.ts'),
    },
    {
      code: "import { withPlatform } from '@quad/db';",
      filename: repo('apps/api/src/worker/platform-jobs/health.ts'),
    },
    {
      code: "import { withPlatform } from '@quad/db';",
      filename: repo('packages/db/test/rls.test.ts'),
    },
    {
      code: "import { withTenant } from '@quad/db';",
      filename: repo('apps/api/src/modules/students/s.ts'),
    },
    {
      code: "import type { withPlatform } from '@quad/db';",
      filename: repo('apps/api/src/modules/students/s.ts'),
    },
    {
      code: "import { withPlatform } from './local';",
      filename: repo('apps/api/src/modules/students/s.ts'),
    },
    {
      code: "import * as db from '@quad/db'; db.withTenant();",
      filename: repo('apps/api/src/modules/students/s.ts'),
    },
  ],
  invalid: [
    {
      code: "import { withPlatform } from '@quad/db';",
      filename: repo('apps/api/src/modules/students/s.ts'),
      errors: platform,
    },
    {
      code: "import { withPlatform as wp } from '@quad/db';",
      filename: repo('apps/api/src/modules/students/s.ts'),
      errors: platform,
    },
    {
      code: "import * as db from '@quad/db'; db.withPlatform(1);",
      filename: repo('apps/api/src/modules/students/s.ts'),
      errors: platform,
    },
    {
      code: "import * as db from '@quad/db'; db['withPlatform'](1);",
      filename: repo('apps/api/src/modules/students/s.ts'),
      errors: platform,
    },
    {
      code: "export { withPlatform } from '@quad/db';",
      filename: repo('apps/api/src/modules/students/s.ts'),
      errors: platform,
    },
    {
      code: "import { withPlatform } from '@quad/db';",
      filename: repo('apps/api/src/platformish/s.ts'),
      errors: platform,
    },
  ],
});
