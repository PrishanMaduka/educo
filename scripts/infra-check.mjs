#!/usr/bin/env node
// Checks the Terraform in infra/ without touching AWS (`pnpm infra:check`, D28):
//   node scripts/infra-check.mjs [--only <dir>]
// fmt, then init (no backend), validate and `terraform test` (mocked providers) for each root and
// module that exists, then tflint and checkov when they are on PATH. Every command runs with the
// AWS_* variables removed and the instance metadata lookup off, so nothing can reach an account.
// A missing scanner is a warning, or a failure with QUAD_REQUIRE_INFRA_TOOLS=1 (CI).
import { spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

import { onPath } from './flutter.mjs';
import { runSteps } from './verify.mjs';

/** @typedef {{ name: string, command: string[], cwd?: string }} Step */
/** @typedef {{ tflint: boolean, checkov: boolean }} Scanners */

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');

export const INFRA_ROOTS = ['infra/bootstrap', 'infra/envs/global', 'infra/envs/staging'];
export const INFRA_MODULES = [
  'infra/modules/network',
  'infra/modules/data',
  'infra/modules/edge',
  'infra/modules/dns',
  'infra/modules/app',
];

/**
 * The environment for every infra command: no AWS_* variable (so no credentials, profile or
 * region from the shell), no EC2 instance metadata lookup, and Terraform's automation mode.
 * @param {NodeJS.ProcessEnv} env
 * @returns {NodeJS.ProcessEnv}
 */
export function infraEnv(env) {
  return {
    ...Object.fromEntries(Object.entries(env).filter(([key]) => !key.startsWith('AWS_'))),
    AWS_EC2_METADATA_DISABLED: 'true',
    TF_IN_AUTOMATION: '1',
  };
}

/**
 * The check steps, in order, for `dirs` (repository-relative). `exists` is relative to the
 * repository root and decides whether a directory has `tests/` for `terraform test`.
 * @param {string[]} dirs
 * @param {Scanners} tools which scanners are on PATH
 * @param {(path: string) => boolean} [exists]
 * @returns {Step[]}
 */
export function checkSteps(dirs, tools, exists = (path) => existsSync(join(root, path))) {
  /** @type {Step[]} */
  const steps = [
    { name: 'Format', command: ['terraform', 'fmt', '-check', '-recursive', 'infra'] },
  ];
  for (const dir of dirs) {
    const tf = ['terraform', `-chdir=${dir}`];
    steps.push(
      { name: `Init ${dir}`, command: [...tf, 'init', '-backend=false', '-input=false'] },
      { name: `Validate ${dir}`, command: [...tf, 'validate'] },
    );
    if (exists(`${dir}/tests`)) steps.push({ name: `Test ${dir}`, command: [...tf, 'test'] });
  }
  if (tools.tflint) {
    // tflint walks the working directory with --recursive (it cannot be combined with --chdir),
    // so it runs from infra/ and needs the config as an absolute path.
    const config = join(root, 'infra', '.tflint.hcl');
    steps.push(
      { name: 'TFLint plugins', command: ['tflint', '--init', '--config', config], cwd: 'infra' },
      { name: 'TFLint', command: ['tflint', '--recursive', '--config', config], cwd: 'infra' },
    );
  }
  if (tools.checkov) {
    steps.push({
      name: 'Checkov',
      command: ['checkov', '-d', 'infra', '--config-file', 'infra/.checkov.yaml'],
    });
  }
  return steps;
}

/**
 * Which scanners are missing, and whether that only warns or fails (QUAD_REQUIRE_INFRA_TOOLS=1).
 * @param {Scanners} tools
 * @param {Record<string, string | undefined>} env
 * @returns {{ missing: (keyof Scanners)[], action: 'ok' | 'warn' | 'fail' }}
 */
export function scannerPolicy(tools, env) {
  /** @type {(keyof Scanners)[]} */
  const missing = [];
  if (!tools.tflint) missing.push('tflint');
  if (!tools.checkov) missing.push('checkov');
  if (missing.length === 0) return { missing, action: 'ok' };
  return { missing, action: env.QUAD_REQUIRE_INFRA_TOOLS === '1' ? 'fail' : 'warn' };
}

const isMain = process.argv[1] === fileURLToPath(import.meta.url);
if (isMain) {
  const args = process.argv.slice(2);
  const onlyIndex = args.indexOf('--only');
  const only = onlyIndex === -1 ? undefined : args[onlyIndex + 1];
  if (onlyIndex !== -1 && !only) {
    process.stderr.write('Usage: node scripts/infra-check.mjs [--only <dir>]\n');
    process.exit(2);
  }
  if (!onPath('terraform')) {
    process.stderr.write(
      'terraform is not on PATH. Run `pnpm infra:tools` and eval its `--print-env` output first.\n',
    );
    process.exit(1);
  }

  const tools = { tflint: onPath('tflint'), checkov: onPath('checkov') };
  const policy = scannerPolicy(tools, process.env);
  if (policy.action !== 'ok') {
    const which = `${policy.missing.join(' and ')} ${policy.missing.length > 1 ? 'are' : 'is'}`;
    if (policy.action === 'fail') {
      process.stderr.write(`${which} not on PATH, and QUAD_REQUIRE_INFRA_TOOLS=1 needs both.\n`);
      process.exit(1);
    }
    process.stdout.write(`\n*** infra-check: ${which} not on PATH, so it is SKIPPED. ***\n`);
  }

  // Roots and modules that do not exist yet are skipped, so the check passes as infra/ grows.
  const dirs = (only ? [only] : [...INFRA_MODULES, ...INFRA_ROOTS]).filter((dir) =>
    existsSync(join(root, dir)),
  );
  const env = infraEnv(process.env);
  const result = runSteps(
    checkSteps(dirs, tools),
    ([cmd = '', ...rest], step) =>
      spawnSync(cmd, rest, { cwd: join(root, step.cwd ?? '.'), env, stdio: 'inherit' }).status,
    (line) => {
      process.stdout.write(`\n=== ${line}\n\n`);
    },
    'infra-check',
  );
  process.exit(result.ok ? 0 : 1);
}
