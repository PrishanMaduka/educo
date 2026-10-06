#!/usr/bin/env node
// Waits until Postgres and Redis accept connections; gives up after 60 seconds.
import net from 'node:net';

const TIMEOUT_MS = 60_000;
const RETRY_MS = 1_000;

const targets = [
  { name: 'Postgres', host: 'localhost', port: 5432 },
  { name: 'Redis', host: 'localhost', port: 6379 },
];

const canConnect = ({ host, port }) =>
  new Promise((resolve) => {
    const socket = net.connect({ host, port });
    const done = (ok) => {
      socket.destroy();
      resolve(ok);
    };
    socket.setTimeout(2_000, () => done(false));
    socket.once('connect', () => done(true));
    socket.once('error', () => done(false));
  });

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const deadline = Date.now() + TIMEOUT_MS;
const pending = new Set(targets);

while (pending.size > 0) {
  for (const target of [...pending]) {
    if (await canConnect(target)) {
      console.log(`${target.name} is ready on ${target.host}:${target.port}`);
      pending.delete(target);
    }
  }
  if (pending.size === 0) break;
  if (Date.now() >= deadline) {
    const names = [...pending].map((t) => t.name).join(' and ');
    console.error(
      `Timed out after 60 s waiting for ${names}. Run "docker compose up -d" and try again.`,
    );
    process.exit(1);
  }
  await sleep(RETRY_MS);
}
