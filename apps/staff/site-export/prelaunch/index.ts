import type * as Live from '../../src/app/(public)/_live';

/*
 * The pre-launch stand-ins for `src/app/(public)/_live` (D57). site-export/next.config.ts aliases
 * that folder here, so the export compiles none of the live code: no sign-in flow, API client or
 * Turnstile. Each stub has the live export's type. The pre-launch pages never render the live
 * pieces (Sign in opens the coming-soon note, the forms open an email), so the components show
 * nothing and the actions throw if anything ever calls them.
 */

function refuse(what: string): never {
  throw new Error(`${what} is not part of the pre-launch site (D57).`);
}

export const LiveSignIn: typeof Live.LiveSignIn = () => null;

export const LiveSignInHost: typeof Live.LiveSignInHost = () => null;

export const SignedInHint: typeof Live.SignedInHint = () => null;

export const TurnstileField: typeof Live.TurnstileField = () => refuse('Turnstile');

export const submitDemoRequest: typeof Live.submitDemoRequest = () =>
  refuse('Sending a demo request to Quad');
