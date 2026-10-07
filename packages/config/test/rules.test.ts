import { fileURLToPath } from 'node:url';

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
const repo = (rel: string) => fileURLToPath(new URL(`../../../${rel}`, import.meta.url));
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
    { code: "const m = await import('pg');", filename: repo('apps/api/src/x.ts'), errors: raw },
    { code: "import pg = require('pg');", filename: repo('apps/api/src/x.ts'), errors: raw },
    {
      code: "export * from '@quad/db/internal';",
      filename: repo('apps/api/src/x.ts'),
      errors: raw,
    },
    { code: "const m = require('pg-pool');", filename: repo('apps/api/src/x.ts'), errors: raw },
    {
      code: "import { Pool } from 'pg';",
      filename: repo('apps/api/src/platformer/x.ts'),
      errors: raw,
    },
    {
      code: "import { Pool } from 'pg';",
      filename: repo('apps/dbx/packages/db/x.ts'),
      errors: raw,
    },
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
      code: "import * as db from '@quad/db'; db.withTenant();",
      filename: repo('apps/api/src/modules/students/s.ts'),
    },
    {
      code: "const { withTenant } = await import('@quad/db');",
      filename: repo('apps/api/src/modules/students/s.ts'),
    },
    {
      code: "const { withTenant } = require('@quad/db');",
      filename: repo('apps/api/src/modules/students/s.ts'),
    },
    {
      code: "import { createPlatformDb } from '@quad/db';",
      filename: repo('apps/api/src/platform/x.ts'),
    },
    { code: "export * from '@quad/db';", filename: repo('apps/api/src/platform/x.ts') },
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
    {
      code: "import { createPlatformDb } from '@quad/db';",
      filename: repo('apps/api/src/modules/students/s.ts'),
      errors: platform,
    },
    {
      code: "import { withPlatform } from '../platform/x';",
      filename: repo('apps/api/src/modules/students/s.ts'),
      errors: platform,
    },
    {
      code: "import { createPlatformDb as c } from './x';",
      filename: repo('apps/api/src/modules/students/s.ts'),
      errors: platform,
    },
    {
      code: "export * from '@quad/db';",
      filename: repo('apps/api/src/modules/students/s.ts'),
      errors: platform,
    },
    {
      code: "export { withPlatform } from './x';",
      filename: repo('apps/api/src/modules/students/s.ts'),
      errors: platform,
    },
    {
      code: "const { withPlatform } = await import('@quad/db');",
      filename: repo('apps/api/src/modules/students/s.ts'),
      errors: platform,
    },
    {
      code: "const { withPlatform: wp } = require('@quad/db');",
      filename: repo('apps/api/src/modules/students/s.ts'),
      errors: platform,
    },
    {
      code: "const { createPlatformDb } = require('./x');",
      filename: repo('apps/api/src/modules/students/s.ts'),
      errors: platform,
    },
    {
      code: "const m = await import('@quad/db'); m.withPlatform(f);",
      filename: repo('apps/api/src/modules/students/s.ts'),
      errors: platform,
    },
    {
      code: "const m = require('./x'); m.createPlatformDb({});",
      filename: repo('apps/api/src/modules/students/s.ts'),
      errors: platform,
    },
    {
      code: "import('@quad/db').then((m) => m.withPlatform);",
      filename: repo('apps/api/src/modules/students/s.ts'),
      errors: platform,
    },
    {
      code: "const { ...all } = require('@quad/db');",
      filename: repo('apps/api/src/modules/students/s.ts'),
      errors: platform,
    },
    {
      code: "import * as x from './x'; x.withPlatform();",
      filename: repo('apps/api/src/modules/students/s.ts'),
      errors: platform,
    },
  ],
});

const jsxTester = new RuleTester({
  languageOptions: {
    ecmaVersion: 2022,
    sourceType: 'module',
    parser: tseslint.parser,
    parserOptions: { ecmaFeatures: { jsx: true } },
  },
});
const colourRule = quad.rules['no-arbitrary-colour'];
const classColour = [{ messageId: 'classColour' as const }];
const styleColour = [{ messageId: 'styleColour' as const }];

