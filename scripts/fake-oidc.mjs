#!/usr/bin/env node
// Runs the fake OIDC issuer for Playwright and the e2e stack (D32): the same issuer the API
// tests use (apps/api/test/fakes/oidc-issuer.ts), run with the API's tsx. Point the API at it
// with OIDC_FAKE_ISSUER_URL=http://127.0.0.1:<port> (local only). Usage: fake-oidc.mjs [--port N]
import { spawn } from 'node:child_process';
import { createRequire } from 'node:module';
import { dirname, resolve } from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

export const DEFAULT_FAKE_OIDC_PORT = 4455;

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const apiDir = resolve(root, 'apps/api');
const USAGE = 'Usage: fake-oidc.mjs [--port N] (N from 0 to 65535; 0 picks a free port)';

/**
 * The command that starts the issuer.
 * @param {readonly string[]} argv the arguments after the script name
 * @returns {{ command: string, args: string[] }}
 */
export function fakeOidcCommand(argv) {
  let port = DEFAULT_FAKE_OIDC_PORT;
  if (argv.length > 0) {
    const [flag, value, ...rest] = argv;
    const parsed = Number(value);
    if (flag !== '--port' || value === undefined || rest.length > 0) throw new Error(USAGE);
    if (!/^\d+$/.test(value) || parsed > 65_535) throw new Error(USAGE);
    port = parsed;
  }
  const tsx = createRequire(resolve(apiDir, 'package.json')).resolve('tsx/cli');
  return {
    command: process.execPath,
    args: [tsx, resolve(apiDir, 'test/fakes/oidc-issuer.ts'), '--port', String(port)],
  };
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const { command, args } = fakeOidcCommand(process.argv.slice(2));
  const child = spawn(command, args, { stdio: 'inherit' });
  for (const signal of /** @type {const} */ (['SIGINT', 'SIGTERM'])) {
    process.on(signal, () => child.kill(signal));
  }
  child.on('exit', (code, signal) => {
    process.exit(code ?? (signal === null ? 1 : 0));
  });
}
