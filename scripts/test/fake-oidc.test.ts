import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';

import { describe, expect, it } from 'vitest';

import { DEFAULT_FAKE_OIDC_PORT, fakeOidcCommand } from '../fake-oidc.mjs';

const script = resolve(__dirname, '../fake-oidc.mjs');

describe('fakeOidcCommand', () => {
  it('runs the API tests’ fake issuer with tsx on the default port', () => {
    const { command, args } = fakeOidcCommand([]);
    expect(command).toBe(process.execPath);
    const [tsx, issuer, ...rest] = args;
    expect(existsSync(tsx ?? '')).toBe(true);
    expect(issuer).toBe(resolve(__dirname, '../../apps/api/test/fakes/oidc-issuer.ts'));
    expect(rest).toEqual(['--port', String(DEFAULT_FAKE_OIDC_PORT)]);
  });

  it('takes --port', () => {
    expect(fakeOidcCommand(['--port', '4456']).args.slice(-2)).toEqual(['--port', '4456']);
  });

  it.each([['--port'], ['--port', 'abc'], ['--port', '70000'], ['--host', 'x']])(
    'refuses %j',
    (...argv) => {
      expect(() => fakeOidcCommand(argv)).toThrow(/Usage/);
    },
  );
});

describe('scripts/fake-oidc.mjs', () => {
  it('serves OIDC discovery for each client under the URL it prints, and stops on SIGTERM', async () => {
    const child = spawn(process.execPath, [script, '--port', '0'], {
      stdio: ['ignore', 'pipe', 'inherit'],
    });
    try {
      const [chunk] = (await once(child.stdout, 'data')) as [Buffer];
      const url = /listening on (\S+)/.exec(chunk.toString())?.[1] ?? '';
      for (const client of ['google', 'microsoft', 'console_google']) {
        const response = await fetch(`${url}/${client}/.well-known/openid-configuration`);
        expect(response.status).toBe(200);
        expect(await response.json()).toMatchObject({
          issuer: `${url}/${client}`,
          code_challenge_methods_supported: ['S256'],
        });
      }
    } finally {
      child.kill('SIGTERM');
    }
    const [code] = (await once(child, 'exit')) as [number | null];
    expect(code).toBe(0);
  }, 30_000);
});
