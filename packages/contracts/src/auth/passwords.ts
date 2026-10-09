/**
 * Argon2id parameters for every stored password (spec 05; D32): OWASP's 19 MiB, two passes, one
 * lane. The API's `PasswordHasher` and the seed (`packages/db`) hash with these, so a seeded
 * password is stored exactly as one set in the app would be.
 */
export const ARGON2ID_PARAMETERS = Object.freeze({
  memoryCost: 19456,
  timeCost: 2,
  parallelism: 1,
} as const);
