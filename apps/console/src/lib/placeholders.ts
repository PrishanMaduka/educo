/*
 * Until console sign-in exists (M1), the shell shows the seeded platform owner. Sample data, not copy: it
 * comes from the session once that exists.
 */
// TODO(M1): read the signed-in platform user from the session.
export const PLACEHOLDER_OWNER = {
  name: 'Prishan Maduka',
  role: 'Platform owner',
} as const;
