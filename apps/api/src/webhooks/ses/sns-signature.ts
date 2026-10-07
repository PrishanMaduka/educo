import { createPublicKey, createVerify } from 'node:crypto';

import type { SnsEnvelope } from '@quad/contracts';

/** Returns the PEM certificate (or public key) published at an SNS `SigningCertURL`. */
export type SnsKeyGetter = (certUrl: string) => Promise<string>;

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
 * True when `certUrl` is an AWS SNS URL in the topic's own region (`sns.<region>.amazonaws.com`),
 * so a certificate from another region's host is refused even though it is AWS's.
 */
export function isSigningCertForTopic(certUrl: string, topicArn: string): boolean {
  const region = TOPIC_ARN.exec(topicArn)?.[1];
  if (region === undefined || !isAwsSnsUrl(certUrl)) {
    return false;
  }
  return new URL(certUrl).hostname === `sns.${region}.amazonaws.com`;
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
 * key is fetched only from an AWS SNS host (`isAwsSnsUrl`). `getKey` errors propagate, so a
 * failed certificate download is a 500 that SNS retries, not a silent refusal.
 */
export async function verifySnsSignature(
  message: SnsEnvelope,
  getKey: SnsKeyGetter,
): Promise<boolean> {
  if (
    message.SignatureVersion !== '2' ||
    !isAwsSnsUrl(message.SigningCertURL) ||
    !hasSignedFields(message)
  ) {
    return false;
  }
  const pem = await getKey(message.SigningCertURL);
  let key: ReturnType<typeof createPublicKey>;
  try {
    // Accepts a PEM certificate (what SNS publishes) or a PEM public key.
    key = createPublicKey(pem);
  } catch {
    return false;
  }
  const verifier = createVerify('RSA-SHA256');
  verifier.update(canonicalSnsString(message), 'utf8');
  return verifier.verify(key, message.Signature, 'base64');
}

/**
 * Wraps `getKey` with a small cache: each URL is fetched at most once per 24 hours, at most 10
 * URLs are kept (the oldest is dropped first), and failures are not cached.
 */
export function cachedKeyGetter(getKey: SnsKeyGetter, now: () => number = Date.now): SnsKeyGetter {
  const cache = new Map<string, { readonly pem: string; readonly at: number }>();
  return async (certUrl) => {
    const hit = cache.get(certUrl);
    if (hit && now() - hit.at < KEY_TTL_MS) {
      return hit.pem;
    }
    const pem = await getKey(certUrl);
    cache.delete(certUrl);
    cache.set(certUrl, { pem, at: now() });
    while (cache.size > MAX_KEYS) {
      const oldest = cache.keys().next();
      if (oldest.done === true) break;
      cache.delete(oldest.value);
    }
    return pem;
  };
}

class NotAwsSnsUrlError extends Error {
  constructor() {
    // The URL is left out: it came from the request body.
    super('The URL is not an AWS SNS https URL.');
    this.name = 'NotAwsSnsUrlError';
  }
}

async function getFromSns(url: string): Promise<Response> {
  if (!isAwsSnsUrl(url)) {
    throw new NotAwsSnsUrlError();
  }
  const response = await fetch(url, {
    redirect: 'error',
    signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
  });
  if (!response.ok) {
    await response.body?.cancel();
    throw new Error(`SNS answered ${response.status}.`);
  }
  return response;
}

/** The default `SNS_KEY_FETCHER`: an HTTPS GET of the signing certificate, AWS hosts only. */
export async function fetchSnsSigningKey(certUrl: string): Promise<string> {
  const response = await getFromSns(certUrl);
  const pem = await response.text();
  if (pem.length > MAX_CERT_BYTES) {
    throw new Error('The SNS signing certificate is unexpectedly large.');
  }
  return pem;
}

/** The default `SNS_SUBSCRIBE_FETCHER`: a GET of the SubscribeURL, AWS hosts only. */
export async function confirmSnsSubscription(subscribeUrl: string): Promise<void> {
  const response = await getFromSns(subscribeUrl);
  await response.body?.cancel();
}
