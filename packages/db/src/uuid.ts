import { randomBytes } from 'node:crypto';

const MAX_UNIX_MS = 2 ** 48 - 1;

/**
 * A UUID version 7 (RFC 9562): 48-bit Unix milliseconds, then random bits, so ids sort by
 * creation time (spec 04, Conventions). Ids made within the same millisecond are random
 * relative to each other.
 */
export function uuidv7(now: number = Date.now()): string {
  if (!Number.isInteger(now) || now < 0 || now > MAX_UNIX_MS) {
    throw new RangeError('uuidv7 needs a whole number of Unix milliseconds that fits in 48 bits.');
  }
  const bytes = randomBytes(16);
  bytes.writeUIntBE(now, 0, 6);
  bytes.writeUInt8((bytes.readUInt8(6) & 0x0f) | 0x70, 6);
  bytes.writeUInt8((bytes.readUInt8(8) & 0x3f) | 0x80, 8);
  const hex = bytes.toString('hex');
  return [
    hex.slice(0, 8),
    hex.slice(8, 12),
    hex.slice(12, 16),
    hex.slice(16, 20),
    hex.slice(20),
  ].join('-');
}
