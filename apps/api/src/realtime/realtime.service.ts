import { Injectable } from '@nestjs/common';
import { HttpAdapterHost } from '@nestjs/core';
import { Server } from 'socket.io';

import type { BeforeApplicationShutdown, OnApplicationBootstrap } from '@nestjs/common';
import type { FastifyAdapter } from '@nestjs/platform-fastify';

/**
 * The Socket.IO server on the API's own HTTP server, at `/socket.io` (spec 06 → Realtime). Engine.IO
 * answers that path before Fastify routes it, so it is not an OpenAPI route. It accepts the
 * handshake and joins no rooms yet: M1 adds the session middleware and M6 the Redis adapter.
 */
@Injectable()
export class RealtimeService implements OnApplicationBootstrap, BeforeApplicationShutdown {
  private server: Server | undefined;

  constructor(private readonly adapterHost: HttpAdapterHost<FastifyAdapter>) {}

  onApplicationBootstrap(): void {
    const httpServer = this.adapterHost.httpAdapter.getInstance().server;
    this.server = new Server(httpServer, { path: '/socket.io', serveClient: false });
  }

  /**
   * Before, not on, shutdown: Nest closes the HTTP server between the two hooks, and that waits
   * for every open WebSocket. Not `server.close()` either: it would close the HTTP server too,
   * which Nest does next.
   */
  beforeApplicationShutdown(): void {
    this.server?.disconnectSockets(true);
    this.server?.engine.close();
    this.server = undefined;
  }
}
