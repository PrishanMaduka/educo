#!/usr/bin/env node
// Waits until Postgres and Redis accept connections; gives up after 60 seconds. `pnpm verify` runs it
// before the API integration tests. Hosts and ports come from DATABASE_URL and REDIS_URL when set.
import console from 'node:console';
import net from 'node:net';
import process from 'node:process';
import { setTimeout } from 'node:timers';
import { fileURLToPath, URL } from 'node:url';

const TIMEOUT_MS = 60_000;
const RETRY_MS = 1_000;

/** @typedef {{ name: string, host: string, port: number }} Target */

/**
 * @param {string} name
 * @param {string | undefined} url
 * @param {number} defaultPort
 * @returns {Target}
 */
const target = (name, url, defaultPort) => {
  const parsed = url ? new URL(url) : undefined;
  return {
    name,
    host: parsed?.hostname || 'localhost',
    port: parsed?.port ? Number(parsed.port) : defaultPort,
  };
};

/**
 * The services the integration tests need, from the same variables they read.
 * @param {Record<string, string | undefined>} env
 * @returns {Target[]}
 */
export function serviceTargets(env) {
  return [
    target('Postgres', env.DATABASE_URL, 5432),
    target('Redis', env.REDIS_URL, 6379),
  ];
}

/** @type {(target: Target) => Promise<boolean>} */
const canConnect = ({ host, port }) =>
  new Promise((resolve) => {
    const socket = net.connect({ host, port });
    /** @param {boolean} ok */
    const done = (ok) => {
      socket.destroy();
      resolve(ok);
    };
    socket.setTimeout(2_000, () => done(false));
    socket.once('connect', () => done(true));
    socket.once('error', () => done(false));
  });

/** @type {(ms: number) => Promise<void>} */
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/** @param {Target[]} targets */
async function waitFor(targets) {
  const deadline = Date.now() + TIMEOUT_MS;
  const pending = new Set(targets);
  while (pending.size > 0) {
    for (const t of [...pending]) {
      if (await canConnect(t)) {
        console.log(`${t.name} is ready on ${t.host}:${String(t.port)}`);
        pending.delete(t);
      }
    }
    if (pending.size === 0) return true;
    if (Date.now() >= deadline) {
      const names = [...pending].map((t) => t.name).join(' and ');
      console.error(
        `Timed out after 60 s waiting for ${names}. Run "docker compose up -d" and try again.`,
      );
      return false;
    }
    await sleep(RETRY_MS);
  }
  return true;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  process.exit((await waitFor(serviceTargets(process.env))) ? 0 : 1);
}
