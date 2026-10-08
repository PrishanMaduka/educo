import { describe, expect, it } from 'vitest';

import { OfflineBreachCheck } from '../../src/common/crypto/breach-check';
import { PasswordHasher } from '../../src/common/crypto/passwords';
import { SignedLinks } from '../../src/common/crypto/signed-links';
import { BREACH_CHECK, FIELD_CIPHER, JWT_KEYS } from '../../src/tokens';
import { CLOSED_PORTS, useTestApp } from '../app';

import type { BreachCheck } from '../../src/common/crypto/breach-check';
import type { JwtKeys } from '../../src/common/crypto/jwt-keys';
import type { FieldCipher } from '@quad/db';

const app = useTestApp(CLOSED_PORTS);

describe('CryptoModule', () => {
  it('provides the field cipher from FIELD_ENCRYPTION_KEY', async () => {
    const cipher = app().get<symbol, FieldCipher>(FIELD_CIPHER);
    expect(await cipher.decrypt(await cipher.encrypt('JBSWY3DPEHPK3PXP'))).toBe('JBSWY3DPEHPK3PXP');
  });

  it('provides the Ed25519 token keys', () => {
    const keys = app().get<symbol, JwtKeys>(JWT_KEYS);
    expect(keys.algorithm).toBe('EdDSA');
    expect(keys.privateKey.asymmetricKeyType).toBe('ed25519');
  });

  it('provides the offline breach check locally (OQ14)', async () => {
    const check = app().get<symbol, BreachCheck>(BREACH_CHECK);
    expect(check).toBeInstanceOf(OfflineBreachCheck);
    await expect(check.isBreached('password123')).resolves.toBe(true);
  });

  it('provides the password hasher and signed links', () => {
    expect(app().get(PasswordHasher)).toBeInstanceOf(PasswordHasher);
    const links = app().get(SignedLinks);
    const token = links.signLink(
      {
        purpose: 'calendar_feed',
        tid: '0192f0c4-7a3b-7c2d-8e9f-0a1b2c3d4e5f',
        sub: '0192f0c4-7a3b-7c2d-8e9f-0a1b2c3d4e60',
      },
      new Date('2026-10-08T09:00:00Z'),
    );
    expect(token).toMatch(/^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]{43}$/);
  });
});
