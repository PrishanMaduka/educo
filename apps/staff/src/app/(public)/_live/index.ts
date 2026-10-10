/*
 * The public pages' live code (D57): everything on the landing page that needs the API (sign-in,
 * Open {school}, the demo endpoint and Turnstile) is reached only through this index. The
 * pre-launch export aliases this folder to site-export/prelaunch, so none of it is compiled there.
 * Lint refuses the API client, React Query, `(auth)` and `@/lib/api` anywhere else in `(public)`.
 */
export { LiveSignIn, LiveSignInHost } from './LiveSignIn';
export { SignedInHint } from './SignedInHint';
export { submitDemoRequest } from './submitDemoRequest';
export { TurnstileField } from './TurnstileField';
