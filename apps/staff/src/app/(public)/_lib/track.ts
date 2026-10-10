/** The public site's analytics events (D57, owner OQ3): GA4's snake_case names, no parameters. */
export type PublicEvent = 'sign_in_opened';

/**
 * Counts a public-site event. Sends nothing yet.
 * TODO(M1b): send through Google Analytics, and only after the visitor accepts (plan Task 13).
 */
export const track: (event: PublicEvent) => void = () => {
  // Deliberately empty until Task 13 adds consent-gated Google Analytics.
};
