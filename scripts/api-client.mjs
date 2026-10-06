#!/usr/bin/env node
// Regenerates every API client from the NestJS OpenAPI document:
//   packages/contracts/openapi.json, packages/client/src/generated/schema.d.ts, apps/parent/packages/quad_api.
import { execFileSync } from 'node:child_process';
import { rmSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const spec = resolve(root, 'packages/contracts/openapi.json');
const run = (cmd, args, cwd = root) => execFileSync(cmd, args, { cwd, stdio: 'inherit' });

run('pnpm', ['--filter', '@quad/api', 'openapi:export', spec]);
run('pnpm', [
  'exec',
  'openapi-typescript',
  spec,
  '-o',
  resolve(root, 'packages/client/src/generated/schema.d.ts'),
]);
// Start clean so removed endpoints do not leave stale files behind.
rmSync(resolve(root, 'apps/parent/packages/quad_api'), { recursive: true, force: true });
run('pnpm', ['exec', 'openapi-generator-cli', 'generate']);
run('pnpm', [
  'exec',
  'prettier',
  '--write',
  resolve(root, 'packages/client/src/generated/schema.d.ts'),
]);
