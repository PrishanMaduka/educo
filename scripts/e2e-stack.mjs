#!/usr/bin/env node
// The end-to-end stack for Playwright (Task 18, D32): `node scripts/e2e-stack.mjs [--port 4000]`.
//   1. checks the port is free and the API is built (`apps/api/dist`);
//   2. creates a fresh Postgres database `quad_e2e_<pid>` as the admin role, owned by quad_owner;
//   3. migrates and seeds it with the api image's own commands (`dist/migrate.js`, `dist/seed.js`);
//   4. empties the run's own Redis database (1 + port mod 15, never the developer's 0);
//   5. starts `dist/main.js` and `dist/worker.js` on that port, local, with Mailpit SMTP and the
//      fixed code 000000, and waits for /api/v1/health/ready;
//   6. on SIGINT, SIGTERM or SIGHUP, when the API or worker exits, or when a step fails, stops
//      both, empties its Redis database and drops its Postgres database, then exits.
// The developer's main database is never opened: the admin connection uses the `postgres`
// maintenance database. Secrets and the seed password are the local ones from .env.example; only
// where the services are (DATABASE_*_URL, REDIS_URL, SMTP_URL) comes from the environment (CI).
import { Buffer } from 'node:buffer';
import { spawn } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import net from 'node:net';
import { dirname, join, resolve } from 'node:path';
import process from 'node:process';
import { clearTimeout, setTimeout } from 'node:timers';
import { fileURLToPath, URL } from 'node:url';
import { parseEnv } from 'node:util';

import pg from 'pg';

// Node 22 globals (the lint config declares no browser globals).
const { AbortSignal, fetch } = globalThis;

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const API_DIST = join(ROOT, 'apps/api/dist');

export const DEFAULT_STACK_PORT = 4000;
const READY_TIMEOUT_MS = 90_000;
const STOP_TIMEOUT_MS = 10_000;
const STACK_DATABASE = /^quad_e2e_\d+$/;
/** Only these say where the services are; everything else comes from .env.example. */
const SERVICE_KEYS = [
  'DATABASE_URL',
  'DATABASE_PLATFORM_URL',
  'DATABASE_OWNER_URL',
  'DATABASE_ADMIN_URL',
  'REDIS_URL',
  'SMTP_URL',
];

/** @typedef {Readonly<Record<string, string | undefined>>} Env */
/** @typedef {{ port: number }} StackArgs */

/**
 * @param {string | undefined} value
 * @returns {number}
 */
function portOf(value) {
  const port = Number(value);
  if (value === undefined || !/^\d+$/.test(value) || port < 1 || port > 65535) {
    throw new Error(`--port needs a port number from 1 to 65535, not ${JSON.stringify(value)}.`);
  }
  return port;
}

/**
 * @param {string[]} argv
 * @returns {StackArgs}
 */
export function parseStackArgs(argv) {
  let port = DEFAULT_STACK_PORT;
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i] ?? '';
    if (arg === '--port') {
      port = portOf(argv[i + 1]);
      i += 1;
    } else if (arg.startsWith('--port=')) {
      port = portOf(arg.slice('--port='.length));
    } else {
      throw new Error(`Unknown argument ${JSON.stringify(arg)}. Usage: e2e-stack.mjs [--port n]`);
    }
  }
  return { port };
}

/** @param {number} pid */
export const stackDatabaseName = (pid) => `quad_e2e_${String(pid)}`;

/** @param {string} name */
export const isStackDatabaseName = (name) => STACK_DATABASE.test(name);

/**
 * The run's Redis database: 1 to 15, distinct for any 15 neighbouring ports, never 0. Rate-limit
 * buckets, the session cache and the job queues are per database, so parallel stacks (and the
 * developer's `pnpm dev`) never take each other's jobs or limits.
 * @param {number} port
 */
export const redisDatabaseFor = (port) => 1 + (port % 15);

