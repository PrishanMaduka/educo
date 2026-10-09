// The e2e stack against the compose services and the built API (scripts/e2e-stack.mjs, Task 18):
// it starts on the port it is given, answers /health/ready, runs beside a second stack with its
// own database, and drops its database on SIGTERM, SIGINT and failure.
import { spawn } from 'node:child_process';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { Mailpit, linkIn } from '@quad/config/playwright/mailpit';
import { Client } from 'pg';
import { afterEach, describe, expect, it } from 'vitest';

import type { ChildProcess } from 'node:child_process';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const script = resolve(root, 'scripts/e2e-stack.mjs');
const adminUrl = (() => {
  const url = new URL(
    process.env.DATABASE_ADMIN_URL ?? 'postgres://postgres:postgres@localhost:5432/quad',
  );
  url.pathname = '/postgres';
  return url.toString();
})();

interface Running {
  readonly child: ChildProcess;
  readonly database: string;
  readonly output: () => string;
  readonly exited: Promise<number | null>;
}

const running = new Set<ChildProcess>();

afterEach(async () => {
  // A failed assertion must not leave a stack (and its database) behind.
  for (const child of running) {
    if (child.exitCode === null && child.signalCode === null) {
      const gone = new Promise((done) => child.once('exit', done));
      child.kill('SIGTERM');
      await gone;
    }
  }
  running.clear();
});

function launch(args: string[], env: NodeJS.ProcessEnv = process.env): Running {
  const child = spawn(process.execPath, [script, ...args], {
    cwd: root,
    env,
    stdio: ['ignore', 'ignore', 'pipe'],
  });
  running.add(child);
  let text = '';
  child.stderr.on('data', (chunk: Buffer) => {
    text += chunk.toString('utf8');
  });
  const exited = new Promise<number | null>((done) => {
    child.once('exit', (code) => {
      done(code);
    });
  });
  return { child, database: `quad_e2e_${String(child.pid)}`, output: () => text, exited };
}

async function ready(stack: Running): Promise<void> {
  const deadline = Date.now() + 120_000;
  while (!stack.output().includes('E2E stack ready')) {
    if (stack.child.exitCode !== null) throw new Error(`The stack exited:\n${stack.output()}`);
    if (Date.now() > deadline) throw new Error(`The stack never got ready:\n${stack.output()}`);
    await new Promise((wait) => setTimeout(wait, 200));
  }
}

async function databaseExists(name: string): Promise<boolean> {
  const client = new Client({ connectionString: adminUrl });
  await client.connect();
  try {
    const { rows } = await client.query('select 1 from pg_database where datname = $1', [name]);
    return rows.length === 1;
  } finally {
    await client.end();
  }
}

async function readiness(port: number): Promise<{ status: number; body: unknown }> {
  const response = await fetch(`http://localhost:${String(port)}/api/v1/health/ready`);
  return { status: response.status, body: await response.json() };
}

/** The seeded school names a stack's database holds, read as its owner. */
async function seededSchools(database: string): Promise<string[]> {
  const url = new URL(
    process.env.DATABASE_OWNER_URL ?? 'postgres://quad_owner:quad_owner@localhost:5432/quad',
  );
  url.pathname = `/${database}`;
  const client = new Client({ connectionString: url.toString() });
  await client.connect();
  try {
    const { rows } = await client.query<{ name: string }>('select name from tenants order by name');
    return rows.map((row) => row.name);
  } finally {
    await client.end();
  }
}

describe('scripts/e2e-stack.mjs', () => {
  it('starts on the given port, answers /health/ready with a seeded database, and drops it on SIGTERM', async () => {
    const stack = launch(['--port', '4000']);
    await ready(stack);

    expect(await readiness(4000)).toEqual({
      status: 200,
      body: { status: 'ok', db: 'ok', redis: 'ok' },
    });
    expect(await databaseExists(stack.database)).toBe(true);
    expect(await seededSchools(stack.database)).toHaveLength(2);

    // The worker runs too: a reset email for a seeded person reaches Mailpit with its link.
    const since = new Date(Date.now() - 1_000);
    const forgot = await fetch('http://localhost:4000/api/v1/auth/password/forgot', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ email: 'prishan.maduka@colombo-intl.local' }),
    });
    expect(forgot.status).toBe(202);
    const email = await new Mailpit().waitForMessage({
      to: 'prishan.maduka@colombo-intl.local',
      since,
      subject: 'Reset your Quad password',
    });
    expect(linkIn(email.text, '/sign-in/reset/')).toMatch(
      /^http:\/\/localhost:3000\/sign-in\/reset\//,
    );

    stack.child.kill('SIGTERM');
    await stack.exited;
    expect(await databaseExists(stack.database)).toBe(false);
    expect(stack.output()).toContain(`Dropped ${stack.database}.`);
    await expect(readiness(4000)).rejects.toThrow();
  }, 180_000);

  it('runs two stacks side by side on :4000 and :4001 with separate databases, and SIGINT drops one', async () => {
    const first = launch(['--port', '4000']);
    const second = launch(['--port=4001']);
    await Promise.all([ready(first), ready(second)]);

    expect(first.database).not.toBe(second.database);
    expect((await readiness(4000)).status).toBe(200);
    expect((await readiness(4001)).status).toBe(200);
    expect(await databaseExists(first.database)).toBe(true);
    expect(await databaseExists(second.database)).toBe(true);

    first.child.kill('SIGINT');
    await first.exited;
    expect(await databaseExists(first.database)).toBe(false);
    // The other stack is untouched.
    expect((await readiness(4001)).status).toBe(200);
    expect(await databaseExists(second.database)).toBe(true);

    second.child.kill('SIGTERM');
    await second.exited;
    expect(await databaseExists(second.database)).toBe(false);
  }, 240_000);

  it('drops its database when a step after creating it fails, and exits 1', async () => {
    // Nothing listens on port 1, so emptying the run's Redis database fails after the seed.
    const stack = launch(['--port', '4002'], { ...process.env, REDIS_URL: 'redis://127.0.0.1:1' });

    expect(await stack.exited).toBe(1);
    expect(stack.output()).toContain('Could not start');
    expect(stack.output()).toContain(`Dropped ${stack.database}.`);
    expect(await databaseExists(stack.database)).toBe(false);
  }, 180_000);

  it('refuses a port that is already in use, and creates nothing', async () => {
    const stack = launch(['--port', '4000']);
    await ready(stack);
    const clash = launch(['--port', '4000']);

    expect(await clash.exited).toBe(1);
    expect(clash.output()).toContain('Port 4000 is in use');
    expect(await databaseExists(clash.database)).toBe(false);
    // The running stack still answers.
    expect((await readiness(4000)).status).toBe(200);

    stack.child.kill('SIGTERM');
    await stack.exited;
  }, 180_000);
});
