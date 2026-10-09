import { Inject, Injectable } from '@nestjs/common';
import { HttpAdapterHost } from '@nestjs/core';
import { Server } from 'socket.io';

import { RequestAuthenticator } from '../common/session/request-auth';
import { errorForLog } from '../observability/logger';
import { CONFIG, LOGGER } from '../tokens';

import type { HandshakeSurface, SocketIdentity } from '../common/session/request-auth';
import type { Config } from '../config';
import type { BeforeApplicationShutdown, OnApplicationBootstrap } from '@nestjs/common';
import type { FastifyAdapter } from '@nestjs/platform-fastify';
import type { IncomingMessage } from 'node:http';
import type { Logger } from 'pino';
import type { DefaultEventsMap } from 'socket.io';

/** What each socket keeps from its handshake. */
interface SocketData {
  identity: SocketIdentity;
}

type RealtimeServer = Server<DefaultEventsMap, DefaultEventsMap, DefaultEventsMap, SocketData>;

/**
 * The rooms a socket joins (spec 06 → Realtime): `tenant:{id}` and `user:{id}` for a school
 * member, `tenant:{id}` alone for a support visit, `platform` for a console user, `user:{id}`
 * alone for a guardian's token (`tenant:{id}` carries staff events), and none without a session
 * (the parent app before sign-in).
 */
export function roomsFor(identity: SocketIdentity): string[] {
  if (identity === null) return [];
  if (identity.kind === 'platform') return ['platform'];
  if (identity.kind === 'parent') return [`user:${identity.userId}`];
  return identity.userId === null
    ? [`tenant:${identity.tenantId}`]
    : [`tenant:${identity.tenantId}`, `user:${identity.userId}`];
}

/** The parent app's access token from the handshake's `auth` payload, if it sent one. */
function tokenOf(handshake: { readonly auth: unknown }): unknown {
  const auth = handshake.auth;
  return typeof auth === 'object' && auth !== null && 'token' in auth ? auth.token : undefined;
}

/**
 * Whether a handshake may open: from the staff portal or the console origin, or with no
 * `Origin` at all (the parent app; D28 follow-up). Any other site is refused before the session
 * cookie is read, so a page elsewhere cannot open a socket with a staff member's cookie.
 */
export function originAllowed(origin: string | undefined, allowed: readonly string[]): boolean {
  return origin === undefined || allowed.includes(origin);
}

/**
 * The Socket.IO server on the API's own HTTP server, at `/socket.io` (spec 06 → Realtime).
 * Engine.IO answers that path before Fastify routes it, so it is not an OpenAPI route. The
 * staff cookie (or, from Task 10, the console cookie) or the parent app's `auth.token` picks
 * the rooms. M6 adds the Redis adapter.
 */
@Injectable()
export class RealtimeService implements OnApplicationBootstrap, BeforeApplicationShutdown {
  private server: RealtimeServer | undefined;
  private readonly origins: readonly string[];
  private readonly consoleOrigin: string;

  constructor(
    private readonly adapterHost: HttpAdapterHost<FastifyAdapter>,
    private readonly authenticator: RequestAuthenticator,
    @Inject(CONFIG) config: Config,
    @Inject(LOGGER) private readonly logger: Logger,
  ) {
    this.consoleOrigin = new URL(config.CONSOLE_URL).origin;
    this.origins = [new URL(config.PUBLIC_WEB_URL).origin, this.consoleOrigin];
  }

  onApplicationBootstrap(): void {
    const httpServer = this.adapterHost.httpAdapter.getInstance().server;
    const server: RealtimeServer = new Server(httpServer, {
      path: '/socket.io',
      serveClient: false,
      // Also answers `/socket.io?…`: the staff app proxies that path locally, and Next.js would
      // redirect the trailing-slash form first.
      addTrailingSlash: false,
      allowRequest: (request: IncomingMessage, callback) => {
        callback(null, originAllowed(request.headers.origin, this.origins));
      },
    });
    server.use((socket, next) => {
      this.authenticator
        .fromHandshake(
          socket.request.headers.cookie,
          tokenOf(socket.handshake),
          this.surfaceOf(socket.request.headers.origin),
        )
        .then(
          (identity) => {
            socket.data.identity = identity;
            next();
          },
          (error: unknown) => {
            this.logger.warn(
              { error: errorForLog(error) },
              'Socket handshake could not be checked',
            );
            next(new Error('unavailable'));
          },
        );
    });
    server.on('connection', (socket) => {
      const rooms = roomsFor(socket.data.identity);
      if (rooms.length > 0) void socket.join(rooms);
    });
    this.server = server;
  }

  /** The app a checked Origin belongs to (allowRequest has refused any other). */
  private surfaceOf(origin: string | undefined): HandshakeSurface {
    if (origin === undefined) return null;
    return origin === this.consoleOrigin ? 'console' : 'school';
  }

  /** Sends `event` to everyone in `room` (for example `tenant:{id}`). */
  emitTo(room: string, event: string, payload: unknown): void {
    this.server?.to(room).emit(event, payload);
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