/** @returns {Record<string, string>} The variables `.env.example` documents, with its local values. */
export function readEnvExample() {
  /** @type {Record<string, string>} */
  const values = {};
  for (const [key, value] of Object.entries(
    parseEnv(readFileSync(join(ROOT, '.env.example'), 'utf8')),
  )) {
    values[key] = value ?? '';
  }
  return values;
}

/**
 * @param {string} url
 * @param {string} name
 */
function withPath(url, name) {
  const parsed = new URL(url);
  parsed.pathname = `/${name}`;
  return parsed.toString();
}

/**
 * The environment of the stack's children (API, worker, migrate, seed).
 * @param {{ port: number, pid: number, example: Record<string, string>, env: Env }} options
 * @returns {Record<string, string>}
 */
export function stackEnv({ port, pid, example, env }) {
  /** @type {Record<string, string>} */
  const services = {};
  for (const key of SERVICE_KEYS) {
    const value = env[key];
    services[key] = value !== undefined && value !== '' ? value : (example[key] ?? '');
  }
  const database = stackDatabaseName(pid);
  return {
    ...example,
    ...services,
    APP_ENV: 'local',
    LOG_LEVEL: 'warn',
    API_PORT: String(port),
    DATABASE_URL: withPath(services.DATABASE_URL ?? '', database),
    DATABASE_PLATFORM_URL: withPath(services.DATABASE_PLATFORM_URL ?? '', database),
    DATABASE_OWNER_URL: withPath(services.DATABASE_OWNER_URL ?? '', database),
    // The maintenance database: the stack never opens the developer's own.
    DATABASE_ADMIN_URL: withPath(services.DATABASE_ADMIN_URL ?? '', 'postgres'),
    REDIS_URL: withPath(services.REDIS_URL ?? '', String(redisDatabaseFor(port))),
    EMAIL_PROVIDER: 'smtp',
    SMS_PROVIDER: 'log',
    DEV_FIXED_OTP: '000000',
  };
}

/**
 * Whether nothing listens on `port` (any address).
 * @param {number} port
 * @returns {Promise<boolean>}
 */
function isPortFree(port) {
  return new Promise((done) => {
    const server = net.createServer();
    server.once('error', () => {
      done(false);
    });
    server.listen(port, () => {
      server.close(() => {
        done(true);
      });
    });
  });
}

/**
 * Sends one Redis command per array over a plain connection and checks each answers `+OK`.
 * @param {string} url
 * @param {string[][]} commands
 * @returns {Promise<void>}
 */
function redisCommands(url, commands) {
  const parsed = new URL(url);
  const auth = parsed.password === '' ? [] : [['AUTH', decodeURIComponent(parsed.password)]];
  const all = [...auth, ...commands];
  const wire = all
    .map(
      (args) =>
        `*${String(args.length)}\r\n${args.map((a) => `$${String(Buffer.byteLength(a))}\r\n${a}\r\n`).join('')}`,
    )
    .join('');
  return new Promise((done, fail) => {
    const socket = net.connect({ host: parsed.hostname, port: Number(parsed.port || 6379) });
    let answer = '';
    socket.setTimeout(5_000, () => {
      socket.destroy();
      fail(new Error('Redis did not answer within 5 s.'));
    });
    socket.once('error', fail);
    socket.on('data', (chunk) => {
      answer += chunk.toString('utf8');
      const lines = answer.split('\r\n').filter((line) => line !== '');
      if (lines.length < all.length) return;
      socket.end();
      const bad = lines.find((line) => line !== '+OK');
      if (bad === undefined) done();
      else fail(new Error(`Redis refused a command: ${bad}`));
    });
    socket.write(wire);
  });
}

/**
 * @param {string} url
 * @returns {Promise<void>}
 */
const emptyRedisDatabase = (url) =>
  redisCommands(url, [['SELECT', new URL(url).pathname.slice(1) || '0'], ['FLUSHDB']]);

/**
 * Runs SQL as the admin role on the maintenance database.
 * @param {string} adminUrl
 * @param {string[]} statements
 */
