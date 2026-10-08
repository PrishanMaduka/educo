import { generateKeyPairSync, sign, verify } from 'node:crypto';

import { describe, expect, it } from 'vitest';

import { JwtKeyError, loadJwtKeys } from '../../src/common/crypto/jwt-keys';
import { LOCAL_DEV_SECRETS } from '../../src/config';
import { TEST_JWT_KEYS } from '../env';

/** The error `loadJwtKeys` throws for this pair, or undefined. */
function loadError(privatePem: string, publicPem: string): unknown {
  try {
    loadJwtKeys(privatePem, publicPem);
  } catch (error) {
    return error;
  }
  return undefined;
}

describe('loadJwtKeys (EdDSA, Ed25519)', () => {
  it('loads a matching pair that signs and verifies', () => {
    const keys = loadJwtKeys(TEST_JWT_KEYS.JWT_PRIVATE_KEY, TEST_JWT_KEYS.JWT_PUBLIC_KEY);
    expect(keys.algorithm).toBe('EdDSA');
    const data = Buffer.from('header.payload');
    const signature = sign(null, data, keys.privateKey);
    expect(verify(null, data, keys.publicKey, signature)).toBe(true);
  });

  it('loads the published local pair from .env.example', () => {
    expect(() =>
      loadJwtKeys(LOCAL_DEV_SECRETS.JWT_PRIVATE_KEY, LOCAL_DEV_SECRETS.JWT_PUBLIC_KEY),
    ).not.toThrow();
  });

  it('refuses a public key from another pair', () => {
    const other = generateKeyPairSync('ed25519').publicKey.export({ type: 'spki', format: 'pem' });
    const error = loadError(TEST_JWT_KEYS.JWT_PRIVATE_KEY, other.toString());
    expect(error).toBeInstanceOf(JwtKeyError);
    expect(error).toMatchObject({ variable: 'JWT_PUBLIC_KEY' });
  });

  it('refuses a key of another type, naming the variable', () => {
    const ec = generateKeyPairSync('ec', { namedCurve: 'P-256' });
    const error = loadError(
      ec.privateKey.export({ type: 'pkcs8', format: 'pem' }).toString(),
      TEST_JWT_KEYS.JWT_PUBLIC_KEY,
    );
    expect(error).toBeInstanceOf(JwtKeyError);
    expect(error).toMatchObject({ variable: 'JWT_PRIVATE_KEY' });
  });

  it('refuses a private key given as the public key', () => {
    const error = loadError(TEST_JWT_KEYS.JWT_PRIVATE_KEY, TEST_JWT_KEYS.JWT_PRIVATE_KEY);
    expect(error).toBeInstanceOf(JwtKeyError);
    expect(error).toMatchObject({ variable: 'JWT_PUBLIC_KEY' });
  });
});
