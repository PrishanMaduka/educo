import { describe, expect, it } from 'vitest';

import { ARGON2ID_PARAMETERS, PasswordHasher } from '../../src/common/crypto/passwords';

const PASSWORD = 'correct horse battery staple';

describe('PasswordHasher (Argon2id)', () => {
  const hasher = new PasswordHasher();

  it('uses m=19456, t=2, p=1 (spec 05; D32)', async () => {
    expect(ARGON2ID_PARAMETERS).toEqual({ memoryCost: 19456, timeCost: 2, parallelism: 1 });
    const hash = await hasher.hash(PASSWORD);
    expect(hash).toMatch(/^\$argon2id\$v=19\$m=19456,t=2,p=1\$/);
    expect(hash).not.toContain(PASSWORD);
  });

  it('verifies the right password', async () => {
    const hash = await hasher.hash(PASSWORD);
    await expect(hasher.verify(hash, PASSWORD)).resolves.toBe(true);
  });

  it('refuses a wrong password', async () => {
    const hash = await hasher.hash(PASSWORD);
    await expect(hasher.verify(hash, `${PASSWORD}!`)).resolves.toBe(false);
    await expect(hasher.verify(hash, '')).resolves.toBe(false);
  });

  it('salts every hash', async () => {
    expect(await hasher.hash(PASSWORD)).not.toBe(await hasher.hash(PASSWORD));
  });

  it('verifyDummy does a full verify with the same parameters and always refuses', async () => {
    expect(PasswordHasher.DUMMY_HASH).toMatch(/^\$argon2id\$v=19\$m=19456,t=2,p=1\$/);
    await expect(hasher.verifyDummy(PASSWORD)).resolves.toBe(false);
    await expect(hasher.verifyDummy('')).resolves.toBe(false);
  });
});
