import { createCipheriv, createDecipheriv, hkdfSync, randomBytes } from 'node:crypto';

/**
 * Field-level encryption for secrets stored in rows (TOTP secrets now; school gateway
 * credentials later). It lives here, not in the API, so the API and the seed share one
 * implementation (ruling R-fieldcipher). Callers depend on the `FieldCipher` interface: M12's KMS
 * adapter (`KMS_KEY_ID`) replaces the key-based cipher behind it (D32), which is why the methods
 * are async.
 */
export interface FieldCipher {
  /** Seals `plaintext` as `v1.<iv>.<ciphertext>.<tag>` (base64url parts). */
  encrypt(plaintext: string): Promise<string>;
  /** Opens a value from `encrypt`; throws `FieldCipherError` if it was changed or is not ours. */
  decrypt(sealed: string): Promise<string>;
}

/** `FIELD_ENCRYPTION_KEY` must have at least this many characters. */
export const FIELD_ENCRYPTION_KEY_MIN_LENGTH = 32;

/** A sealed value that cannot be opened. The message never includes the value or the key. */
export class FieldCipherError extends Error {
  constructor(message = 'The encrypted value could not be decrypted.') {
    super(message);
    this.name = 'FieldCipherError';
  }
}

const VERSION = 'v1';
const ALGORITHM = 'aes-256-gcm';
const IV_BYTES = 12;
const TAG_BYTES = 16;
/** HKDF context: changing it (or the version) gives a different key, so keep both fixed for v1. */
const HKDF_SALT = 'quad-field-cipher';
const HKDF_INFO = 'quad/field-cipher/v1/aes-256-gcm';
const BASE64URL = /^[A-Za-z0-9_-]*$/;

function decodePart(part: string, bytes?: number): Buffer {
  if (!BASE64URL.test(part)) {
    throw new FieldCipherError();
  }
  const decoded = Buffer.from(part, 'base64url');
  if (bytes !== undefined && decoded.length !== bytes) {
    throw new FieldCipherError();
  }
  return decoded;
}

/**
 * The key-based cipher: AES-256-GCM with a 96-bit random iv, under a key derived by
 * HKDF-SHA256 from `FIELD_ENCRYPTION_KEY` (at least 32 characters).
 */
export function createFieldCipher(fieldEncryptionKey: string): FieldCipher {
  if (fieldEncryptionKey.length < FIELD_ENCRYPTION_KEY_MIN_LENGTH) {
    throw new FieldCipherError(
      `FIELD_ENCRYPTION_KEY must be at least ${FIELD_ENCRYPTION_KEY_MIN_LENGTH} characters.`,
    );
  }
  const key = Buffer.from(hkdfSync('sha256', fieldEncryptionKey, HKDF_SALT, HKDF_INFO, 32));
  // The work is synchronous; `then` turns a throw into a rejection, as an async adapter would.
  return {
    encrypt: (plaintext) => Promise.resolve().then(() => seal(key, plaintext)),
    decrypt: (sealed) => Promise.resolve().then(() => open(key, sealed)),
  };
}

function seal(key: Buffer, plaintext: string): string {
  const iv = randomBytes(IV_BYTES);
  const cipher = createCipheriv(ALGORITHM, key, iv, { authTagLength: TAG_BYTES });
  const ciphertext = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  const parts = [iv, ciphertext, cipher.getAuthTag()].map((part) => part.toString('base64url'));
  return [VERSION, ...parts].join('.');
}

function open(key: Buffer, sealed: string): string {
  const parts = sealed.split('.');
  if (parts.length !== 4 || parts[0] !== VERSION) {
    throw new FieldCipherError();
  }
  const iv = decodePart(parts[1] ?? '', IV_BYTES);
  const ciphertext = decodePart(parts[2] ?? '');
  const tag = decodePart(parts[3] ?? '', TAG_BYTES);
  try {
    const decipher = createDecipheriv(ALGORITHM, key, iv, { authTagLength: TAG_BYTES });
    decipher.setAuthTag(tag);
    return Buffer.concat([decipher.update(ciphertext), decipher.final()]).toString('utf8');
  } catch {
    // GCM authentication failed: the value was changed or sealed under another key.
    throw new FieldCipherError();
  }
}
