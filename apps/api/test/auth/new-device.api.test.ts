import { beforeEach, describe, expect, it } from 'vitest';

import { RecordingDelivery } from '../fakes/delivery';
import { Browser } from '../helpers/browser';
import { useDatabaseApp } from '../helpers/database-app';
import { insertMember, insertSchool } from '../helpers/identity';
import { emailsTo, insertPasswordAccount, totpCode } from '../helpers/sign-in';

const T0 = Date.UTC(2026, 9, 8, 3, 30, 1);
let clock = T0;
const delivery = new RecordingDelivery();
const { db, app } = useDatabaseApp({}, { overrides: { now: () => clock, delivery } });

const CHROME_ON_WINDOWS =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0.0.0 Safari/537.36';

beforeEach(() => {
  clock = T0;
});

describe('the new-device email (spec 16, ruling F43)', () => {
  it('is queued once after a sign-in without the trusted-device cookie', async () => {
    const school = await insertSchool(db(), { timeZone: 'Asia/Colombo' });
    const account = await insertPasswordAccount(db());
    await insertMember(db(), school.id, account.id, { name: 'Prishan Maduka' });
    const browser = new Browser(app, undefined, CHROME_ON_WINDOWS);

    await browser.post('/auth/password', { email: account.email, password: account.password });

    const emails = emailsTo(delivery, account.email, 'new_device');
    expect(emails).toHaveLength(1);
    expect(emails[0]?.job).toMatchObject({
      tenantId: null,
      school: null,
      params: {
        name: 'Prishan Maduka',
        device: 'Chrome on Windows',
        signedInAt: new Date(T0).toISOString(),
        timeZone: 'Asia/Colombo',
        link: 'http://localhost:3000/app/me/sessions',
      },
    });
    // Reading the page afterwards queues nothing more.
    await browser.get('/me');
    expect(emailsTo(delivery, account.email, 'new_device')).toHaveLength(1);
  });

  it('is queued when the school is chosen, once, and not again on Switch school', async () => {
    const a = await insertSchool(db());
    const b = await insertSchool(db());
    const account = await insertPasswordAccount(db());
    await insertMember(db(), a.id, account.id);
    await insertMember(db(), b.id, account.id);
    const browser = new Browser(app);
    await browser.post('/auth/password', { email: account.email, password: account.password });
    expect(emailsTo(delivery, account.email, 'new_device')).toHaveLength(0);
    await browser.post('/auth/select-school', { tenantId: a.id });
    expect(emailsTo(delivery, account.email, 'new_device')).toHaveLength(1);
    await browser.post('/auth/select-school', { tenantId: b.id });
    expect(emailsTo(delivery, account.email, 'new_device')).toHaveLength(1);
  });

  it('is not queued with a valid trusted-device cookie', async () => {
    const school = await insertSchool(db());
    const account = await insertPasswordAccount(db(), { totp: true });
    await insertMember(db(), school.id, account.id);
    const first = new Browser(app);
    await first.post('/auth/password', { email: account.email, password: account.password });
    await first.post('/auth/totp/verify', {
      code: await totpCode(account.totpSecret ?? '', clock),
      trustDevice: true,
    });
    // That first sign-in had no trusted cookie yet, so it was emailed.
    expect(emailsTo(delivery, account.email, 'new_device')).toHaveLength(1);

    const again = new Browser(app);
    again.cookies.set('quad_trusted', first.cookies.get('quad_trusted') ?? '');
    const response = await again.post('/auth/password', {
      email: account.email,
      password: account.password,
    });
    expect(response.json()).toEqual({ next: 'done' });
    expect(emailsTo(delivery, account.email, 'new_device')).toHaveLength(1);
  });

  it('is queued when the trusted-device cookie is expired or not a real one', async () => {
    const school = await insertSchool(db());
    const account = await insertPasswordAccount(db(), { totp: true });
    await insertMember(db(), school.id, account.id);
    const first = new Browser(app);
    await first.post('/auth/password', { email: account.email, password: account.password });
    await first.post('/auth/totp/verify', {
      code: await totpCode(account.totpSecret ?? '', clock),
      trustDevice: true,
    });
    const trusted = first.cookies.get('quad_trusted') ?? '';

    clock = T0 + 31 * 24 * 60 * 60 * 1000;
    const late = new Browser(app);
    late.cookies.set('quad_trusted', trusted);
    const lateResponse = await late.post('/auth/password', {
      email: account.email,
      password: account.password,
    });
    expect(lateResponse.json()).toEqual({ next: 'two_step' });
    await late.post('/auth/totp/verify', { code: await totpCode(account.totpSecret ?? '', clock) });
    expect(emailsTo(delivery, account.email, 'new_device')).toHaveLength(2);

    const forged = new Browser(app);
    forged.cookies.set('quad_trusted', 'x'.repeat(43));
    await forged.post('/auth/password', { email: account.email, password: account.password });
    await forged.post('/auth/totp/verify', {
      code: await totpCode(account.totpSecret ?? '', clock),
    });
    expect(emailsTo(delivery, account.email, 'new_device')).toHaveLength(3);
  });
});
