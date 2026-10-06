/**
 * Injection tokens. Kept free of imports so `main.ts` can use them before tracing starts
 * (anything it imports statically loads before the instrumentations are in place).
 */

/** The validated `Config`: `@Inject(CONFIG) config: Config`. */
export const CONFIG = Symbol('CONFIG');
/** The pino root logger: `@Inject(LOGGER) logger: Logger`. */
export const LOGGER = Symbol('LOGGER');
