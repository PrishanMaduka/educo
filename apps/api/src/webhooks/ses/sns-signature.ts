import { X509Certificate, createVerify } from 'node:crypto';

import type { SnsEnvelope } from '@quad/contracts';
import type { KeyObject } from 'node:crypto';

/**
 * Returns the public key of the certificate published at an SNS `SigningCertURL`, or null when
 * there is no usable certificate there (AWS answered 4xx, or the body is not exactly one
 * currently valid certificate). Throws for 5xx and network errors, so SNS retries.
 */
export type SnsKeyGetter = (certUrl: string) => Promise<KeyObject | null>;

/** `sns.<region>.amazonaws.com`, the only hosts SNS signs from and sends links to. */
const SNS_HOST = /^sns\.[a-z0-9-]+\.amazonaws\.com$/;

/** Signing keys are reused this long, and at most this many are kept (spec 20, Email). */
const KEY_TTL_MS = 24 * 60 * 60 * 1000;
const MAX_KEYS = 10;

/**
 * Replay window: SNS retries a delivery for well under an hour by default, so an older message
 * is a replay. A little future skew is allowed for clock drift.
 */
const MAX_AGE_MS = 60 * 60 * 1000;
const MAX_SKEW_MS = 5 * 60 * 1000;

/** Default fetches give AWS this long and accept at most this much (a certificate is ~2 KB). */
const FETCH_TIMEOUT_MS = 5000;
const MAX_CERT_BYTES = 16 * 1024;

/** `arn:aws:sns:<region>:<account>:<name>`; the region picks the signing host. */
const TOPIC_ARN = /^arn:aws:sns:([a-z0-9-]+):\d{12}:[A-Za-z0-9_-]{1,256}$/;

/** The only path SNS publishes signing certificates at. */
const CERT_PATH = /^\/SimpleNotificationService-[0-9a-f]{32}\.pem$/;

/** Exactly one PEM certificate block and nothing else (a final newline is allowed). */
const SINGLE_CERT_PEM =
  /^-----BEGIN CERTIFICATE-----\r?\n(?:[A-Za-z0-9+/=]+\r?\n)+-----END CERTIFICATE-----(?:\r?\n)?$/;

/** The fields SNS signs, in the order AWS documents, per message type. */
const SIGNED_FIELDS = {
  Notification: ['Message', 'MessageId', 'Subject', 'Timestamp', 'TopicArn', 'Type'],
  SubscriptionConfirmation: [
    'Message',
    'MessageId',
    'SubscribeURL',
    'Timestamp',
    'Token',
    'TopicArn',
    'Type',
  ],
  UnsubscribeConfirmation: [
    'Message',
    'MessageId',
    'SubscribeURL',
    'Timestamp',
    'Token',
    'TopicArn',
    'Type',
  ],
} as const satisfies Record<SnsEnvelope['Type'], readonly (keyof SnsEnvelope)[]>;

/**
 * The string SNS signs: each signed field that is present as `key\nvalue\n`, in AWS order.
 * Only a Notification's `Subject` is optional; `verifySnsSignature` refuses a confirmation
 * without `SubscribeURL` and `Token`.
 */
export function canonicalSnsString(message: SnsEnvelope): string {
  return SIGNED_FIELDS[message.Type]
    .map((field) => {
      const value = message[field];
      return value === undefined ? '' : `${field}\n${value}\n`;
    })
    .join('');
}

/**
 * True only for `https://sns.<region>.amazonaws.com/...` with no credentials and no port: the
 * hosts SNS serves its signing certificates and subscription links from.
 */
export function isAwsSnsUrl(value: string): boolean {
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    return false;
  }
  return (
    url.protocol === 'https:' &&
    SNS_HOST.test(url.hostname) &&
    url.port === '' &&
    url.username === '' &&
    url.password === ''
  );
}

/**
 * True when `url` is an AWS SNS URL (`isAwsSnsUrl`) on the topic's own regional host,
 * `sns.<region>.amazonaws.com`. Used for SubscribeURL.
 */
export function isSnsUrlForTopic(url: string, topicArn: string): boolean {
  const region = TOPIC_ARN.exec(topicArn)?.[1];
  if (region === undefined || !isAwsSnsUrl(url)) {
    return false;
  }
  return new URL(url).hostname === `sns.${region}.amazonaws.com`;
}

/**
 * True only for the exact certificate URL shape SNS signs with:
 * `https://sns.<topic region>.amazonaws.com/SimpleNotificationService-<32 hex>.pem`, with no
 * query string or fragment (not even an empty `?` or `#`).
 */
export function isSigningCertForTopic(certUrl: string, topicArn: string): boolean {
  if (!isSnsUrlForTopic(certUrl, topicArn) || certUrl.includes('?') || certUrl.includes('#')) {
    return false;
  }
  const url = new URL(certUrl);
  return url.search === '' && url.hash === '' && CERT_PATH.test(url.pathname);
}

/**
 * The public key of `pem` when it is exactly one X.509 certificate (no other text around it)
 * that is valid at `now`; otherwise null.
 */
