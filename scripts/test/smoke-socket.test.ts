import { createServer, type Server as HttpServer } from 'node:http';

import { Server } from 'socket.io';
import { afterEach, describe, expect, it } from 'vitest';

import { nodeWebSocket, socketUrl } from '../smoke.mjs';

import type { AddressInfo } from 'node:net';

/** Starts `http` on a free loopback port and resolves with its base URL. */
const listen = (http: HttpServer) =>
  new Promise<string>((resolve) => {
    http.listen(0, '127.0.0.1', () => {
      resolve(`http://127.0.0.1:${(http.address() as AddressInfo).port}`);
    });
  });

const closeHttp = (http: HttpServer) =>
  new Promise<void>((resolve) => {
    http.close(() => {
      resolve();
    });
  });

describe('nodeWebSocket against a real Socket.IO server', () => {
  const cleanups: (() => Promise<void>)[] = [];
  afterEach(async () => {
    await Promise.all(cleanups.splice(0).map((cleanup) => cleanup()));
  });

  it('receives the Engine.IO open packet at socketUrl(api)', async () => {
    const http = createServer();
    // The same options as the API (D28): attached at /socket.io without serving the client.
    const io = new Server(http, { serveClient: false });
    cleanups.push(async () => {
      await io.close();
    });
    const api = await listen(http);

    const first = await nodeWebSocket(5_000)(socketUrl(api));

    expect(first.startsWith('0{')).toBe(true);
    expect(first).toContain('"sid"');
  });

  it('rejects when nothing is listening', async () => {
    const http = createServer();
    const api = await listen(http);
    await closeHttp(http);

    await expect(nodeWebSocket(5_000)(socketUrl(api))).rejects.toThrow();
  });

  it('rejects when the server is not Socket.IO', async () => {
    const http = createServer((_req, res) => {
      res.writeHead(404).end();
    });
    cleanups.push(() => closeHttp(http));
    const api = await listen(http);

    await expect(nodeWebSocket(5_000)(socketUrl(api))).rejects.toThrow();
  });
});
