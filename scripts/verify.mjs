#!/usr/bin/env node
// The full quality gate (`pnpm verify`): runs each step in order and stops at the first failure.
// It does not run `pnpm e2e:mobile` (Maestro, nightly in CI) or `pnpm eval:assistant` (paid, manual).
import { spawnSync } from 'node:child_process';
import { dirname, resolve } from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

/** @typedef {{ name: string, command: string[] }} Step */
/** @typedef {{ ok: true } | { ok: false, failed: Step, status: number | null }} VerifyResult */

/** @type {Step[]} */
export const STEPS = [
  {
    name: 'Typecheck, lint and unit tests',
    command: ['pnpm', 'exec', 'turbo', 'run', 'typecheck', 'lint', 'test'],
  },
  { name: 'Generated files are up to date', command: ['pnpm', 'codegen:check'] },
  // Fails in 60 s with "run docker compose up -d" instead of a connection error deep in a test.
  { name: 'Postgres and Redis are reachable', command: ['node', 'scripts/check-services.mjs'] },
  { name: 'API integration tests', command: ['pnpm', 'test:api'] },
  { name: 'End-to-end smoke tests', command: ['pnpm', 'e2e'] },
  {
    name: 'Production dependency audit',
    command: ['pnpm', 'audit', '--prod', '--audit-level', 'high'],
  },
];

/**
 * Runs `steps` in order through `exec`, which returns the exit status (null when killed by a
 * signal), and stops at the first step that does not exit 0.
 * @param {Step[]} steps
 * @param {(command: string[]) => number | null} exec
 * @param {(line: string) => void} log
 * @returns {VerifyResult}
 */
export function runSteps(steps, exec, log) {
  for (const [index, step] of steps.entries()) {
    const position = `${String(index + 1)}/${String(steps.length)}`;
    const commandLine = step.command.join(' ');
    log(`verify [${position}] ${step.name}: ${commandLine}`);
    const status = exec(step.command);
    if (status !== 0) {
      const how = status === null ? 'was killed by a signal' : `exited with code ${String(status)}`;
      log(`verify FAILED at step ${position} (${step.name}): "${commandLine}" ${how}.`);
      return { ok: false, failed: step, status };
    }
  }
  log(`verify passed: all ${String(steps.length)} steps succeeded.`);
  return { ok: true };
}

const isMain = process.argv[1] === fileURLToPath(import.meta.url);
if (isMain) {
  const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
  const result = runSteps(
    STEPS,
    ([cmd = '', ...args]) =>
      spawnSync(cmd, args, { cwd: root, stdio: 'inherit', shell: process.platform === 'win32' })
        .status,
    (line) => {
      process.stdout.write(`\n=== ${line}\n\n`);
    },
  );
  process.exit(result.ok ? 0 : 1);
}
