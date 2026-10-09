import { randomUUID } from 'node:crypto';

import { Controller, Get, Module } from '@nestjs/common';
import pino from 'pino';
import { beforeEach, describe, expect, it } from 'vitest';

import { createApp } from '../../src/app';
import { Public } from '../../src/common/guards/public.decorator';
import { loadConfig } from '../../src/config';
import { API_ROUTES } from '../../src/openapi/document';
import { localEnv } from '../env';
import { Browser } from '../helpers/browser';
import { useDatabaseApp } from '../helpers/database-app';
import { CONSOLE_CSRF, CONSOLE_SID, insertConsoleUser, signInToConsole } from '../helpers/platform';

const T0 = Date.UTC(2026, 9, 9, 3, 30, 1);
let clock = T0;
const { db, app } = useDatabaseApp({}, { overrides: { now: () => clock } });

beforeEach(() => {
  clock = T0;
});

describe('a console cookie on school routes (D28 ruling R-console-realtime)', () => {
  it('answers 401 on every route that needs a session outside /platform, under either cookie name', async () => {
    const console = await signInToConsole(app, await insertConsoleUser(db()), clock);
    const token = String(console.cookies.get(CONSOLE_SID));
    const csrf = String(console.cookies.get(CONSOLE_CSRF));
    const checked: string[] = [];
    for (const route of API_ROUTES) {
      if (route.path.startsWith('/platform/')) continue;
      const url = route.path.replace(/\{\w+\}/g, randomUUID());
      const method = route.method.toUpperCase() as 'GET' | 'POST' | 'PATCH' | 'DELETE';
      const anonymous = await new Browser(app).request(method, url);
      if (anonymous.statusCode !== 401) continue; // a public route: no session is read
      for (const cookie of [`${CONSOLE_SID}=${token}`, `quad_sid=${token}`]) {
        const response = await new Browser(app).request(method, url, undefined, {
          headers: { cookie: `${cookie}; quad_csrf=${csrf}`, 'x-csrf-token': csrf },
        });
        expect({ route: `${method} ${url}`, cookie, status: response.statusCode }).toEqual({
          route: `${method} ${url}`,
          cookie,
          status: 401,
        });
      }
      checked.push(`${method} ${route.path}`);
    }
    expect(checked).toEqual(
      expect.arrayContaining([
        'GET /me',
        'PATCH /me',
        'GET /me/sessions',
        'GET /auth/memberships',
        'POST /auth/select-school',
        'POST /auth/sign-out',
      ]),
    );
    // The positive control: the same cookie is a live console session.
    expect((await console.get('/platform/me')).statusCode).toBe(200);
  });
});

@Controller('platform/rogue')
class RogueSchoolController {
  // Marked, so only the console rule (not the route walk) refuses it.
  @Get()
  @Public()
  get(): { ok: true } {
    return { ok: true };
  }
}

@Module({ controllers: [RogueSchoolController] })
class RogueModule {}

describe('a school controller under platform/', () => {
  it('stops the API from starting', async () => {
    const config = loadConfig(
      localEnv({ DATABASE_URL: db().appUrl, DATABASE_PLATFORM_URL: db().platformUrl }),
    );
    const started = createApp(config, {
      logger: pino({ level: 'silent' }),
      overrides: { testModules: [RogueModule] },
    }).then(async (made) => {
      await made.close();
      return 'started';
    });
    await expect(started).rejects.toThrow(
      'RogueSchoolController.get serves platform/rogue without @PlatformController()',
    );
  });
});