async function asAdmin(adminUrl, statements) {
  const client = new pg.Client({ connectionString: adminUrl });
  await client.connect();
  try {
    for (const statement of statements) await client.query(statement);
  } finally {
    await client.end();
  }
}

/**
 * @param {string} name
 * @returns {string}
 */
function checkedName(name) {
  if (!isStackDatabaseName(name)) throw new Error(`Refusing to touch database ${name}.`);
  return name;
}

/**
 * Runs `node <file>` with `env` and resolves when it exits 0. `track` gets the child, so a stop
 * meanwhile ends it too.
 * @param {string} file
 * @param {Record<string, string>} env
 * @param {(child: import('node:child_process').ChildProcess) => void} track
 * @returns {Promise<void>}
 */
function runOnce(file, env, track) {
  return new Promise((done, fail) => {
    const child = spawn(process.execPath, [file], { env, stdio: ['ignore', 'ignore', 'inherit'] });
    track(child);
    child.once('error', fail);
    child.once('exit', (code, signal) => {
      if (code === 0) done();
      else fail(new Error(`${file} exited with ${signal ?? `code ${String(code)}`}.`));
    });
  });
}

/**
 * @param {import('node:child_process').ChildProcess} child
 * @returns {Promise<void>}
 */
function stopChild(child) {
  if (child.exitCode !== null || child.signalCode !== null) return Promise.resolve();
  return new Promise((done) => {
    const timer = setTimeout(() => {
      child.kill('SIGKILL');
    }, STOP_TIMEOUT_MS);
    child.once('exit', () => {
      clearTimeout(timer);
      done();
    });
    child.kill('SIGTERM');
  });
}

/**
 * Polls /api/v1/health/ready until it answers 200, a child exits, or the time is up.
 * @param {string} url
 * @param {() => string | null} exited
 */
async function waitUntilReady(url, exited) {
  const deadline = Date.now() + READY_TIMEOUT_MS;
  for (;;) {
    const gone = exited();
    if (gone !== null) throw new Error(`${gone} exited before the stack was ready.`);
    try {
      const response = await fetch(url, { signal: AbortSignal.timeout(2_000) });
      if (response.status === 200) return;
    } catch {
      // Not listening yet.
    }
    if (Date.now() >= deadline) {
      throw new Error(`${url} was not ready within ${String(READY_TIMEOUT_MS / 1000)} s.`);
    }
    await new Promise((wait) => setTimeout(wait, 250));
  }
}

/**
 * Starts the stack. `stop` is safe to call at any point and more than once.
 * @param {{ port: number, pid?: number, env?: Env, log?: (line: string) => void }} options
 */
