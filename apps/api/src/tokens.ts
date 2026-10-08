/**
 * Injection tokens. Kept free of imports so `main.ts` can use them before tracing starts
 * (anything it imports statically loads before the instrumentations are in place).
 */

/** The validated `Config`: `@Inject(CONFIG) config: Config`. */
export const CONFIG = Symbol('CONFIG');
/** The pino root logger: `@Inject(LOGGER) logger: Logger`. */
export const LOGGER = Symbol('LOGGER');
/** The current time in epoch milliseconds: `@Inject(CLOCK) now: Clock`. Tests fix it. */
export const CLOCK = Symbol('CLOCK');
/** What `CLOCK` provides. */
export type Clock = () => number;
/** The `quad_app` database handle (`QuadTenantDb`): `@Inject(TENANT_DB) db: QuadTenantDb`. */
export const TENANT_DB = Symbol('TENANT_DB');
/** Fetches an SNS signing certificate: `(certUrl) => Promise<string>` (tests inject a key). */
export const SNS_KEY_FETCHER = Symbol('SNS_KEY_FETCHER');
/** Confirms an SNS subscription with a GET of its SubscribeURL: `(url) => Promise<void>`. */
export const SNS_SUBSCRIBE_FETCHER = Symbol('SNS_SUBSCRIBE_FETCHER');
/** The field cipher (`FieldCipher` from `@quad/db`, R-fieldcipher): `@Inject(FIELD_CIPHER)`. */
export const FIELD_CIPHER = Symbol('FIELD_CIPHER');
/** The breached-password check (`BreachCheck`); offline locally (OQ14). */
export const BREACH_CHECK = Symbol('BREACH_CHECK');
/** The parent access token keys (`JwtKeys`, EdDSA). */
export const JWT_KEYS = Symbol('JWT_KEYS');
/** The API's shared ioredis connection (`src/redis`): `@Inject(REDIS) redis: Redis`. */
export const REDIS = Symbol('REDIS');
/** Queues email and SMS (`DeliveryQueue`, BullMQ; tests may pass a recording fake). */
export const DELIVERY = Symbol('DELIVERY');
/**
 * The `quad_platform` database handle (`QuadPlatformDb`): only `src/platform/**` may inject it,
 * and every write through it is recorded with `PlatformAuditService`.
 */
export const PLATFORM_DB = Symbol('PLATFORM_DB');
/** Resolves a console session cookie (`ConsoleSessionLookup`); Task 10 provides it. */
export const CONSOLE_SESSIONS = Symbol('CONSOLE_SESSIONS');
