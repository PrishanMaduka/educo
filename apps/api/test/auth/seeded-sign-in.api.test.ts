import { Me } from '@quad/contracts';
import { SEED_PEOPLE, SEED_PLATFORM_USERS, SEED_TENANTS } from '@quad/db';
import { seedDatabase } from '@quad/db/testing';
import { beforeAll, describe, expect, it } from 'vitest';

import { localEnv } from '../env';
import { Browser } from '../helpers/browser';
import { useDatabaseApp } from '../helpers/database-app';
import { consoleBrowser } from '../helpers/platform';

/**
 * The seeded local accounts sign in as CLAUDE.md promises (Task 17; journey 17 runs the same in
 * the browser): staff with `SEED_PASSWORD` and the local fixed code, Ruwan through the school
 * picker, and the platform owner on the console.
 */

const SEED_PASSWORD = 'seeded-sign-in-test-password';
const { db, app } = useDatabaseApp({ DEV_FIXED_OTP: '000000' });

beforeAll(async () => {
  await seedDatabase(
    db().ownerUrl,
    { password: SEED_PASSWORD, fieldEncryptionKey: localEnv().FIELD_ENCRYPTION_KEY ?? '' },
    'local',
  );
});

/** Signs `email` in up to the end of two-step and answers what came next. */
async function signIn(browser: Browser, email: string): Promise<unknown> {
  const password = await browser.post('/auth/password', { email, password: SEED_PASSWORD });
  expect(password.json()).toEqual({ next: 'two_step' });
  const code = await browser.post('/auth/totp/verify', { code: '000000' });
  expect(code.statusCode).toBe(200);
  return code.json();
}

describe('the seeded accounts', () => {
  it('signs the CIS admin straight into Colombo International School', async () => {
    const browser = new Browser(app);
    expect(await signIn(browser, SEED_PEOPLE.prishan.email)).toEqual({ next: 'done' });
    const me = Me.parse((await browser.get('/me')).json());
    expect(me.person.name).toBe('Prishan Maduka');
    expect(me.school).toMatchObject({ id: SEED_TENANTS.colomboIntl.id, shortName: 'CIS' });
  });

  it('shows Ruwan the school picker, and either school opens', async () => {
    const browser = new Browser(app);
    expect(await signIn(browser, SEED_PEOPLE.ruwan.email)).toEqual({ next: 'choose_school' });
    const pick = await browser.post('/auth/select-school', {
      tenantId: SEED_TENANTS.kandyHill.id,
    });
    expect(pick.statusCode).toBe(204);
    expect(Me.parse((await browser.get('/me')).json()).school.name).toBe('Kandy Hill Academy');
  });

  it('refuses a wrong password for a seeded account', async () => {
    const response = await new Browser(app).post('/auth/password', {
      email: SEED_PEOPLE.nadeesha.email,
      password: 'not-the-seed-password',
    });
    expect(response.statusCode).toBe(401);
  });

  it('signs the platform owner in to the console with SEED_PASSWORD and the local code', async () => {
    const browser = consoleBrowser(app);
    const password = await browser.post('/platform/auth/password', {
      email: SEED_PLATFORM_USERS.owner.email,
      password: SEED_PASSWORD,
    });
    expect(password.json()).toEqual({ next: 'two_step' });
    const code = await browser.post('/platform/auth/totp/verify', { code: '000000' });
    expect(code.statusCode).toBe(200);
  });
});
