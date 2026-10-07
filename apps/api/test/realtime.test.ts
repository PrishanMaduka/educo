import pino from 'pino';
import { describe, expect, it } from 'vitest';

import { createApp } from '../src/app';
import { loadConfig } from '../src/config';

import { CLOSED_PORTS, useTestApp } from './app';
import { localEnv } from './env';

/** Resolves with the first message, or rejects if the socket fails first. */
function firstMessage(socket: WebSocket): Promise<string> {
  return new Promise<string>((resolve, reject) => {
    socket.addEventListener('message', (event) => {
      resolve(String(event.data));
    });
    socket.addEventListener('error', () => {
      reject(new Error('The WebSocket failed to connect'));
    });
  });
}

/** The Socket.IO handshake (spec 06 → Realtime) on a real port; auth arrives in M1. */
describe('realtime handshake', () => {
  const app = useTestApp(CLOSED_PORTS, { listen: true });

  function origin(): string {
    const address = app().getHttpServer().address();
    if (address === null || typeof address === 'string') throw new Error('The app is not listening');
    return `127.0.0.1:${String(address.port)}`;
  }

  it('answers the Engine.IO polling handshake with a session id', async () => {
    const response = await fetch(`http://${origin()}/socket.io/?EIO=4&transport=polling`);
    expect(response.status).toBe(200);
    const body = await response.text();
    expect(body.startsWith('0{')).toBe(true);
    expect(body).toContain('"sid"');
  });

  it('opens a WebSocket and sends the open packet first', async () => {
    const socket = new WebSocket(`ws://${origin()}/socket.io/?EIO=4&transport=websocket`);
    try {
      const first = await firstMessage(socket);
      expect(first.startsWith('0{')).toBe(true);
    } finally {
      socket.close();
    }
  });

  it('disconnects its clients when the app shuts down', async () => {
    const own = await createApp(loadConfig(localEnv(CLOSED_PORTS)), {
      logger: pino({ level: 'silent' }),
    });
    await own.listen(0, '127.0.0.1');
    const address = own.getHttpServer().address();
    if (address === null || typeof address === 'string') throw new Error('Not listening');
    const socket = new WebSocket(
      `ws://127.0.0.1:${String(address.port)}/socket.io/?EIO=4&transport=websocket`,
    );
    await firstMessage(socket);
    const closed = new Promise<void>((resolve) => {
      socket.addEventListener('close', () => {
        resolve();
      });
    });
    await own.close();
    await closed;
    expect(socket.readyState).toBe(WebSocket.CLOSED);
  });
});
