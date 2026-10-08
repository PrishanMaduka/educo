/**
 * The `quad_platform` database handle (`QuadPlatformDb`, D17): `@Inject(PLATFORM_DB)`. It lives
 * here, not in `src/tokens.ts`, because holding it is holding `withPlatform`: the
 * `quad/no-with-platform-outside-platform` lint rule refuses this file, `PLATFORM_DB` and
 * `PlatformCoreModule` outside `src/platform/**`, `src/worker/platform-jobs/**` and the API's
 * tests. Every write through it is recorded with `PlatformAuditService`.
 */
export const PLATFORM_DB = Symbol('PLATFORM_DB');
