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

const PORT_A = 4000;
const PORT_B = 4001;
const PORT_C = 4002;

interface Running {
  readonly child: ChildProcess;
  /** The run's database, as the stack names it when it creates it (null before that). */
  readonly database: () => string | null;
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
  const database = () => /Creating database (quad_e2e_\d+_[0-9a-f]{8})\./.exec(text)?.[1] ?? null;
  return { child, database, output: () => text, exited };
}

/** The run's database name, once the stack has said it. */
function nameOf(stack: Running): string {
  const name = stack.database();
  if (name === null) throw new Error(`The stack named no database:\n${stack.output()}`);
  return name;
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
  return (await databasesLike(name)).length === 1;
}

/** Databases named exactly `pattern`, or starting with it when it ends in `%`. */
async function databasesLike(pattern: string): Promise<string[]> {
  const client = new Client({ connectionString: adminUrl });
  await client.connect();
  try {
    const { rows } = await client.query<{ datname: string }>(
      'select datname from pg_database where datname like $1',
      [pattern],
    );
    return rows.map((row) => row.datname);
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
    const stack = launch(['--port', String(PORT_A)]);
    await ready(stack);
    const database = nameOf(stack);

    expect(await readiness(PORT_A)).toEqual({
      status: 200,
      body: { status: 'ok', db: 'ok', redis: 'ok' },
    });
    expect(await databaseExists(database)).toBe(true);
    expect(await seededSchools(database)).toHaveLength(2);

    // The worker runs too: a reset email for a seeded person reaches Mailpit with its link.
    const since = new Date(Date.now() - 1_000);
    const forgot = await fetch(`http://localhost:${String(PORT_A)}/api/v1/auth/password/forgot`, {
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
    expect(await databaseExists(database)).toBe(false);
    expect(stack.output()).toContain(`Dropped ${database}.`);
    await expect(readiness(PORT_A)).rejects.toThrow();
  }, 180_000);

  it('runs two stacks side by side with separate databases, and SIGINT drops one', async () => {
    const first = launch(['--port', String(PORT_A)]);
    const second = launch([`--port=${String(PORT_B)}`]);
    await Promise.all([ready(first), ready(second)]);
    const [firstDb, secondDb] = [nameOf(first), nameOf(second)];

    expect(firstDb).not.toBe(secondDb);
    expect((await readiness(PORT_A)).status).toBe(200);
    expect((await readiness(PORT_B)).status).toBe(200);
    expect(await databaseExists(firstDb)).toBe(true);
    expect(await databaseExists(secondDb)).toBe(true);

    first.child.kill('SIGINT');
    await first.exited;
    expect(await databaseExists(firstDb)).toBe(false);
    // The other stack is untouched.
    expect((await readiness(PORT_B)).status).toBe(200);
    expect(await databaseExists(secondDb)).toBe(true);

    second.child.kill('SIGTERM');
    await second.exited;
    expect(await databaseExists(secondDb)).toBe(false);
  }, 240_000);

  it('drops its database when a step after creating it fails, and exits 1', async () => {
    // Nothing listens on port 1, so emptying the run's Redis database fails after the seed.
    const stack = launch(['--port', String(PORT_C)], {
      ...process.env,
      REDIS_URL: 'redis://127.0.0.1:1',
    });

    expect(await stack.exited).toBe(1);
    const database = nameOf(stack);
    expect(stack.output()).toContain('Could not start');
    expect(stack.output()).toContain(`Dropped ${database}.`);
    expect(await databaseExists(database)).toBe(false);
  }, 180_000);

  it('refuses a port that is already in use, and creates nothing', async () => {
    const stack = launch(['--port', String(PORT_A)]);
    await ready(stack);
    const clash = launch(['--port', String(PORT_A)]);

    expect(await clash.exited).toBe(1);
    expect(clash.output()).toContain(`Port ${String(PORT_A)} is in use`);
    expect(clash.database()).toBeNull();
    expect(await databasesLike(`quad_e2e_${String(clash.child.pid)}_%`)).toEqual([]);
    // The running stack still answers.
    expect((await readiness(PORT_A)).status).toBe(200);

    stack.child.kill('SIGTERM');
    await stack.exited;
  }, 180_000);
});
