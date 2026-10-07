#!/usr/bin/env node
// Checks the Terraform in infra/ without touching AWS (`pnpm infra:check`, D28):
//   node scripts/infra-check.mjs [--only <dir>]
// fmt, then init (no backend), validate and `terraform test` (mocked providers) for each root and
// module that exists, then tflint and checkov when they are on PATH. Every command runs with the
// AWS_* variables removed and the instance metadata lookup off, so nothing can reach an account.
// A missing scanner is a warning, or a failure with QUAD_REQUIRE_INFRA_TOOLS=1 (CI).
import { spawnSync } from 'node:child_process';
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
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
 * The directories to check: every module, then every root, or just `only` (`--only`), which must be
 * one of them so a typo cannot pass as "nothing to check".
 * @param {string | undefined} only
 * @returns {string[]}
 */
export function selectDirs(only) {
  const all = [...INFRA_MODULES, ...INFRA_ROOTS];
  if (only === undefined) return all;
  const dir = only.replace(/\/+$/, '');
  if (!all.includes(dir)) {
    throw new Error(
      `--only ${JSON.stringify(only)} is not an infra root or module (${all.join(', ')}).`,
    );
  }
  return [dir];
}

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
 * Whether a module declares `configuration_aliases` (edge's aws.us_east_1 and aws.dns, for
 * example). `terraform validate` cannot check such a module on its own, because nothing configures
 * the aliases; `terraform test` validates it with the test file's mocked aliases instead. Only an
 * argument outside comments counts.
 * @param {string} dir repository-relative, or absolute
 * @returns {boolean}
 */
export function declaresProviderAliases(dir) {
  const path = resolve(root, dir);
  if (!existsSync(path)) return false;
  return readdirSync(path)
    .filter((file) => file.endsWith('.tf'))
    .some((file) => {
      const code = readFileSync(join(path, file), 'utf8')
        .replace(/\/\*[\s\S]*?\*\//g, '')
        .replace(/(#|\/\/).*$/gm, '');
      return /configuration_aliases\s*=/.test(code);
    });
}

/** Where a Terraform resource must never set a plain `secret_string` (Task 8 review, D28). */
export const PLAIN_SECRET_SCAN_DIRS = ['infra/modules', 'infra/envs'];

/**
 * Every `.tf` file under `dir`, skipping `.terraform` caches.
 * @param {string} dir
 * @returns {string[]}
 */
function terraformFiles(dir) {
  if (!existsSync(dir) || !statSync(dir).isDirectory()) return [];
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    if (entry.name === '.terraform') return [];
    const path = join(dir, entry.name);
    if (entry.isDirectory()) return terraformFiles(path);
    return entry.name.endsWith('.tf') ? [path] : [];
  });
}

/**
 * Every `file:line` under `dirs` (relative to `base`) that sets `secret_string`, which would put
 * the value in Terraform state; secrets are written through `secret_string_wo`. Comments are
 * ignored, and so are comparisons (`==`).
 * @param {string[]} dirs
 * @param {string} [base]
 * @returns {string[]}
 */
export function findPlainSecretStrings(dirs, base = root) {
  return dirs.flatMap((dir) =>
    terraformFiles(join(base, dir)).flatMap((file) => {
      const code = readFileSync(file, 'utf8')
        .replace(/\/\*[\s\S]*?\*\//g, (comment) => comment.replace(/[^\n]/g, ' '))
        .replace(/(#|\/\/).*$/gm, '');
      const relativePath = file.slice(base.length + 1);
      return code
        .split('\n')
        .flatMap((line, index) =>
          /\bsecret_string\s*=(?!=)/.test(line) ? [`${relativePath}:${index + 1}`] : [],
        );
    }),
  );
}

/**
 * The check steps, in order, for `dirs` (repository-relative). `exists` is relative to the
 * repository root and decides whether a directory has `tests/` for `terraform test`. A tested
 * directory that declares provider aliases (`hasAliases`) is validated by `terraform test` alone.
 * @param {string[]} dirs
 * @param {Scanners} tools which scanners are on PATH
 * @param {(path: string) => boolean} [exists]
 * @param {(dir: string) => boolean} [hasAliases]
 * @returns {Step[]}
 */
export function checkSteps(
  dirs,
  tools,
  exists = (path) => existsSync(join(root, path)),
  hasAliases = declaresProviderAliases,
) {
  /** @type {Step[]} */
  const steps = [
    { name: 'Format', command: ['terraform', 'fmt', '-check', '-recursive', 'infra'] },
  ];
  for (const dir of dirs) {
    const tf = ['terraform', `-chdir=${dir}`];
    const tested = exists(`${dir}/tests`);
    steps.push({ name: `Init ${dir}`, command: [...tf, 'init', '-backend=false', '-input=false'] });
    if (!(tested && hasAliases(dir))) {
      steps.push({ name: `Validate ${dir}`, command: [...tf, 'validate'] });
    }
    if (tested) steps.push({ name: `Test ${dir}`, command: [...tf, 'test'] });
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
  /** @type {string[]} */
  let selected;
  try {
    selected = selectDirs(onlyIndex === -1 ? undefined : (args[onlyIndex + 1] ?? ''));
  } catch (error) {
    process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
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

  const plainSecrets = findPlainSecretStrings(PLAIN_SECRET_SCAN_DIRS);
  if (plainSecrets.length > 0) {
    process.stderr.write(
      `secret_string puts the value in Terraform state; use secret_string_wo:\n  ${plainSecrets.join('\n  ')}\n`,
    );
    process.exit(1);
  }

  // Roots and modules that do not exist yet are skipped, so the check passes as infra/ grows.
  const dirs = selected.filter((dir) => existsSync(join(root, dir)));
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
