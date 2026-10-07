import { z } from 'zod';

/** An unset or empty variable (`NAME=` in .env) counts as missing, so the default applies. */
const optional = <T extends z.ZodTypeAny>(schema: T) =>
  z.preprocess((value) => (value === '' ? undefined : value), schema.optional());

/**
 * Public variables the web apps read at build time (spec 02 "Web public (build time)"). All optional for now,
 * with local defaults; staging and production set them in CI.
 */
export const WebPublicEnvSchema = z.object({
  NEXT_PUBLIC_APP_ENV: optional(z.enum(['local', 'staging', 'production'])).transform(
    (value) => value ?? 'local',
  ),
  /** Origin of the API that `/api/v1/*` is proxied to. */
  NEXT_PUBLIC_API_URL: optional(z.string().url()).transform(
    (value) => value ?? 'http://localhost:4000',
  ),
  NEXT_PUBLIC_SENTRY_DSN: optional(z.string().url()),
  NEXT_PUBLIC_TURNSTILE_SITE_KEY: optional(z.string()),
  NEXT_PUBLIC_PLAUSIBLE_DOMAIN: optional(z.string()),
});

export type WebPublicEnv = z.infer<typeof WebPublicEnvSchema>;

/** Parses the public variables, or throws with every problem listed (the build stops). */
export function parseWebPublicEnv(source: Record<string, string | undefined>): WebPublicEnv {
  const result = WebPublicEnvSchema.safeParse(source);
  if (!result.success) {
    const problems = result.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`);
    throw new Error(`Invalid public environment variables:\n  ${problems.join('\n  ')}`);
  }
  return result.data;
}
