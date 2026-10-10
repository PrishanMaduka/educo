import { PlatformTotpSetup, TotpSetupResult } from '@quad/contracts';
import { SEED_PEOPLE, SEED_PLATFORM_USERS } from '@quad/db';
import { seedDatabase } from '@quad/db/testing';
import { beforeAll, describe, expect, it } from 'vitest';

import { localEnv } from '../env';
import { Browser } from '../helpers/browser';
import { useDatabaseApp } from '../helpers/database-app';
import { consoleBrowser } from '../helpers/platform';
import { totpCode } from '../helpers/sign-in';

/**
 * The staging seed leaves the sample people without an authenticator (D55), so their first
 * sign-in sets two-step up: a QR code and key, then the first code, which turns it on and
 * shows the recovery codes. No fixed code here, as on staging.
 */

const SEED_PASSWORD = 'staging-seeded-sign-in-test-password';
const T0 = Date.UTC(2026, 9, 8, 3, 30, 1);
const { db, app } = useDatabaseApp({}, { overrides: { now: () => T0 } });

beforeAll(async () => {
  await seedDatabase(
    db().ownerUrl,
    { password: SEED_PASSWORD, fieldEncryptionKey: localEnv().FIELD_ENCRYPTION_KEY ?? '' },
    'staging',
  );
});

const secretOf = (otpauthUri: string): string =>
  new URL(otpauthUri).searchParams.get('secret') ?? '';

describe('the staging-seeded accounts (D55)', () => {
  it('asks the CIS admin to set up two-step, and the first code signs her in', async () => {
    const browser = new Browser(app);
    const password = await browser.post('/auth/password', {
      email: SEED_PEOPLE.prishan.email,
      password: SEED_PASSWORD,
    });
    expect(password.json()).toEqual({ next: 'two_step_setup' });

    const start = TotpSetupResult.parse((await browser.post('/me/totp', {})).json());
    const confirm = await browser.post('/me/totp', {
      code: await totpCode(secretOf(start.otpauthUri ?? ''), T0),
    });

    expect(confirm.statusCode).toBe(200);
    const confirmed = TotpSetupResult.parse(confirm.json());
    expect(confirmed.recoveryCodes).toHaveLength(10);
    expect(confirmed.next).toBe('done');
  });

  it('asks Ruwan (CIS staff rule, KHA admins rule) to set up two-step too', async () => {
    const password = await new Browser(app).post('/auth/password', {
      email: SEED_PEOPLE.ruwan.email,
      password: SEED_PASSWORD,
    });
    expect(password.json()).toEqual({ next: 'two_step_setup' });
  });

  it('asks the platform owner to set up two-step on the console', async () => {
    const browser = consoleBrowser(app);
    const password = await browser.post('/platform/auth/password', {
      email: SEED_PLATFORM_USERS.owner.email,
      password: SEED_PASSWORD,
    });
    expect(password.json()).toEqual({ next: 'two_step_setup' });

    const setup = PlatformTotpSetup.parse((await browser.post('/platform/auth/totp/setup')).json());
    const verify = await browser.post('/platform/auth/totp/verify', {
      code: await totpCode(setup.secret, T0),
    });
    expect(verify.json()).toEqual({ next: 'done' });
  });
});
