import { hash, verify } from '@node-rs/argon2';

/** Argon2id parameters (spec 05; D32): OWASP's 19 MiB, two passes, one lane. */
export const ARGON2ID_PARAMETERS = { memoryCost: 19456, timeCost: 2, parallelism: 1 } as const;

/**
 * The package's default algorithm is Argon2id. It is left implicit because `Algorithm` is an
 * ambient const enum, which isolatedModules cannot read; the tests pin the `$argon2id$` prefix.
 */
const OPTIONS = ARGON2ID_PARAMETERS;

/** Hashes and checks passwords. Stored hashes are PHC strings, so they carry their parameters. */
export class PasswordHasher {
  /**
   * The hash of a random value nobody kept, with the same parameters, so `verifyDummy` costs what
   * a real check costs.
   */
  static readonly DUMMY_HASH =
    '$argon2id$v=19$m=19456,t=2,p=1$MQniMwA6c68UtSSEZt9bzA$YZ9Fo8cYmAvtFhR5zyGQ//Mg91B2K7PnVVADFYFkezU';

  hash(password: string): Promise<string> {
    return hash(password, OPTIONS);
  }

  verify(passwordHash: string, password: string): Promise<boolean> {
    return verify(passwordHash, password);
  }

  /**
   * A full verify that always refuses. Sign-in runs it when there is no account or no password,
   * so an unknown email takes as long as a wrong password (no account enumeration by timing).
   */
  async verifyDummy(password: string): Promise<false> {
    await verify(PasswordHasher.DUMMY_HASH, password);
    return false;
  }
}
