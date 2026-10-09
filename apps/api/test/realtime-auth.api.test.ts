import { io } from 'socket.io-client';
import { afterEach, describe, expect, it } from 'vitest';

import { RealtimeService, originAllowed, roomsFor } from '../src/realtime/realtime.service';

import { RecordingDelivery } from './fakes/delivery';
import { RecordingOtpSends } from './fakes/otp-sends';
import { useDatabaseApp } from './helpers/database-app';
import {
  insertAccount,
  insertPlatformUser,
  insertSchool,
  insertSupportVisit,
  insertWebSession,
  sessionHeaders,
  signedInMember,
} from './helpers/identity';
import {
  insertParentMember,
  insertPhoneAccount,
  signInByPhone,
  signedInParent,
} from './helpers/parent';
import { insertConsoleSession } from './helpers/platform';

import type { Socket } from 'socket.io-client';

const delivery = new RecordingDelivery();
const otpSends = new RecordingOtpSends(delivery);
const { db, app } = useDatabaseApp({}, { listen: true, overrides: { delivery, otpSends } });

const WEB = 'http://localhost:3000';
const CONSOLE = 'http://localhost:3001';
const opened: Socket[] = [];

afterEach(() => {
  for (const socket of opened.splice(0)) socket.disconnect();
});

function url(): string {
  const address = app().getHttpServer().address();
  if (address === null || typeof address === 'string') throw new Error('Not listening');
  return `http://127.0.0.1:${String(address.port)}`;
}

/** Connects like a browser (Origin and cookie) or the parent app (no Origin; `auth.token`). */
function connect(headers: Record<string, string>, token?: string): Socket {
  const socket = io(url(), {
    path: '/socket.io',
    transports: ['websocket'],
    extraHeaders: headers,
    reconnection: false,
    ...(token === undefined ? {} : { auth: { token } }),
  });
  opened.push(socket);
  return socket;
}

function connected(socket: Socket): Promise<void> {
  return new Promise((resolve, reject) => {
    socket.on('connect', () => {
      resolve();
    });
    socket.on('connect_error', reject);
  });
}

function refused(socket: Socket): Promise<Error> {
  return new Promise((resolve, reject) => {
    socket.on('connect', () => {
      reject(new Error('The socket connected'));
    });
    socket.on('connect_error', resolve);
  });
}

/** The events of `name` the socket receives within `ms`. */
function received(socket: Socket, name: string, ms = 300): Promise<unknown[]> {
  const events: unknown[] = [];
  socket.on(name, (payload: unknown) => events.push(payload));
  return new Promise((resolve) =>
    setTimeout(() => {
      resolve(events);
    }, ms),
  );
}

const realtime = () => app().get(RealtimeService);
const cookieOf = (headers: Record<string, string>) => headers.cookie ?? '';

