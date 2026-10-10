import { parseWebPublicEnv } from '@quad/contracts/web-env';

/**
 * The validated public build-time settings (spec 02 "Web public (build time)"). Read by server
 * components while the page is rendered at build time; next.config.ts already refused bad values.
 */
export const publicEnv = parseWebPublicEnv(process.env, { demoForm: true });
