import { z } from 'zod';

/** An unset or empty variable (`NAME=` in .env) counts as missing, so the default applies. */
const optional = <T extends z.ZodTypeAny>(schema: T) =>
  z.preprocess((value) => (value === '' ? undefined : value), schema.optional());

/** An http(s) origin such as `https://quad-edu.com`: no path, query, fragment or credentials. A trailing `/` is dropped. */
const origin = z
  .string()
  .url()
  .refine(
    (value) => {
      // Zod still runs this after .url() has failed, so a bad string must not throw here.
      if (!URL.canParse(value)) return true;
      const url = new URL(value);
      return (
        (url.protocol === 'http:' || url.protocol === 'https:') &&
        url.pathname === '/' &&
        !url.search &&
        !url.hash &&
        !url.username &&
        !url.password &&
        !value.includes('?') &&
        !value.includes('#')
      );
    },
    { message: 'Must be an http(s) origin with no path, for example https://quad-edu.com' },
  )
  .transform((value) => (URL.canParse(value) ? new URL(value).origin : value));

/**
 * Public variables the web apps read at build time (spec 02 "Web public (build time)"). Locally they are all
 * optional with defaults; staging and production must name the API origin (no localhost fallback).
 */
export const WebPublicEnvSchema = z
  .object({
    NEXT_PUBLIC_APP_ENV: optional(z.enum(['local', 'staging', 'production'])).transform(
      (value) => value ?? 'local',
    ),
    /** Origin of the API that `/api/v1/*` is proxied to. */
    NEXT_PUBLIC_API_URL: optional(origin),
    NEXT_PUBLIC_SENTRY_DSN: optional(z.string().url()),
    NEXT_PUBLIC_TURNSTILE_SITE_KEY: optional(z.string()),
    NEXT_PUBLIC_PLAUSIBLE_DOMAIN: optional(z.string()),
  })
  .superRefine((env, ctx) => {
    if (env.NEXT_PUBLIC_APP_ENV !== 'local' && env.NEXT_PUBLIC_API_URL === undefined) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['NEXT_PUBLIC_API_URL'],
        message: `Required when NEXT_PUBLIC_APP_ENV is ${env.NEXT_PUBLIC_APP_ENV}`,
      });
    }
  })
  .transform((env) => ({
    ...env,
    NEXT_PUBLIC_API_URL: env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000',
  }));

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

/** The surfaces that answer on the public internet (spec 20, edge). */
export type RobotsSurface = 'staff' | 'api' | 'console';

/**
 * The `X-Robots-Tag` value for a surface, or `null` for none. The console is never indexed; staff
 * and the API are not indexed on staging. `appEnv` is the runtime `APP_ENV`, so one image serves
 * every environment.
 */
export function robotsTagFor(appEnv: string | undefined, surface: RobotsSurface): string | null {
  if (surface === 'console' || appEnv === 'staging') return 'noindex, nofollow';
  return null;
}