describe('Socket.IO handshake (spec 06 → Realtime, D28 follow-up)', () => {
  it('refuses a socket from another site, whatever cookie it carries', async () => {
    const school = await insertSchool(db());
    const { session } = await signedInMember(db(), school);
    const socket = connect({
      origin: 'https://evil.example',
      cookie: cookieOf(sessionHeaders(session)),
    });
    await expect(refused(socket)).resolves.toBeInstanceOf(Error);
  });

  it('accepts a socket with no Origin and no token, which joins no rooms', async () => {
    const school = await insertSchool(db());
    const { userId } = await signedInMember(db(), school);
    const socket = connect({});
    await connected(socket);
    const events = received(socket, 'probe');
    realtime().emitTo(`tenant:${school.id}`, 'probe', { to: 'tenant' });
    realtime().emitTo(`user:${userId}`, 'probe', { to: 'user' });
    realtime().emitTo('platform', 'probe', { to: 'platform' });
    expect(await events).toEqual([]);
  });

  it('joins tenant:{id} and user:{id} with a staff session from the web origin', async () => {
    const school = await insertSchool(db());
    const { userId, session } = await signedInMember(db(), school);
    const other = await insertSchool(db());
    const socket = connect({ origin: WEB, cookie: cookieOf(sessionHeaders(session)) });
    await connected(socket);
    const events = received(socket, 'probe');
    realtime().emitTo(`tenant:${school.id}`, 'probe', { to: 'tenant' });
    realtime().emitTo(`user:${userId}`, 'probe', { to: 'user' });
    realtime().emitTo(`tenant:${other.id}`, 'probe', { to: 'other school' });
    realtime().emitTo('platform', 'probe', { to: 'platform' });
    expect(await events).toEqual([{ to: 'tenant' }, { to: 'user' }]);
  });

  it('joins only tenant:{id} in a support visit, and nothing with a sign-in step session', async () => {
    const school = await insertSchool(db());
    const staff = await insertPlatformUser(db(), 'Ruwan Mendis');
    const visit = await insertSupportVisit(db(), staff, school.id);
    const support = connect({ origin: WEB, cookie: cookieOf(sessionHeaders(visit)) });
    const pending = await insertWebSession(db(), await insertAccount(db()), { stage: 'two_step' });
    const preAuth = connect({ origin: WEB, cookie: cookieOf(sessionHeaders(pending)) });
    await Promise.all([connected(support), connected(preAuth)]);
    const supportEvents = received(support, 'probe');
    const preAuthEvents = received(preAuth, 'probe');
    realtime().emitTo(`tenant:${school.id}`, 'probe', { to: 'tenant' });
    expect(await supportEvents).toEqual([{ to: 'tenant' }]);
    expect(await preAuthEvents).toEqual([]);
  });

  it('joins platform with a console session from the console origin (Task 10)', async () => {
    const staff = await insertPlatformUser(db(), 'Amaya Perera');
    const { token } = await insertConsoleSession(db(), staff);
    const socket = connect({ origin: CONSOLE, cookie: `quad_console_sid=${token}` });
    await connected(socket);
    const events = received(socket, 'probe');
    realtime().emitTo('platform', 'probe', { to: 'platform' });
    expect(await events).toEqual([{ to: 'platform' }]);
  });

  it('ties the origin to the cookie: the console origin reads only the console cookie, the school origin only quad_sid (M6)', async () => {
    const school = await insertSchool(db());
    const { session } = await signedInMember(db(), school);
    const staff = await insertPlatformUser(db(), 'Amaya Perera');
    const consoleSession = await insertConsoleSession(db(), staff);
    const both = `${cookieOf(sessionHeaders(session))}; quad_console_sid=${consoleSession.token}`;
    const sockets = {
      staffAtConsole: connect({ origin: CONSOLE, cookie: cookieOf(sessionHeaders(session)) }),
      consoleAtSchool: connect({ origin: WEB, cookie: `quad_console_sid=${consoleSession.token}` }),
      bothAtSchool: connect({ origin: WEB, cookie: both }),
      bothAtConsole: connect({ origin: CONSOLE, cookie: both }),
    };
    await Promise.all(Object.values(sockets).map(connected));
    const events = Object.fromEntries(
      Object.entries(sockets).map(([name, socket]) => [name, received(socket, 'probe')]),
    );
    realtime().emitTo(`tenant:${school.id}`, 'probe', { to: 'tenant' });
    realtime().emitTo('platform', 'probe', { to: 'platform' });
    expect(await events.staffAtConsole).toEqual([]);
    expect(await events.consoleAtSchool).toEqual([]);
    // The positive controls: each cookie works from its own origin.
    expect(await events.bothAtSchool).toEqual([{ to: 'tenant' }]);
    expect(await events.bothAtConsole).toEqual([{ to: 'platform' }]);
  });

  it('joins nothing with a console session still at the authenticator step', async () => {
    const staff = await insertPlatformUser(db(), 'Amaya Perera');
    const active = await insertConsoleSession(db(), staff);
    const pending = await insertConsoleSession(db(), staff, { stage: 'two_step' });
    const signedIn = connect({ origin: CONSOLE, cookie: `quad_console_sid=${active.token}` });
    const atStep = connect({ origin: CONSOLE, cookie: `quad_console_sid=${pending.token}` });
    await Promise.all([connected(signedIn), connected(atStep)]);
    const signedInEvents = received(signedIn, 'probe');
    const atStepEvents = received(atStep, 'probe');
    realtime().emitTo('platform', 'probe', { to: 'platform' });
    // The signed-in socket is the positive control: the event was sent.
    expect(await signedInEvents).toEqual([{ to: 'platform' }]);
    expect(await atStepEvents).toEqual([]);
  });
});

