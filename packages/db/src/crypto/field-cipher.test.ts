import { describe, expect, it } from 'vitest';

import {
  FIELD_ENCRYPTION_KEY_MIN_LENGTH,
  FieldCipherError,
  createFieldCipher,
} from './field-cipher';

const KEY = 'test-field-encryption-key-0123456789abcdef';
const OTHER_KEY = 'another-field-encryption-key-0123456789abcd';
const TOTP_SECRET = 'JBSWY3DPEHPK3PXP';

/** Replaces the character at `index` of a base64url string with a different one. */
function flipChar(value: string, index: number): string {
  const replacement = value[index] === 'A' ? 'B' : 'A';
  return value.slice(0, index) + replacement + value.slice(index + 1);
}

describe('FieldCipher (AES-256-GCM, key by HKDF-SHA256)', () => {
  const cipher = createFieldCipher(KEY);

  it('round-trips a TOTP secret', async () => {
    const sealed = await cipher.encrypt(TOTP_SECRET);
    expect(await cipher.decrypt(sealed)).toBe(TOTP_SECRET);
  });

  it('writes v1.<iv>.<ciphertext>.<tag> in base64url, with a 96-bit iv and a 128-bit tag', async () => {
    const sealed = await cipher.encrypt(TOTP_SECRET);
    const parts = sealed.split('.');
    expect(parts).toHaveLength(4);
    const [version, iv, ciphertext, tag] = parts;
    expect(version).toBe('v1');
    expect(Buffer.from(iv ?? '', 'base64url')).toHaveLength(12);
    expect(Buffer.from(ciphertext ?? '', 'base64url')).toHaveLength(TOTP_SECRET.length);
    expect(Buffer.from(tag ?? '', 'base64url')).toHaveLength(16);
    expect(sealed).not.toContain(TOTP_SECRET);
  });

  it('uses a fresh iv every time, so equal values never look equal', async () => {
    expect(await cipher.encrypt(TOTP_SECRET)).not.toBe(await cipher.encrypt(TOTP_SECRET));
  });

  it('round-trips an empty string and non-ASCII text', async () => {
    expect(await cipher.decrypt(await cipher.encrypt(''))).toBe('');
    expect(await cipher.decrypt(await cipher.encrypt('ශ්‍රී ලංකා 🔑'))).toBe('ශ්‍රී ලංකා 🔑');
  });

  it('refuses a changed tag', async () => {
    const [version, iv, ciphertext, tag] = (await cipher.encrypt(TOTP_SECRET)).split('.');
    const tampered = [version, iv, ciphertext, flipChar(tag ?? '', 0)].join('.');
    await expect(cipher.decrypt(tampered)).rejects.toBeInstanceOf(FieldCipherError);
  });

  it('refuses a changed ciphertext', async () => {
    const [version, iv, ciphertext, tag] = (await cipher.encrypt(TOTP_SECRET)).split('.');
    const tampered = [version, iv, flipChar(ciphertext ?? '', 0), tag].join('.');
    await expect(cipher.decrypt(tampered)).rejects.toBeInstanceOf(FieldCipherError);
  });

  it('refuses a value sealed under another key', async () => {
    const sealed = await createFieldCipher(OTHER_KEY).encrypt(TOTP_SECRET);
    await expect(cipher.decrypt(sealed)).rejects.toBeInstanceOf(FieldCipherError);
  });

  it.each([
    ['plain text', TOTP_SECRET],
    ['an unknown version', 'v2.AAAAAAAAAAAAAAAA.AAAA.AAAAAAAAAAAAAAAAAAAAAA'],
    ['too few parts', 'v1.AAAAAAAAAAAAAAAA.AAAA'],
    ['a short iv', 'v1.AAAA.AAAA.AAAAAAAAAAAAAAAAAAAAAA'],
    ['a short tag', 'v1.AAAAAAAAAAAAAAAA.AAAA.AAAA'],
    ['characters outside base64url', 'v1.AAAAAAAAAAAAAAAA.AA+A.AAAAAAAAAAAAAAAAAAAAAA'],
  ])('refuses %s', async (_name, value) => {
    await expect(cipher.decrypt(value)).rejects.toBeInstanceOf(FieldCipherError);
  });

  it('never puts the value or the key in its error message', async () => {
    const error = await cipher.decrypt(`v1.${TOTP_SECRET}`).catch((e: unknown) => e);
    expect(error).toBeInstanceOf(FieldCipherError);
    expect(String(error)).not.toContain(TOTP_SECRET);
    expect(String(error)).not.toContain(KEY);
  });

  it(`refuses a key shorter than ${FIELD_ENCRYPTION_KEY_MIN_LENGTH} characters`, () => {
    expect(FIELD_ENCRYPTION_KEY_MIN_LENGTH).toBe(32);
    expect(() => createFieldCipher('k'.repeat(31))).toThrow(/at least 32 characters/);
    expect(() => createFieldCipher('k'.repeat(32))).not.toThrow();
  });
});
