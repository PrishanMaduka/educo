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
