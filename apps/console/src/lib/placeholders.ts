/*
 * Until console sign-in exists (M1), the shell shows a neutral platform owner. Both labels are keys in
 * en.json; the real name and role come from the session once that exists.
 */
// TODO(M1): read the signed-in platform user from the session.
export const PLACEHOLDER_OWNER = {
  nameKey: 'shell.console.placeholderName',
  roleKey: 'role.platformOwner',
} as const;
