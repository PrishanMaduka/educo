#!/usr/bin/env node
// Regenerates every API client from the NestJS OpenAPI document:
//   packages/contracts/openapi.json, packages/client/src/generated/schema.d.ts, apps/parent/packages/quad_api.
// The Dart client is generated from the parent app's slice only (parent-openapi.mjs: no console,
// webhook or meta routes), written to node_modules/.cache/quad-api/parent.openapi.json.
// The Dart client needs build_runner for its json_serializable parts, so this needs Flutter (fvm or PATH).
import { execFileSync } from 'node:child_process';
import { mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

import { resolveTool, runTool } from './flutter.mjs';
import { parentSpec } from './parent-openapi.mjs';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const spec = resolve(root, 'packages/contracts/openapi.json');
/** Where openapitools.json reads the parent app's slice from (keep the two in step). */
const parentSpecFile = resolve(root, 'node_modules/.cache/quad-api/parent.openapi.json');
/** @type {(cmd: string, args: string[], cwd?: string) => unknown} */
const run = (cmd, args, cwd = root) => execFileSync(cmd, args, { cwd, stdio: 'inherit' });

// Check the toolchain before anything is regenerated or deleted.
if (!resolveTool('dart')) {
  process.stderr.write(
    'Install Flutter (version in .fvmrc) to run pnpm api:client — it also generates the Dart client.\n',
  );
  process.exit(1);
}

run('pnpm', ['--filter', '@quad/api', 'openapi:export', spec]);
run('pnpm', [
  'exec',
  'openapi-typescript',
  spec,
  '-o',
  resolve(root, 'packages/client/src/generated/schema.d.ts'),
]);
mkdirSync(dirname(parentSpecFile), { recursive: true });
writeFileSync(
  parentSpecFile,
  `${JSON.stringify(parentSpec(JSON.parse(readFileSync(spec, 'utf8'))), null, 2)}\n`,
);
// Start clean so removed endpoints do not leave stale files behind.
const dartClient = resolve(root, 'apps/parent/packages/quad_api');
rmSync(dartClient, { recursive: true, force: true });
run('pnpm', ['exec', 'openapi-generator-cli', 'generate']);
// Commit the *.g.dart parts with the client so it compiles straight from git.
runTool('dart', ['pub', 'get'], dartClient);
runTool('dart', ['run', 'build_runner', 'build'], dartClient);
