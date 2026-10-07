import { createSign, generateKeyPairSync, randomUUID } from 'node:crypto';

import { canonicalSnsString } from '../../src/webhooks/ses/sns-signature';

import type { SnsEnvelope } from '@quad/contracts';

/** The topic the test app is configured with (`SES_SNS_TOPIC_ARN`). */
export const TEST_TOPIC_ARN = 'arn:aws:sns:ap-south-1:123456789012:quad-test-ses-events';
export const TEST_CERT_URL =
  'https://sns.ap-south-1.amazonaws.com/SimpleNotificationService-test.pem';

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
