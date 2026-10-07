import { describe, expect, it, vi } from 'vitest';

import { CLOSED_PORTS, useTestApp } from '../app';

import { confirmation, makeSigningKey, signEnvelope } from './sns-fixtures';

import type { KeyObject } from 'node:crypto';

const keys = makeSigningKey();
const fetchKey = vi.fn<(certUrl: string) => Promise<KeyObject | null>>(() => Promise.resolve(null));
const subscribe = vi.fn<(url: string) => Promise<void>>(() => Promise.resolve());
const app = useTestApp(
  { ...CLOSED_PORTS, SES_SNS_TOPIC_ARN: undefined },
  { overrides: { snsFetchers: { key: fetchKey, subscribe } } },
);

describe('POST /webhooks/ses without SES_SNS_TOPIC_ARN', () => {
  it('refuses every message, even a correctly signed one, before fetching anything', async () => {
    const response = await app()
      .getHttpAdapter()
      .getInstance()
      .inject({
        method: 'POST',
        url: '/api/v1/webhooks/ses',
        headers: { 'content-type': 'text/plain' },
        payload: JSON.stringify(signEnvelope(confirmation(), keys.privateKey)),
      });
    expect(response.statusCode).toBe(403);
    expect(fetchKey).not.toHaveBeenCalled();
    expect(subscribe).not.toHaveBeenCalled();
  });
});
