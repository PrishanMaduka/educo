import { createPrivateKey, createPublicKey } from 'node:crypto';

import { LOCAL_SEED_PASSWORD, isCloudflareTestSecret } from '@quad/contracts';
import { parseInternationalPhone } from '@quad/domain';
import { z } from 'zod';

import { jwtKeyProblems, publicKeyProblem, publicKeyDer } from './common/crypto/jwt-keys';

/**
 * The API's configuration: every environment variable in spec 02 (Repository bootstrap →
 * Environment variables), parsed once at boot. Nothing else in the API reads `process.env`.
 */

/** Empty strings (`KEY=` in `.env`) count as unset. */
const blank = (value: unknown): unknown => (value === '' ? undefined : value);

function urlWith(protocols: readonly string[], label: string): z.ZodType<string> {
  return z.string().refine(
    (value) => {
      try {
        return protocols.includes(new URL(value).protocol);
      } catch {
        return false;
      }
    },
    { message: `must be ${label}` },
  );
}

const httpUrl = urlWith(['http:', 'https:'], 'an http(s) URL');
const postgresUrl = urlWith(['postgres:', 'postgresql:'], 'a postgres:// URL');
const redisUrl = urlWith(['redis:', 'rediss:'], 'a redis:// or rediss:// URL');
const smtpUrl = urlWith(['smtp:', 'smtps:'], 'an smtp:// URL');

const integer = (min: number, max: number) =>
  z
    .string()
    .regex(/^\d+$/, { message: `must be a whole number from ${min} to ${max}` })
    .transform(Number)
    .refine((n) => n >= min && n <= max, {
      message: `must be a whole number from ${min} to ${max}`,
    });

const port = integer(1, 65_535);
const boolean = z
  .enum(['true', 'false'], { message: 'must be true or false' })
  .transform((value) => value === 'true');
