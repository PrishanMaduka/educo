import { customType } from 'drizzle-orm/pg-core';

/** Case-insensitive text (the `citext` extension from the first migration). */
export const citext = customType<{ data: string }>({ dataType: () => 'citext' });

/** Raw bytes; token and code hashes are stored as 32-byte digests, never as text. */
export const bytea = customType<{ data: Buffer; driverData: Buffer }>({ dataType: () => 'bytea' });

/** An IPv4 or IPv6 address, as text in TypeScript. */
export const inet = customType<{ data: string }>({ dataType: () => 'inet' });
