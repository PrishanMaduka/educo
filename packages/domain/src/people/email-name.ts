/** The local part and domain of an address (trimmed), or null without exactly one `@`. */
function partsOf(email: string): { readonly local: string; readonly domain: string } | null {
  const parts = email.trim().split('@');
  const [local, domain] = parts;
  if (parts.length !== 2 || local === undefined || domain === undefined) return null;
  return { local, domain };
}

/**
 * The name an invited member of staff starts with until they change it (the prototype's
 * `sendStaffInvite`): the address's local part split at dots and underscores, each word
 * capitalised (`nadeesha.jayasinghe@…` is "Nadeesha Jayasinghe"). A local part with no words
 * stays as it is, so the name is never empty.
 */
export function nameFromEmail(email: string): string {
  const local = partsOf(email)?.local ?? email.trim();
  const words = local.split(/[._]+/).filter(Boolean);
  if (words.length === 0) return local;
  return words.map((word) => word.charAt(0).toUpperCase() + word.slice(1)).join(' ');
}

/**
 * An address shown to whoever holds an invite link (spec 06 `GET /auth/invites/:token`): only the
 * first character of the local part and the domain, lower-cased (`n•••@colombo-intl.local`), so
 * the page confirms whose invite it is without giving the address away.
 */
export function maskEmail(email: string): string {
  const parts = partsOf(email.toLowerCase());
  if (parts === null || parts.local === '') return '•••';
  return `${parts.local.charAt(0)}•••@${parts.domain}`;
}