describe("the parent app's access token in auth.token (Task 9)", () => {
  it("joins only user:{id} for a guardian: never the school's staff room", async () => {
    const school = await insertSchool(db());
    const account = await insertPhoneAccount(db());
    const userId = await insertParentMember(db(), school.id, account.id, 'guardian');
    const pair = await signedInParent(app, otpSends, account.phone);
    const socket = connect({}, pair.accessToken);
    await connected(socket);
    const events = received(socket, 'probe');
    realtime().emitTo(`tenant:${school.id}`, 'probe', { to: 'tenant' });
    realtime().emitTo(`user:${userId}`, 'probe', { to: 'user' });
    expect(await events).toEqual([{ to: 'user' }]);
  });

  it("joins nothing with a relative's token, a select_school token or a forged token", async () => {
    const school = await insertSchool(db());
    const relative = await insertPhoneAccount(db());
    const relativeId = await insertParentMember(db(), school.id, relative.id, 'relative');
    const relativePair = await signedInParent(app, otpSends, relative.phone);
    const chooser = await insertPhoneAccount(db());
    const chooserId = await insertParentMember(db(), school.id, chooser.id, 'guardian');
    await insertParentMember(db(), (await insertSchool(db())).id, chooser.id, 'guardian');
    const choosing = await signInByPhone(app, otpSends, chooser.phone);
    const sockets = [
      connect({}, relativePair.accessToken),
      connect({}, String(choosing.accessToken)),
      connect({}, `${relativePair.accessToken.slice(0, -2)}xx`),
    ];
    await Promise.all(sockets.map(connected));
    const events = sockets.map((socket) => received(socket, 'probe'));
    realtime().emitTo(`tenant:${school.id}`, 'probe', { to: 'tenant' });
    realtime().emitTo(`user:${relativeId}`, 'probe', { to: 'relative' });
    realtime().emitTo(`user:${chooserId}`, 'probe', { to: 'chooser' });
    expect(await Promise.all(events)).toEqual([[], [], []]);
  });
});

describe('roomsFor and originAllowed', () => {
  it('names the rooms of each kind of socket', () => {
    expect(roomsFor(null)).toEqual([]);
    expect(roomsFor({ kind: 'platform', platformUserId: 'p' })).toEqual(['platform']);
    expect(roomsFor({ kind: 'school', tenantId: 't', userId: null })).toEqual(['tenant:t']);
    expect(roomsFor({ kind: 'school', tenantId: 't', userId: 'u' })).toEqual([
      'tenant:t',
      'user:u',
    ]);
    expect(roomsFor({ kind: 'parent', userId: 'u' })).toEqual(['user:u']);
  });

  it('allows the two Quad origins and no Origin, and nothing else', () => {
    const allowed = [WEB, CONSOLE];
    expect(originAllowed(undefined, allowed)).toBe(true);
    expect(originAllowed(WEB, allowed)).toBe(true);
    expect(originAllowed(CONSOLE, allowed)).toBe(true);
    expect(originAllowed('https://evil.example', allowed)).toBe(false);
    expect(originAllowed(`${WEB}.evil.example`, allowed)).toBe(false);
    expect(originAllowed('null', allowed)).toBe(false);
  });
});
