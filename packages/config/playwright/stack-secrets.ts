import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { parseEnv } from 'node:util';

const ENV_EXAMPLE = fileURLToPath(new URL('../../../.env.example', import.meta.url));

/**
 * The local values the stack runs with: the seed password and link-signing secret come from
 * `.env.example`, as the stack takes them (never from `.env` or the shell).
 */
export function stackSecrets(): {
  readonly seedPassword: string;
  readonly linkSigningSecret: string;
} {
  const example = parseEnv(readFileSync(ENV_EXAMPLE, 'utf8'));
  const seedPassword = example.SEED_PASSWORD;
  const linkSigningSecret = example.LINK_SIGNING_SECRET;
  if (seedPassword === undefined || linkSigningSecret === undefined) {
    throw new Error('.env.example must set SEED_PASSWORD and LINK_SIGNING_SECRET.');
  }
  return { seedPassword, linkSigningSecret };
}