export function createStack({ port, pid = process.pid, env = process.env, log = () => {} }) {
  const childEnv = stackEnv({ port, pid, example: readEnvExample(), env });
  const database = checkedName(stackDatabaseName(pid));
  const adminUrl = childEnv.DATABASE_ADMIN_URL ?? '';
  const redisUrl = childEnv.REDIS_URL ?? '';
  /** @type {import('node:child_process').ChildProcess[]} */
  const children = [];
  /** @type {Map<string, import('node:child_process').ChildProcess>} */
  const byName = new Map();
  let created = false;
  /** @type {Promise<void> | undefined} */
  let stopping;
  /** @type {(name: string) => void} */
  let onExit = () => {};

  /** Throws once a stop has begun, so a signal during start-up starts nothing more. */
  const stillStarting = () => {
    if (stopping !== undefined) throw new Error('Stopped while starting.');
  };

  /** @param {string} name */
  const startChild = (name) => {
    const child = spawn(process.execPath, ['--enable-source-maps', join(API_DIST, `${name}.js`)], {
      env: { ...childEnv, PATH: process.env.PATH ?? '' },
      stdio: ['ignore', 'inherit', 'inherit'],
    });
    children.push(child);
    byName.set(name, child);
    child.once('exit', () => {
      if (stopping === undefined) onExit(name);
    });
  };

  const start = async () => {
    if (!(await isPortFree(port))) {
      throw new Error(`Port ${String(port)} is in use; stop that server or pass --port.`);
    }
    for (const file of ['main.js', 'worker.js', 'migrate.js', 'seed.js']) {
      if (!existsSync(join(API_DIST, file))) {
        throw new Error(`apps/api/dist/${file} is missing; run pnpm --filter @quad/api build.`);
      }
    }
    // A database left by an earlier run with this pid (killed with SIGKILL) goes first.
    await asAdmin(adminUrl, [`drop database if exists ${database} with (force)`]);
    created = true;
    await asAdmin(adminUrl, [
      `create database ${database} owner quad_owner`,
      `revoke all on database ${database} from public`,
      `grant connect on database ${database} to quad_owner, quad_app, quad_platform`,
    ]);
    const commandEnv = { ...childEnv, PATH: process.env.PATH ?? '' };
    /** @param {import('node:child_process').ChildProcess} child */
    const track = (child) => {
      children.push(child);
    };
    stillStarting();
    await runOnce(join(API_DIST, 'migrate.js'), commandEnv, track);
    stillStarting();
    await runOnce(join(API_DIST, 'seed.js'), commandEnv, track);
    stillStarting();
    await emptyRedisDatabase(redisUrl);
    stillStarting();
    startChild('main');
    startChild('worker');
    await waitUntilReady(`http://localhost:${String(port)}/api/v1/health/ready`, () => {
      for (const [name, child] of byName) {
        if (child.exitCode !== null || child.signalCode !== null) return name;
      }
      return null;
    });
    log(`E2E stack ready on http://localhost:${String(port)} (database ${database}).`);
  };

  const stop = () => {
    stopping ??= (async () => {
      await Promise.all(children.map(stopChild));
      try {
        await emptyRedisDatabase(redisUrl);
      } catch (error) {
        log(`Could not empty the stack's Redis database: ${messageOf(error)}`);
      }
      if (created) {
        await asAdmin(adminUrl, [`drop database if exists ${database} with (force)`]);
        log(`Dropped ${database}.`);
      }
    })();
    return stopping;
  };

  return {
    database,
    env: childEnv,
    start,
    stop,
    /** @param {(name: string) => void} handler called when the API or worker exits on its own */
    onUnexpectedExit: (handler) => {
      onExit = handler;
    },
  };
}

/** @param {unknown} error */
function messageOf(error) {
  return error instanceof Error ? error.message : String(error);
}

const isMain = process.argv[1] === fileURLToPath(import.meta.url);
if (isMain) {
  /** @param {string} line */
  const log = (line) => {
    process.stderr.write(`[e2e-stack] ${line}\n`);
  };
  let args;
  try {
    args = parseStackArgs(process.argv.slice(2));
  } catch (error) {
    log(messageOf(error));
    process.exit(2);
  }
  const stack = createStack({ port: args.port, log });
  /** @param {number} code */
  const finish = async (code) => {
    try {
      await stack.stop();
    } catch (error) {
      log(`Could not drop ${stack.database}: ${messageOf(error)}`);
      code = code === 0 ? 1 : code;
    }
    process.exit(code);
  };
  for (const [signal, code] of /** @type {const} */ ([
    ['SIGINT', 130],
    ['SIGTERM', 143],
    ['SIGHUP', 129],
  ])) {
    process.once(signal, () => {
      void finish(code);
    });
  }
  stack.onUnexpectedExit((name) => {
    log(`${name} exited; stopping the stack.`);
    void finish(1);
  });
  process.once('uncaughtException', (error) => {
    log(messageOf(error));
    void finish(1);
  });
  process.once('unhandledRejection', (error) => {
    log(messageOf(error));
    void finish(1);
  });
  try {
    await stack.start();
  } catch (error) {
    log(`Could not start: ${messageOf(error)}`);
    await finish(1);
  }
}