export function parseSnsCertificate(pem: string, now: number): KeyObject | null {
  if (!SINGLE_CERT_PEM.test(pem)) {
    return null;
  }
  let cert: X509Certificate;
  try {
    cert = new X509Certificate(pem);
  } catch {
    return null;
  }
  const validFrom = Date.parse(cert.validFrom);
  const validTo = Date.parse(cert.validTo);
  if (!(validFrom <= now && now <= validTo)) {
    return null;
  }
  return cert.publicKey;
}

/** True when `timestamp` is at most an hour old and at most five minutes ahead of `now`. */
export function isFreshSnsTimestamp(timestamp: string, now: number): boolean {
  const at = Date.parse(timestamp);
  return Number.isFinite(at) && at >= now - MAX_AGE_MS && at <= now + MAX_SKEW_MS;
}

function hasSignedFields(message: SnsEnvelope): boolean {
  return message.Type === 'Notification'
    ? true
    : message.SubscribeURL !== undefined && message.Token !== undefined;
}

/**
 * Checks an SNS message signature. Only SignatureVersion 2 (SHA256withRSA) is accepted, and the
 * key is fetched only from the pinned certificate URL (`isSigningCertForTopic`). `getKey` errors
 * propagate, so a 5xx or network failure is a 500 that SNS retries; a null key is a refusal.
 */
export async function verifySnsSignature(
  message: SnsEnvelope,
  getKey: SnsKeyGetter,
): Promise<boolean> {
  if (
    message.SignatureVersion !== '2' ||
    !isSigningCertForTopic(message.SigningCertURL, message.TopicArn) ||
    !hasSignedFields(message)
  ) {
    return false;
  }
  const key = await getKey(message.SigningCertURL);
  if (key === null) {
    return false;
  }
  const verifier = createVerify('RSA-SHA256');
  verifier.update(canonicalSnsString(message), 'utf8');
  return verifier.verify(key, message.Signature, 'base64');
}

/**
 * Wraps `getKey` with a small cache: each URL is fetched at most once per 24 hours, at most 10
 * URLs are kept (the oldest is dropped first), and failures and missing keys are not cached.
 */
export function cachedKeyGetter(getKey: SnsKeyGetter, now: () => number): SnsKeyGetter {
  const cache = new Map<string, { readonly key: KeyObject; readonly at: number }>();
  return async (certUrl) => {
    const hit = cache.get(certUrl);
    if (hit && now() - hit.at < KEY_TTL_MS) {
      return hit.key;
    }
    const key = await getKey(certUrl);
    if (key === null) {
      return null;
    }
    cache.delete(certUrl);
    cache.set(certUrl, { key, at: now() });
    while (cache.size > MAX_KEYS) {
      const oldest = cache.keys().next();
      if (oldest.done === true) break;
      cache.delete(oldest.value);
    }
    return key;
  };
}

class NotAwsSnsUrlError extends Error {
  constructor() {
    // The URL is left out: it came from the request body.
    super('The URL is not an AWS SNS https URL.');
    this.name = 'NotAwsSnsUrlError';
  }
}

/** Reads at most `maxBytes` of `response`'s body; null when it is (or says it is) larger. */
async function readCapped(response: Response, maxBytes: number): Promise<string | null> {
  if (response.body === null) {
    return '';
  }
  if (Number(response.headers.get('content-length') ?? '0') > maxBytes) {
    await response.body.cancel();
    return null;
  }
  // The DOM typings give the stream `any` chunks; treat them as unknown and check each one.
  const reader: ReadableStreamDefaultReader<unknown> = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    if (!(value instanceof Uint8Array)) {
      await reader.cancel();
      return null;
    }
    size += value.byteLength;
    if (size > maxBytes) {
      await reader.cancel();
      return null;
    }
    chunks.push(value);
  }
  return Buffer.concat(chunks).toString('utf8');
}

/**
 * The default `SNS_KEY_FETCHER`: an HTTPS GET of the certificate (pinned URL shape only, no
 * redirects, 5 s, at most 16 KB), parsed strictly and checked for validity at `now()`. A 4xx is
 * a null key (not verified); a 5xx or network error throws so SNS retries.
 */
export async function fetchSnsSigningKey(
  certUrl: string,
  now: () => number,
): Promise<KeyObject | null> {
  if (!isAwsSnsUrl(certUrl) || !CERT_PATH.test(new URL(certUrl).pathname)) {
    throw new NotAwsSnsUrlError();
  }
  const response = await fetch(certUrl, {
    redirect: 'error',
    signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
  });
  if (response.status >= 400 && response.status < 500) {
    await response.body?.cancel();
    return null;
  }
  if (!response.ok) {
    await response.body?.cancel();
    throw new Error(`SNS answered ${response.status} for its signing certificate.`);
  }
  const pem = await readCapped(response, MAX_CERT_BYTES);
  return pem === null ? null : parseSnsCertificate(pem, now());
}

/** The default `SNS_SUBSCRIBE_FETCHER`: a GET of the SubscribeURL, AWS hosts only. */
export async function confirmSnsSubscription(subscribeUrl: string): Promise<void> {
  if (!isAwsSnsUrl(subscribeUrl)) {
    throw new NotAwsSnsUrlError();
  }
  const response = await fetch(subscribeUrl, {
    redirect: 'error',
    signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
  });
  await response.body?.cancel();
  if (!response.ok) {
    throw new Error(`SNS answered ${response.status} to the subscription confirmation.`);
  }
}
