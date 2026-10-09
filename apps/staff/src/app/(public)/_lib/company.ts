/*
 * Company facts for the public site (D41): the About, Security & trust and legal pages, the
 * footer and the demo forms all read these, so the owner fills them in here once. A value that
 * still says "to be confirmed" is a placeholder: it shows on the pages as written until the owner
 * confirms it. Never add details here that the owner has not given.
 */

/** The marker every placeholder carries, so the pages and the tests can find what is unconfirmed. */
export const TO_BE_CONFIRMED = 'to be confirmed';

export const COMPANY = {
  /** The product and brand name. */
  brandName: 'Quad',
  /** The registered legal entity that contracts with schools. */
  legalName: 'Quad Education Pvt Limited (registration in progress)',
  registrationNumber: 'Company registration in progress',
  registeredAddress: `Registered address ${TO_BE_CONFIRMED}, Sri Lanka`,
  /** Where the company is based. */
  country: 'Sri Lanka',
  foundedYear: 'Founded in 2026',
  founder: {
    name: 'Prishan Maduka',
    role: 'Founder',
    bio: `Biography ${TO_BE_CONFIRMED}.`,
  },
  /** The law and courts named in the terms of service. */
  governingLaw: 'The laws of Sri Lanka',
  courts: 'The courts of Sri Lanka',
  /** The cap on each side's liability in the terms of service. */
  liabilityCap: 'the fees the school paid Quad in the 12 months before the claim',
  contact: {
    /** General questions, demos and support (spec 19 footer). */
    support: 'support@quad-edu.com',
    /** Privacy questions and requests (spec 19 legal pages). */
    privacy: 'support@quad-edu.com',
    /** Security reports (spec 20 mail). */
    security: 'support@quad-edu.com',
  },
} as const;

type Fields = Record<string, unknown>;

const isFields = (value: unknown): value is Fields => typeof value === 'object' && value !== null;

/** The dotted names of the fields that are still placeholders, e.g. `founder.bio`. */
export function unconfirmedFields(facts: Fields = COMPANY, prefix = ''): string[] {
  return Object.entries(facts).flatMap(([key, value]) => {
    const name = `${prefix}${key}`;
    if (typeof value === 'string') return value.includes(TO_BE_CONFIRMED) ? [name] : [];
    return isFields(value) ? unconfirmedFields(value, `${name}.`) : [];
  });
}
