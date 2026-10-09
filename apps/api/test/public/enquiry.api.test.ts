import { randomBytes } from 'node:crypto';

import { afterEach, describe, expect, it, vi } from 'vitest';

import { TENANT_DB } from '../../src/tokens';
import { Browser } from '../helpers/browser';
import { useDatabaseApp } from '../helpers/database-app';

import type { QuadTenantDb } from '@quad/db';

const { app } = useDatabaseApp();

afterEach(() => {
  vi.restoreAllMocks();
});

const enquiry = { parentName: 'Dilani Perera', email: 'dilani@example.test' };
/** A key no school has: every key until M4, when `tenant_by_embed_key` gets its body. */
const forgedKey = () => `forged_${randomBytes(6).toString('hex')}`;

describe('POST /public/enquiry/:embedKey (the stub until M4)', () => {
  it('answers 404 not_found for an unknown (forged) key, after asking tenant_by_embed_key', async () => {
    const definers = app().get<symbol, QuadTenantDb>(TENANT_DB).definers;
    const lookup = vi.spyOn(definers, 'tenantByEmbedKey');
    const key = forgedKey();

    const response = await new Browser(app).post(`/public/enquiry/${key}`, enquiry);

    expect(response.statusCode).toBe(404);
    expect(response.json()).toMatchObject({ code: 'not_found' });
    expect(lookup).toHaveBeenCalledWith(key);
  });

  it('answers 404 for a key that would name a school until the form can be stored (M4)', async () => {
    const definers = app().get<symbol, QuadTenantDb>(TENANT_DB).definers;
    vi.spyOn(definers, 'tenantByEmbedKey').mockResolvedValue({
      tenantId: '0192a6f4-1b2c-7d3e-8f40-123456789abd',
      formId: '0192a6f4-1b2c-7d3e-8f40-123456789abe',
      active: true,
    });
    const response = await new Browser(app).post(`/public/enquiry/${forgedKey()}`, enquiry);
    expect(response.statusCode).toBe(404);
  });

  it.each([
    [{ ...enquiry, email: 'not-an-address' }, 'email'],
    [{ email: 'dilani@example.test' }, 'parentName'],
    [{ ...enquiry, tenantId: '0192a6f4-1b2c-7d3e-8f40-123456789abd' }, '_root'],
  ])('answers 400 validation for %j', async (body, field) => {
    const response = await new Browser(app).post(`/public/enquiry/${forgedKey()}`, body);
    expect(response.statusCode).toBe(400);
    expect(response.json()).toMatchObject({
      code: 'validation',
      fields: { [field]: expect.any(String) as unknown },
    });
  });

  it('answers 400 validation for a malformed key', async () => {
    const response = await new Browser(app).post('/public/enquiry/bad', enquiry);
    expect(response.statusCode).toBe(400);
    expect(response.json()).toMatchObject({ code: 'validation' });
  });

  it('answers 429 rate_limited after 20 enquiries a minute from one address', async () => {
    const browser = new Browser(app);
    for (let sent = 0; sent < 20; sent += 1) {
      expect((await browser.post(`/public/enquiry/${forgedKey()}`, enquiry)).statusCode).toBe(404);
    }
    const limited = await browser.post(`/public/enquiry/${forgedKey()}`, enquiry);
    expect(limited.statusCode).toBe(429);
    expect(limited.json()).toMatchObject({ code: 'rate_limited' });
    expect(limited.headers['retry-after']).toBeDefined();
    // Another address has its own bucket.
    expect(
      (await new Browser(app).post(`/public/enquiry/${forgedKey()}`, enquiry)).statusCode,
    ).toBe(404);
  });
});
