import { createHash, createHmac, pbkdf2Sync, randomBytes } from 'node:crypto';

const ITERATIONS = 4096;
const PRINTABLE_ASCII = /^[\x20-\x7e]+$/;

const hmac = (key: Buffer, text: string): Buffer => createHmac('sha256', key).update(text).digest();

/**
 * The SCRAM-SHA-256 verifier PostgreSQL stores for `password` (RFC 5802/7677, the format of
 * `pg_authid.rolpassword`), so `ALTER ROLE … PASSWORD` never sends the plaintext. There is no
 * SASLprep here, so only printable ASCII is accepted, where SASLprep changes nothing.
 */
export function scramSha256Verifier(password: string, salt: Buffer = randomBytes(16)): string {
  if (!PRINTABLE_ASCII.test(password)) {
    throw new Error('Database passwords must be printable ASCII and not empty.');
  }
  const salted = pbkdf2Sync(password, salt, ITERATIONS, 32, 'sha256');
  const storedKey = createHash('sha256').update(hmac(salted, 'Client Key')).digest();
  const serverKey = hmac(salted, 'Server Key');
  return (
    `SCRAM-SHA-256$${ITERATIONS}:${salt.toString('base64')}` +
    `$${storedKey.toString('base64')}:${serverKey.toString('base64')}`
  );
}