jsxTester.run('quad/no-arbitrary-colour', colourRule, {
  valid: [
    "const c = 'bg-brand text-ink-2 border-line';",
    "const c = 'bg-[var(--quad-brand)] text-[var(--quad-ink)]';",
    "const c = 'w-[390px] grid-cols-[1fr_2fr] shadow-[0_1px_2px_var(--quad-shadow)]';",
    "const c = 'bg-[url(/hero.png)] text-[13px]';",
    "const c = 'stroked-[#fff]';",
    "const c = `p-4 ${active ? 'bg-brand' : 'bg-surface'}`;",
    '<div className="bg-[var(--quad-x)]" />;',
    "<div style={{ color: 'var(--quad-ink)' }} />;",
    "<div style={{ backgroundColor: 'transparent', borderColor: 'currentColor' }} />;",
    "<div style={{ background: 'linear-gradient(var(--quad-a), var(--quad-b))' }} />;",
    "<div style={{ width: '#fff', '--quad-x': '#fff' }} />;",
    '<div style={{ color: tone }} />;',
    "<div style={{ ['color']: 'var(--quad-ink)' }} />;",
    "<div data-style={{ color: '#fff' }} />;",
    "const c = 'text-[color:var(--quad-ink)] accent-[color:_var(--quad-x)]';",
    "const c = 'bg-[url(#abc)] shadow-[0_1px_2px_color-mix(in_srgb,var(--quad-a),transparent)]';",
    "<div style={{ fill: 'url(#abc)', background: 'url(#fade) no-repeat' }} />;",
    "<div style={{ borderRadius: '4px', borderStyle: 'solid', textShadow: 'none' }} />;",
    "<div style={{ boxShadow: '0 1px 2px var(--quad-shadow)', outline: '2px solid var(--quad-ring)' }} />;",
    "<div style={{ color: active ? 'var(--quad-ink)' : 'currentColor' }} />;",
    '<div style={{ background: `linear-gradient(${from}, var(--quad-b))` }} />;',
  ],
  invalid: [
    { code: "const c = 'bg-[#fff]';", errors: classColour },
    { code: "const c = 'p-2 text-[#DD4A42]';", errors: classColour },
    { code: "const c = 'dark:bg-[#000]';", errors: classColour },
    { code: "const c = 'hover:dark:border-[rgb(0,0,0)]';", errors: classColour },
    { code: "const c = 'ring-[rgba(0,0,0,0.1)]';", errors: classColour },
    { code: "const c = 'fill-[hsl(0_0%_0%)] stroke-[hsla(0,0%,0%,1)]';", errors: classColour },
    { code: "const c = 'from-[oklch(0.7_0.1_20)] via-[oklab(0.5_0_0)] to-[lab(50%_0_0)]';", errors: classColour },
    { code: "const c = 'outline-[lch(50%_0_0)]';", errors: classColour },
    { code: "const c = 'decoration-[color(display-p3_1_0_0)]';", errors: classColour },
    { code: "const c = 'accent-[color:#fff]';", errors: classColour },
    // A colour anywhere inside the brackets, not only first.
    { code: "const c = 'shadow-[0_1px_2px_rgba(0,0,0,.2)]';", errors: classColour },
    { code: "const c = 'shadow-[0_1px_2px_#000]';", errors: classColour },
    { code: "const c = 'bg-[linear-gradient(#fff,#000)]';", errors: classColour },
    { code: "const c = 'border-[1px_solid_#fff]';", errors: classColour },
    { code: "const c = 'text-[red]';", errors: classColour },
    // Tailwind v4 shadow and ring utilities.
    ...['drop-shadow', 'inset-shadow', 'inset-ring', 'text-shadow'].map((prefix) => ({
      code: `const c = 'dark:${prefix}-[#000]';`,
      errors: classColour,
    })),
    ...[
      'bg', 'text', 'border', 'ring', 'fill', 'stroke', 'from', 'via', 'to', 'outline',
      'decoration', 'accent', 'caret', 'shadow', 'divide', 'placeholder',
    ].map((prefix) => ({ code: `const c = '${prefix}-[#123456]';`, errors: classColour })),
    { code: "const c = 'border-t-[#fff]';", errors: classColour },
    { code: "const c = '!bg-[#fff]';", errors: classColour },
    { code: 'const c = `p-4 bg-[#fff] ${x}`;', errors: classColour },
    { code: '<div className="md:hover:text-[#abc]" />;', errors: classColour },
    { code: "<div style={{ color: '#fff' }} />;", errors: styleColour },
    { code: "<div style={{ background: 'red' }} />;", errors: styleColour },
    { code: "<div style={{ backgroundColor: 'rgb(0 0 0)' }} />;", errors: styleColour },
    { code: "<div style={{ 'borderColor': 'hsl(0 0% 0%)' }} />;", errors: styleColour },
    { code: '<div style={{ fill: `#fff` }} />;', errors: styleColour },
    { code: "<div style={{ stroke: 'var(--quad-x, #fff)', outlineColor: 'blue' }} />;", errors: [...styleColour, ...styleColour] },
    // Any *Color key, and background*, border*, outline*, boxShadow and textShadow.
    { code: "<div style={{ borderTopColor: '#fff' }} />;", errors: styleColour },
    { code: "<div style={{ caretColor: 'red' }} />;", errors: styleColour },
    { code: "<div style={{ backgroundImage: 'linear-gradient(#fff, #000)' }} />;", errors: styleColour },
    { code: "<div style={{ border: '1px solid red' }} />;", errors: styleColour },
    { code: "<div style={{ outline: '2px solid #fff' }} />;", errors: styleColour },
    { code: "<div style={{ boxShadow: '0 1px 2px #000' }} />;", errors: styleColour },
    { code: "<div style={{ textShadow: '0 1px rgba(0,0,0,.2)' }} />;", errors: styleColour },
    // Both branches of a conditional or logical expression, and template literal quasis.
    { code: "<div style={{ color: active ? '#fff' : 'var(--quad-ink)' }} />;", errors: styleColour },
    { code: "<div style={{ color: active ? 'var(--quad-ink)' : 'black' }} />;", errors: styleColour },
    { code: "<div style={{ color: tone ?? '#000' }} />;", errors: styleColour },
    { code: "<div style={{ color: tone || 'red' }} />;", errors: styleColour },
    { code: '<div style={{ color: `rgb(${r} 0 0)` }} />;', errors: styleColour },
    { code: '<div style={{ background: `linear-gradient(${a}, #fff)` }} />;', errors: styleColour },
  ],
});
