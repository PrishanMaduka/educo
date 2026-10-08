import { execFileSync } from 'node:child_process';
import { createSign, generateKeyPairSync, randomUUID } from 'node:crypto';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { canonicalSnsString } from '../../src/webhooks/ses/sns-signature';

import type { SnsEnvelope } from '@quad/contracts';

/** The topic the test app is configured with (`SES_SNS_TOPIC_ARN`). */
export const TEST_TOPIC_ARN = 'arn:aws:sns:ap-south-1:123456789012:quad-test-ses-events';
export const TEST_CERT_URL =
  'https://sns.ap-south-1.amazonaws.com/SimpleNotificationService-0123456789abcdef0123456789abcdef.pem';

/**
 * A throwaway self-signed certificate (valid for 30 days from now) and its private key, made at
 * runtime with the openssl CLI because Node cannot create X.509 certificates. Nothing is fetched
 * from AWS in tests.
 */
export function makeSigningCert(): { privateKey: string; certPem: string } {
  const dir = mkdtempSync(join(tmpdir(), 'quad-sns-'));
  try {
    const keyPath = join(dir, 'key.pem');
    const certPath = join(dir, 'cert.pem');
    execFileSync(
      'openssl',
      [
        'req',
        '-x509',
        '-newkey',
        'rsa:2048',
        '-nodes',
        '-days',
        '30',
        '-subj',
        '/CN=sns.amazonaws.com',
        '-keyout',
        keyPath,
        '-out',
        certPath,
      ],
      { stdio: 'ignore', input: '' },
    );
    return { privateKey: readFileSync(keyPath, 'utf8'), certPem: readFileSync(certPath, 'utf8') };
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

/** A throwaway RSA key pair made at runtime; nothing is fetched from AWS in tests. */
export function makeSigningKey(): { privateKey: string; publicKey: string } {
  return generateKeyPairSync('rsa', {
    modulusLength: 2048,
    publicKeyEncoding: { type: 'spki', format: 'pem' },
    privateKeyEncoding: { type: 'pkcs8', format: 'pem' },
  });
}

/** Signs `envelope` the way SNS does for SignatureVersion 2 (SHA256withRSA, base64). */
export function signEnvelope(envelope: SnsEnvelope, privateKey: string): SnsEnvelope {
  const signer = createSign('RSA-SHA256');
  signer.update(canonicalSnsString(envelope));
  return { ...envelope, Signature: signer.sign(privateKey, 'base64') };
}

/** An unsigned SNS envelope with sensible defaults; sign it with `signEnvelope`. */
export function envelope(overrides: Partial<SnsEnvelope> = {}): SnsEnvelope {
  return {
    Type: 'Notification',
    MessageId: randomUUID(),
    TopicArn: TEST_TOPIC_ARN,
    Subject: 'Amazon SES Email Event Notification',
    Message: '{}',
    Timestamp: new Date().toISOString(),
    SignatureVersion: '2',
    Signature: 'unsigned',
    SigningCertURL: TEST_CERT_URL,
    ...overrides,
  };
}

/** A SubscriptionConfirmation from the test topic. */
export function confirmation(overrides: Partial<SnsEnvelope> = {}): SnsEnvelope {
  return envelope({
    Type: 'SubscriptionConfirmation',
    Subject: undefined,
    Message: 'You have chosen to subscribe to the topic.',
    SubscribeURL: `https://sns.ap-south-1.amazonaws.com/?Action=ConfirmSubscription&TopicArn=${TEST_TOPIC_ARN}&Token=t`,
    Token: 't',
    ...overrides,
  });
}
