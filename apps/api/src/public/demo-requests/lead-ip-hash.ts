import { createHmac, hkdfSync } from 'node:crypto';

/** HKDF `info` for the lead IP key, so it never equals another key made from SESSION_SECRET. */
const LEAD_IP_KEY_INFO = 'quad lead ip';

/**
 * `platform_leads.ip_hash` (D57): HMAC-SHA256 of the client address under a key derived from
 * `SESSION_SECRET` with HKDF, 32 bytes. Sales can tell that two leads came from one address,
 * while the address itself is never stored, and without the secret it cannot be guessed back
 * from the hash by trying every IPv4 address.
 */
export function leadIpHasher(sessionSecret: string): (ip: string) => Buffer {
  const key = Buffer.from(hkdfSync('sha256', sessionSecret, '', LEAD_IP_KEY_INFO, 32));
  return (ip) => createHmac('sha256', key).update(ip, 'utf8').digest();
}
