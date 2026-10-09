import { createPrivateKey, createPublicKey } from 'node:crypto';

import type { KeyObject } from 'node:crypto';

/** The parent access token keys (spec 05): EdDSA over Ed25519. */
export interface JwtKeys {
  readonly algorithm: 'EdDSA';
  readonly privateKey: KeyObject;
  readonly publicKey: KeyObject;
  /** `JWT_PUBLIC_KEY_PREVIOUS`: tokens it signed are still accepted after a rotation. */
  readonly previousPublicKey: KeyObject | null;
}

type JwtKeyVariable = 'JWT_PRIVATE_KEY' | 'JWT_PUBLIC_KEY' | 'JWT_PUBLIC_KEY_PREVIOUS';

/** A key that cannot be used. Names the variable; never includes the key. */
export class JwtKeyError extends Error {
  constructor(
    readonly variable: JwtKeyVariable,
    readonly problem: string,
  ) {
    super(`${variable} ${problem}`);
    this.name = 'JwtKeyError';
  }
}

const PRIVATE_PROBLEM = 'must be an Ed25519 private key (PKCS#8 PEM)';
const PUBLIC_PROBLEM = 'must be an Ed25519 public key (SPKI PEM)';

function parseKey(variable: JwtKeyVariable, pem: string): KeyObject {
  const isPrivate = variable === 'JWT_PRIVATE_KEY';
  const problem = isPrivate ? PRIVATE_PROBLEM : PUBLIC_PROBLEM;
  // A private PEM also parses as a public key (Node derives it), so require the right header.
  const header = isPrivate ? '-----BEGIN PRIVATE KEY-----' : '-----BEGIN PUBLIC KEY-----';
  if (!pem.trimStart().startsWith(header)) {
    throw new JwtKeyError(variable, problem);
  }
  let key: KeyObject;
  try {
    key = isPrivate ? createPrivateKey(pem) : createPublicKey(pem);
  } catch {
    throw new JwtKeyError(variable, problem);
  }
  if (key.asymmetricKeyType !== 'ed25519') {
    throw new JwtKeyError(variable, problem);
  }
  return key;
}

/** The raw SPKI bytes of a public key, or of the public half of a private key. */
export function publicKeyDer(key: KeyObject): Buffer {
  const publicKey = key.type === 'private' ? createPublicKey(key) : key;
  return publicKey.export({ type: 'spki', format: 'der' });
}

function tryParseKey(variable: JwtKeyVariable, pem: string): KeyObject | JwtKeyError {
  try {
    return parseKey(variable, pem);
  } catch (error) {
    if (error instanceof JwtKeyError) return error;
    throw error;
  }
}

type NonEmpty<T> = readonly [T, ...T[]];

/** The usable pair, or every problem with it. */
function readPair(
  privatePem: string,
  publicPem: string,
): { readonly keys: JwtKeys } | { readonly problems: NonEmpty<JwtKeyError> } {
  const privateKey = tryParseKey('JWT_PRIVATE_KEY', privatePem);
  const publicKey = tryParseKey('JWT_PUBLIC_KEY', publicPem);
  if (privateKey instanceof JwtKeyError) {
    return { problems: publicKey instanceof JwtKeyError ? [privateKey, publicKey] : [privateKey] };
  }
  if (publicKey instanceof JwtKeyError) {
    return { problems: [publicKey] };
  }
  if (!publicKeyDer(privateKey).equals(publicKeyDer(publicKey))) {
    return {
      problems: [new JwtKeyError('JWT_PUBLIC_KEY', 'must be the public half of JWT_PRIVATE_KEY')],
    };
  }
  return { keys: { algorithm: 'EdDSA', privateKey, publicKey, previousPublicKey: null } };
}

/**
 * Every problem with the pair, for the boot check: each key must be Ed25519, and the public key
 * must be the private key's own half.
 */
export function jwtKeyProblems(privatePem: string, publicPem: string): readonly JwtKeyError[] {
  const pair = readPair(privatePem, publicPem);
  return 'problems' in pair ? pair.problems : [];
}

/** The problem with an optional extra public key (`JWT_PUBLIC_KEY_PREVIOUS`), or null. */
export function publicKeyProblem(publicPem: string): string | null {
  const key = tryParseKey('JWT_PUBLIC_KEY_PREVIOUS', publicPem);
  return key instanceof JwtKeyError ? key.problem : null;
}

/**
 * Loads `JWT_PRIVATE_KEY`, `JWT_PUBLIC_KEY` and the optional `JWT_PUBLIC_KEY_PREVIOUS` (PEM);
 * throws the first `JwtKeyError`.
 */
export function loadJwtKeys(privatePem: string, publicPem: string, previousPem?: string): JwtKeys {
  const pair = readPair(privatePem, publicPem);
  if ('problems' in pair) {
    throw pair.problems[0];
  }
  if (previousPem === undefined) return pair.keys;
  return { ...pair.keys, previousPublicKey: parseKey('JWT_PUBLIC_KEY_PREVIOUS', previousPem) };
}