const text = z.string();
/** PEM text. A one-line value with literal backslash-n escapes gets real newlines. */
const normalisePem = (value: string): string => value.replaceAll('\\n', '\n');
const pem = z.string().transform(normalisePem);
const version = z.string().regex(/^\d+\.\d+\.\d+$/, { message: 'must look like 1.2.3' });
/** A bare, lower-case host name (`quad-edu.com`, `localhost`): what siteverify reports. */
const hostname = z
  .string()
  .regex(
    /^(?=.{1,253}$)[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?(?:\.[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?)*$/,
    {
      message: 'must be a lower-case host name such as quad-edu.com, with no scheme or port',
    },
  );
const snsTopicArn = z.string().regex(/^arn:aws:sns:[a-z0-9-]+:\d{12}:[A-Za-z0-9_-]{1,256}$/, {
  message: 'must be an SNS topic ARN (arn:aws:sns:<region>:<account>:<name>)',
});

/** Wraps a schema so a blank value is treated as unset. */
const req = <T extends z.ZodTypeAny>(schema: T) => z.preprocess(blank, schema);
const opt = <T extends z.ZodTypeAny>(schema: T) => z.preprocess(blank, schema.optional());
const withDefault = <T extends z.ZodTypeAny>(schema: T, value: z.input<T>) =>
  z.preprocess(blank, schema.default(value));

/**
 * Required in every environment: from M0 on, plus the field and token keys from M1 (D32).
 * Everything else is optional for now: each later milestone that ships a feature (email, SMS,
 * push, payments, Ask Quad…) makes its own variables required when that feature is turned
 * on, here and in this list.
 */
export const M0_REQUIRED = [
  'APP_ENV',
  'DATABASE_URL',
  'DATABASE_PLATFORM_URL',
  'REDIS_URL',
  'SESSION_SECRET',
  'LINK_SIGNING_SECRET',
  'PUBLIC_WEB_URL',
  'CONSOLE_URL',
  'FIELD_ENCRYPTION_KEY',
  'JWT_PRIVATE_KEY',
  'JWT_PUBLIC_KEY',
] as const;

const ConfigSchema = z.object({
  // General
  APP_ENV: req(z.enum(['local', 'staging', 'production'])),
  NODE_ENV: withDefault(z.enum(['development', 'test', 'production']), 'development'),
  LOG_LEVEL: withDefault(z.enum(['debug', 'info', 'warn', 'error']), 'info'),
  PUBLIC_WEB_URL: req(httpUrl),
  CONSOLE_URL: req(httpUrl),
  API_PORT: withDefault(port, '4000'),
  // Proxies in front of the API whose X-Forwarded-For entries are trusted (2 on AWS:
  // CloudFront + ALB). 0 trusts none, so the client IP is the socket peer.
  TRUST_PROXY_HOPS: withDefault(integer(0, 10), '0'),

  // Database. DATABASE_OWNER_URL is deliberately absent: migrations only (D17).
  DATABASE_URL: req(postgresUrl),
  DATABASE_PLATFORM_URL: req(postgresUrl),
  DATABASE_POOL_MAX: opt(integer(1, 500)),
  // The quad_platform pool (withPlatform, console routes): small, since console traffic is small.
  DATABASE_PLATFORM_POOL_MAX: withDefault(integer(1, 50), '2'),

  // Redis
  REDIS_URL: req(redisUrl),

  // Sessions and tokens (length rules outside local are checked in `environmentRules`, the
  // Ed25519 pair in `keyFormatRules`). FIELD_ENCRYPTION_KEY is required everywhere until M12's
  // KMS adapter reads KMS_KEY_ID (D32).
  SESSION_SECRET: req(text),
  LINK_SIGNING_SECRET: req(text),
  JWT_PRIVATE_KEY: req(pem),
  JWT_PUBLIC_KEY: req(pem),
  // The key that signed tokens before a rotation, still accepted until they expire (15 min).
  JWT_PUBLIC_KEY_PREVIOUS: opt(pem),
  // 32 is `FIELD_ENCRYPTION_KEY_MIN_LENGTH` in @quad/db, not imported: this file loads before
  // tracing starts, and @quad/db would load pg too early.
  FIELD_ENCRYPTION_KEY: req(z.string().min(32, { message: 'must be at least 32 characters' })),
  KMS_KEY_ID: opt(text),

  // Local and test helpers
  DEV_FIXED_OTP: opt(z.string().regex(/^\d{6}$/, { message: 'must be six digits' })),
  SEED_PASSWORD: opt(text),
  // The app-store review account (spec 16): its number, its secret fixed code and the only school
  // it may enter, set together (`storeReviewRules`).
  STORE_REVIEW_PHONE: opt(
    z.string().refine(
      (value) => {
        const phone = parseInternationalPhone(value);
        return phone.ok && phone.e164 === value;
      },
      { message: 'must be a Sri Lankan mobile number in E.164 (+947 and 8 digits)' },
    ),
  ),
  STORE_REVIEW_OTP: opt(z.string().regex(/^\d{6}$/, { message: 'must be six digits' })),
  STORE_REVIEW_TENANT_ID: opt(z.string().uuid({ message: 'must be a school id (uuid)' })),

  // Files
  S3_ENDPOINT: opt(httpUrl),
  S3_REGION: opt(text),
  S3_BUCKET_PRIVATE: opt(text),
  S3_BUCKET_PUBLIC: opt(text),
  S3_ACCESS_KEY_ID: opt(text),
  S3_SECRET_ACCESS_KEY: opt(text),
  CDN_URL: opt(httpUrl),
  CLOUDFRONT_KEY_PAIR_ID: opt(text),
  CLOUDFRONT_PRIVATE_KEY: opt(text),
  CLAMAV_HOST: opt(text),
  CLAMAV_PORT: opt(port),

  // Email
  EMAIL_PROVIDER: opt(z.enum(['smtp', 'ses'])),
  SMTP_URL: opt(smtpUrl),
  SES_REGION: opt(text),
  SES_CONFIGURATION_SET: opt(text),
  // The only topic whose SES bounce and complaint events the webhook accepts; unset refuses all.
  SES_SNS_TOPIC_ARN: opt(snsTopicArn),
  EMAIL_FROM_DOMAIN: opt(text),
  SUPPORT_INBOX: opt(z.string().email({ message: 'must be an email address' })),
  SALES_INBOX: opt(z.string().email({ message: 'must be an email address' })),

  // SMS
  SMS_PROVIDER: opt(z.enum(['log', 'live'])),
  NOTIFYLK_USER_ID: opt(text),
  NOTIFYLK_API_KEY: opt(text),
  NOTIFYLK_DEFAULT_SENDER: opt(text),
  TWILIO_ACCOUNT_SID: opt(text),
  TWILIO_AUTH_TOKEN: opt(text),
  TWILIO_MESSAGING_SERVICE_SID: opt(text),

  // Push
  PUSH_PROVIDER: opt(z.enum(['log', 'fcm'])),
  FCM_PROJECT_ID: opt(text),
  FCM_SERVICE_ACCOUNT_JSON: opt(text),

  // Platform billing (D20)
  PLATFORM_PAYHERE_MERCHANT_ID: opt(text),
  PLATFORM_PAYHERE_MERCHANT_SECRET: opt(text),
  PLATFORM_STRIPE_SECRET_KEY: opt(text),
  PLATFORM_STRIPE_WEBHOOK_SECRET: opt(text),
  PAYMENTS_SANDBOX: withDefault(boolean, 'false'),

  // Public site. The demo form's Turnstile secret, and the hostname siteverify must report;
  // required outside local, and locally unset means the offline verifier (`turnstileRules`, D57).
  TURNSTILE_SECRET_KEY: opt(text),
  TURNSTILE_EXPECTED_HOSTNAME: opt(hostname),
  PLAUSIBLE_DOMAIN: opt(text),

  // Ask Quad
  ANTHROPIC_API_KEY: opt(text),
  ASSISTANT_MODEL: opt(text),
  ASSISTANT_ENABLED: withDefault(boolean, 'false'),

  // Parent app config
  MIN_APP_VERSION_IOS: opt(version),
  MIN_APP_VERSION_ANDROID: opt(version),

  // Observability (tracing is off when the endpoint is unset)
  OTEL_EXPORTER_OTLP_ENDPOINT: opt(httpUrl),
  OTEL_EXPORTER_OTLP_HEADERS: opt(text),
  OTEL_SERVICE_NAME: opt(text),
  SENTRY_DSN: opt(httpUrl),
  SENTRY_ENVIRONMENT: opt(text),
  SENTRY_RELEASE: opt(text),
});

export type Config = z.infer<typeof ConfigSchema>;

/** Every variable the API reads. */
export const CONFIG_VARIABLES: readonly string[] = Object.keys(ConfigSchema.shape);

/**
 * Variables in spec 02's table that the API must not read: the owner URL is for migrations only
 * (D17), the admin URL and its parts for the db-bootstrap task only (D28, ruling R-db-admin), and
 * `NEXT_PUBLIC_*` are build-time settings for the web apps.
 */
export const NOT_READ_BY_THE_API: readonly string[] = [
  'DATABASE_OWNER_URL',
  'DATABASE_ADMIN_URL',
  'DATABASE_ADMIN_HOST',
  'DATABASE_ADMIN_PORT',
  'DATABASE_ADMIN_USER',
  'DATABASE_ADMIN_PASSWORD',
  'NEXT_PUBLIC_APP_ENV',
  'NEXT_PUBLIC_API_URL',
  'NEXT_PUBLIC_SENTRY_DSN',
  'NEXT_PUBLIC_TURNSTILE_SITE_KEY',
  'NEXT_PUBLIC_PLAUSIBLE_DOMAIN',
  // The widget's public key: the staff build reads it as NEXT_PUBLIC_TURNSTILE_SITE_KEY, and the
  // API needs only the secret (D57).
  'TURNSTILE_SITE_KEY',
  'NEXT_PUBLIC_QUAD_PRELAUNCH',
  // Read by the staff and console servers only (spec 02 "Web server (run time)", OQ16).
  'API_INTERNAL_URL',
];

/**
 * The placeholder secrets published in `.env.example` so `cp .env.example .env` boots locally.
 * Anyone can read them, so they are refused outside local (D25, D32). The Ed25519 pair was made
 * for this file only and signs nothing anywhere else.
 */
export const LOCAL_DEV_SECRETS = {
  SESSION_SECRET: 'local-only-session-secret-not-for-staging-or-production',
  LINK_SIGNING_SECRET: 'local-only-link-signing-secret-not-for-staging-or-production',
  JWT_PRIVATE_KEY: [
    '-----BEGIN PRIVATE KEY-----',
    'MC4CAQAwBQYDK2VwBCIEIMhuxgMS/JJRMDQFHcMKgWDyn4Z4Gjf+mjfpylS2/HqA',
    '-----END PRIVATE KEY-----',
  ].join('\n'),
  JWT_PUBLIC_KEY: [
    '-----BEGIN PUBLIC KEY-----',
    'MCowBQYDK2VwAyEArNJauWv41E8zHDTWpKLHqXJh+9PgLT+L6zQvLlCwVnA=',
    '-----END PUBLIC KEY-----',
  ].join('\n'),
  FIELD_ENCRYPTION_KEY: 'local-only-field-encryption-key-not-for-staging-or-production',
  SEED_PASSWORD: LOCAL_SEED_PASSWORD,
} as const;

/** The published pair's public key, to spot it however its PEM is written. */
const PUBLISHED_JWT_DER = publicKeyDer(createPublicKey(LOCAL_DEV_SECRETS.JWT_PUBLIC_KEY));

/** Whether `value` is (a rewrite of) the published Ed25519 private or public key. */
function isPublishedJwtKey(variable: 'JWT_PRIVATE_KEY' | 'JWT_PUBLIC_KEY', value: string): boolean {
  try {
    const key =
      variable === 'JWT_PRIVATE_KEY'
        ? createPrivateKey(normalisePem(value))
        : createPublicKey(normalisePem(value));
    return publicKeyDer(key).equals(PUBLISHED_JWT_DER);
  } catch {
    // Not a key at all: `keyFormatRules` reports that.
    return false;
  }
}

const MIN_SECRET_LENGTH = 32;
const PUBLISHED = 'is the published local value; set a real secret';

/** Credentials of the compose Postgres roles (docker/postgres/init); fine locally only. */
const COMPOSE_CREDENTIALS = ['quad_app:quad_app@', 'quad_platform:quad_platform@'];

export interface ConfigProblem {
  readonly variable: string;
  readonly problem: string;
}

/** Thrown by `loadConfig`; the message names every bad variable and never includes a value. */
export class ConfigError extends Error {
  constructor(readonly problems: readonly ConfigProblem[]) {
    super(
      [
        'The API cannot start because its configuration is invalid:',
        ...problems.map((p) => `  - ${p.variable} ${p.problem}`),
      ].join('\n'),
    );
    this.name = 'ConfigError';
  }
}

/** A plain-English reason for one issue. Built from the issue kind, never from the input value. */
function describeIssue(issue: z.ZodIssue): string {
  switch (issue.code) {
    case z.ZodIssueCode.invalid_type:
      return issue.received === 'undefined' ? 'is missing' : 'has the wrong type';
    case z.ZodIssueCode.invalid_enum_value:
      return `must be one of: ${issue.options.join(', ')}`;
    case z.ZodIssueCode.custom:
    case z.ZodIssueCode.invalid_string:
    case z.ZodIssueCode.too_small:
      return issue.message;
    default:
      return 'is not valid';
  }
}

type RawEnv = Readonly<Record<string, string | undefined>>;

/**
 * Rules for staging and production: real secrets and passwords, no local-only flags (D22), and no
 * `DEV_FIXED_OTP` (D46).
 */
function environmentRules(env: RawEnv): ConfigProblem[] {
  const appEnv = blank(env.APP_ENV);
  if (appEnv !== 'staging' && appEnv !== 'production') {
    return [];
  }
  const problems: ConfigProblem[] = [];
  for (const name of ['FIELD_ENCRYPTION_KEY', 'SEED_PASSWORD'] as const) {
    if (blank(env[name]) === LOCAL_DEV_SECRETS[name]) {
      problems.push({ variable: name, problem: PUBLISHED });
    }
  }
  for (const name of ['JWT_PRIVATE_KEY', 'JWT_PUBLIC_KEY'] as const) {
    const value = blank(env[name]);
    if (typeof value === 'string' && isPublishedJwtKey(name, value)) {
      problems.push({ variable: name, problem: PUBLISHED });
    }
  }
  for (const name of ['SESSION_SECRET', 'LINK_SIGNING_SECRET'] as const) {
    const value = blank(env[name]);
    if (typeof value !== 'string') continue;
    if (value === LOCAL_DEV_SECRETS[name]) {
      problems.push({ variable: name, problem: PUBLISHED });
    } else if (value.length < MIN_SECRET_LENGTH) {
      problems.push({
        variable: name,
        problem: `must be at least ${MIN_SECRET_LENGTH} characters outside local`,
      });
    }
  }
  const session = blank(env.SESSION_SECRET);
  if (typeof session === 'string' && session === blank(env.LINK_SIGNING_SECRET)) {
    problems.push({ variable: 'LINK_SIGNING_SECRET', problem: 'must differ from SESSION_SECRET' });
  }
  for (const name of ['DATABASE_URL', 'DATABASE_PLATFORM_URL'] as const) {
    const url = env[name] ?? '';
    if (COMPOSE_CREDENTIALS.some((credentials) => url.includes(credentials))) {
      problems.push({ variable: name, problem: 'uses the local compose password' });
    }
  }
  // Fixed sign-in codes are local only (D46): staging needs a real second factor too.
  if (blank(env.DEV_FIXED_OTP) !== undefined) {
    problems.push({ variable: 'DEV_FIXED_OTP', problem: 'must not be set outside local (D46)' });
  }
  return problems;
}

/**
 * In every environment: the store-review number needs its code and its school (spec 16), and
 * outside local the code may not be one digit repeated (`000000`, `777777`).
 */
function storeReviewRules(env: RawEnv): ConfigProblem[] {
  if (blank(env.STORE_REVIEW_PHONE) === undefined) return [];
  const problems: ConfigProblem[] = [];
  for (const name of ['STORE_REVIEW_OTP', 'STORE_REVIEW_TENANT_ID'] as const) {
    if (blank(env[name]) === undefined) {
      problems.push({ variable: name, problem: 'is missing (STORE_REVIEW_PHONE needs it)' });
    }
  }
  const code = blank(env.STORE_REVIEW_OTP);
  if (blank(env.APP_ENV) !== 'local' && typeof code === 'string' && /^(\d)\1{5}$/.test(code)) {
    problems.push({
      variable: 'STORE_REVIEW_OTP',
      problem: 'must not be one digit repeated outside local',
    });
  }
  return problems;
}

/** In every environment: the JWT keys are an Ed25519 pair that belongs together (D32). */
function keyFormatRules(env: RawEnv): ConfigProblem[] {
  const problems: ConfigProblem[] = [];
  const previous = blank(env.JWT_PUBLIC_KEY_PREVIOUS);
  if (typeof previous === 'string') {
    const problem = publicKeyProblem(normalisePem(previous));
    if (problem !== null) problems.push({ variable: 'JWT_PUBLIC_KEY_PREVIOUS', problem });
  }
  const privateKey = blank(env.JWT_PRIVATE_KEY);
  const publicKey = blank(env.JWT_PUBLIC_KEY);
  if (typeof privateKey !== 'string' || typeof publicKey !== 'string') {
    return problems;
  }
  return [
    ...problems,
    ...jwtKeyProblems(normalisePem(privateKey), normalisePem(publicKey)).map(
      ({ variable, problem }) => ({ variable, problem }),
    ),
  ];
}

/**
 * In every environment: each chosen email provider has what it needs, and SMS stays on the log
 * provider until live SMS ships (M6, OQ12). Outside local `EMAIL_PROVIDER` must be set; locally
 * it may be unset, and email then goes by SMTP when `SMTP_URL` is set and is otherwise off
 * (`emailProviderOf`).
 */
function deliveryRules(env: RawEnv): ConfigProblem[] {
  const problems: ConfigProblem[] = [];
  const needs = (provider: string, names: readonly string[]): void => {
    for (const name of names) {
      if (blank(env[name]) === undefined) {
        problems.push({
          variable: name,
          problem: `is missing (EMAIL_PROVIDER=${provider} needs it)`,
        });
      }
    }
  };
  const emailProvider = blank(env.EMAIL_PROVIDER);
  const appEnv = blank(env.APP_ENV);
  if (emailProvider === undefined && (appEnv === 'staging' || appEnv === 'production')) {
    problems.push({
      variable: 'EMAIL_PROVIDER',
      problem: 'must be set outside local (smtp or ses)',
    });
  }
  if (emailProvider === 'smtp') needs('smtp', ['SMTP_URL']);
  if (emailProvider === 'ses') needs('ses', ['SES_REGION', 'EMAIL_FROM_DOMAIN']);
  if (blank(env.SMS_PROVIDER) === 'live') {
    problems.push({
      variable: 'SMS_PROVIDER',
      problem: 'must be log until live SMS ships (M6, OQ12)',
    });
  }
  return problems;
}

/**
 * Turnstile (D57). Outside local the secret and the hostname must be set, and Cloudflare's
 * published test secrets are refused (they pass or fail every token). Locally either may be unset
 * (the offline verifier), but a secret needs the hostname, since it selects the Cloudflare verifier.
 */
function turnstileRules(env: RawEnv): ConfigProblem[] {
  const problems: ConfigProblem[] = [];
  // Typed reads of the raw values: empty counts as unset, as `blank` does.
  const secret = env.TURNSTILE_SECRET_KEY || undefined;
  const host = env.TURNSTILE_EXPECTED_HOSTNAME || undefined;
  const appEnv = blank(env.APP_ENV);
  if (appEnv === 'staging' || appEnv === 'production') {
    if (secret === undefined) {
      problems.push({ variable: 'TURNSTILE_SECRET_KEY', problem: 'must be set outside local' });
    } else if (isCloudflareTestSecret(secret)) {
      problems.push({
        variable: 'TURNSTILE_SECRET_KEY',
        problem: 'is a Cloudflare test secret, which is for local only; set the real secret',
      });
    }
    if (host === undefined) {
      problems.push({
        variable: 'TURNSTILE_EXPECTED_HOSTNAME',
        problem: 'must be set outside local',
      });
    }
  } else if (secret !== undefined && host === undefined) {
    problems.push({
      variable: 'TURNSTILE_EXPECTED_HOSTNAME',
      problem: 'is missing (TURNSTILE_SECRET_KEY needs it)',
    });
  }
  return problems;
}

/**
 * Parses the environment. Throws `ConfigError` listing every missing or invalid variable at
 * once, plus the refusal of `DEV_FIXED_OTP` outside local (D46).
 */
export function loadConfig(env: NodeJS.ProcessEnv): Config {
  const parsed = ConfigSchema.safeParse(env);
  const problems: ConfigProblem[] = parsed.success
    ? []
    : parsed.error.issues.map((issue) => ({
        variable: issue.path.join('.'),
        problem: describeIssue(issue),
      }));
  problems.push(
    ...keyFormatRules(env),
    ...storeReviewRules(env),
    ...deliveryRules(env),
    ...turnstileRules(env),
    ...environmentRules(env),
  );
  if (problems.length > 0 || !parsed.success) {
    throw new ConfigError(problems);
  }
  return parsed.data;
}
