import { generateKeyPairSync } from 'node:crypto';

/** A throwaway Ed25519 pair for tests, made per run (not the published `.env.example` pair). */
const testJwtPair = generateKeyPairSync('ed25519');
export const TEST_JWT_KEYS = {
  JWT_PRIVATE_KEY: testJwtPair.privateKey.export({ type: 'pkcs8', format: 'pem' }).toString(),
  JWT_PUBLIC_KEY: testJwtPair.publicKey.export({ type: 'spki', format: 'pem' }).toString(),
} as const;

/**
 * A valid local environment for tests. The secrets are throwaway test values; the URLs point at
 * the compose services (spec 02, local defaults).
 */
export function localEnv(overrides: Record<string, string | undefined> = {}): NodeJS.ProcessEnv {
  return {
    APP_ENV: 'local',
    NODE_ENV: 'test',
    LOG_LEVEL: 'error',
    PUBLIC_WEB_URL: 'http://localhost:3000',
    CONSOLE_URL: 'http://localhost:3001',
    DATABASE_URL: 'postgres://quad_app:quad_app@localhost:5432/quad',
    DATABASE_PLATFORM_URL: 'postgres://quad_platform:quad_platform@localhost:5432/quad',
    REDIS_URL: 'redis://localhost:6379',
    SESSION_SECRET: 'test-session-secret-test-session-secret',
    LINK_SIGNING_SECRET: 'test-link-signing-secret-test-link-secret',
    FIELD_ENCRYPTION_KEY: 'test-field-encryption-key-test-field-key',
    // Email must be chosen outside local; Mailpit's compose port, as in .env.example.
    EMAIL_PROVIDER: 'smtp',
    SMTP_URL: 'smtp://localhost:1025',
    ...TEST_JWT_KEYS,
    ...overrides,
  };
}

/** The same environment as production would see it (no local-only flags, long secrets). */
export function productionEnv(
  overrides: Record<string, string | undefined> = {},
): NodeJS.ProcessEnv {
  return localEnv({
    APP_ENV: 'production',
    NODE_ENV: 'production',
    PUBLIC_WEB_URL: 'https://quad-edu.com',
    CONSOLE_URL: 'https://console.quad-edu.com',
    DATABASE_URL: 'postgres://quad_app:prod-app-password@db.internal:5432/quad',
    DATABASE_PLATFORM_URL: 'postgres://quad_platform:prod-platform-password@db.internal:5432/quad',
    SESSION_SECRET: 'p'.repeat(48),
    LINK_SIGNING_SECRET: 'l'.repeat(48),
    FIELD_ENCRYPTION_KEY: 'f'.repeat(64),
    ...overrides,
  });
}
