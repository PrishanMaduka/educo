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
    /**
     * Builds the pre-launch public site (decision log, 2026-10-08): Sign in shows a "coming soon"
     * note and Book a demo opens an email. The GitHub Pages export sets it; the real sign-in and
     * demo endpoint replace both when it is off.
     */
    NEXT_PUBLIC_QUAD_PRELAUNCH: optional(z.enum(['true', 'false'])).transform(
      (value) => value === 'true',
    ),
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

/**
 * Runtime variables the staff and console servers read (spec 02 "Web server (run time)"), not
 * the browser: `API_INTERNAL_URL` is the API origin server components call (OQ16). Locally it
 * defaults to the API on :4000; staging and production must set it.
 */
export const WebServerEnvSchema = z
  .object({
    APP_ENV: optional(z.enum(['local', 'staging', 'production'])).transform(
      (value) => value ?? 'local',
    ),
    API_INTERNAL_URL: optional(origin),
  })
  .superRefine((env, ctx) => {
    if (env.APP_ENV !== 'local' && env.API_INTERNAL_URL === undefined) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['API_INTERNAL_URL'],
        message: `Required when APP_ENV is ${env.APP_ENV}`,
      });
    }
  })
  .transform((env) => ({ API_INTERNAL_URL: env.API_INTERNAL_URL ?? 'http://localhost:4000' }));

export type WebServerEnv = z.infer<typeof WebServerEnvSchema>;

/** Parses the web servers' runtime variables, or throws with every problem listed. */
export function parseWebServerEnv(source: Record<string, string | undefined>): WebServerEnv {
  const result = WebServerEnvSchema.safeParse(source);
  if (!result.success) {
    const problems = result.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`);
    throw new Error(`Invalid web server environment variables:\n  ${problems.join('\n  ')}`);
  }
  return result.data;
}

/** The surfaces that answer on the public internet (spec 20, edge). */
export type RobotsSurface = 'staff' | 'api' | 'console';

/** The environments whose staff app and API may be indexed: production, and local (never public). */
const INDEXABLE_APP_ENVS: ReadonlySet<string> = new Set(['production', 'local']);

/**
 * The `X-Robots-Tag` value for a surface, or `null` for none. The console is never indexed. Staff
 * and the API are indexed only when `appEnv` is exactly `production` (or `local`): an allow-list,
 * so a missing or mistyped `APP_ENV` fails closed. `appEnv` is the runtime `APP_ENV`, so one image
 * serves every environment.
 */
export function robotsTagFor(appEnv: string | undefined, surface: RobotsSurface): string | null {
  if (surface === 'console') return 'noindex, nofollow';
  return appEnv !== undefined && INDEXABLE_APP_ENVS.has(appEnv) ? null : 'noindex, nofollow';
}
