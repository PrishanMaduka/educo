import { randomUUID } from 'node:crypto';

import { z } from 'zod';

import { TURNSTILE_SITEVERIFY_URL } from './turnstile';

import type { TurnstileCheck, TurnstileResult, TurnstileVerifier } from './turnstile';
import type { Logger } from 'pino';

/**
 * The part of siteverify's answer the API reads. Other fields (`challenge_ts`, `cdata`,
 * `metadata`, `messages`) are ignored; an answer without a boolean `success` is not siteverify's.
 */
export const SiteverifyResponse = z.object({
  success: z.boolean(),
  'error-codes': z.array(z.string()).default([]),
  hostname: z.string().optional(),
  action: z.string().optional(),
});
export type SiteverifyResponse = z.infer<typeof SiteverifyResponse>;

export interface CloudflareTurnstileOptions {
  readonly secret: string;
  /** `TURNSTILE_EXPECTED_HOSTNAME`: the site the widget must have run on. */
  readonly expectedHostname: string;
  readonly logger: Logger;
  /** Tests pass a fake; nothing in a test reaches Cloudflare. */
  readonly fetch?: typeof fetch;
  readonly timeoutMs?: number;
}

type Unavailable =
  { reason: 'timeout' | 'network' | 'body' } | { reason: 'status'; status: number };

const METRIC = 'turnstile_verify';

/**
 * Asks Cloudflare's siteverify about a token (D57). A token passes only when Cloudflare accepts
 * it, for our hostname and the form's action; one minted elsewhere fails. When Cloudflare cannot
 * be asked (network error, timeout, non-2xx or an answer that is not siteverify's), the outcome is
 * `unavailable`, and the caller refuses the request. Logs carry Cloudflare's error codes and the
 * outcome, never the token, the secret or the IP.
 */
export class CloudflareTurnstile implements TurnstileVerifier {
  static readonly DEFAULT_TIMEOUT_MS = 5000;

  private readonly fetch: typeof fetch;
  private readonly timeoutMs: number;

  constructor(private readonly options: CloudflareTurnstileOptions) {
    // A wrapper, so the global fetch is never called with this instance as `this`.
    this.fetch = options.fetch ?? ((input, init) => globalThis.fetch(input, init));
    this.timeoutMs = options.timeoutMs ?? CloudflareTurnstile.DEFAULT_TIMEOUT_MS;
  }

  async verify(check: TurnstileCheck): Promise<TurnstileResult> {
    const answer = await this.ask(check);
    if ('reason' in answer) {
      this.options.logger.warn(
        { metric: METRIC, outcome: 'unavailable', ...answer },
        'Turnstile siteverify was unavailable, so the request was refused',
      );
      return { outcome: 'unavailable' };
    }
    const errorCodes = answer['error-codes'];
    const reason = !answer.success
      ? 'rejected'
      : answer.hostname !== this.options.expectedHostname
        ? 'hostname'
        : answer.action !== check.action
          ? 'action'
          : null;
    if (reason !== null) {
      this.options.logger.info(
        { metric: METRIC, outcome: 'fail', reason, errorCodes },
        'Turnstile refused the token',
      );
      return { outcome: 'fail' };
    }
    this.options.logger.info({ metric: METRIC, outcome: 'pass' }, 'Turnstile passed the token');
    return { outcome: 'pass' };
  }

  /** One siteverify call, with the time limit covering the answer's body too. */
  private async ask(check: TurnstileCheck): Promise<SiteverifyResponse | Unavailable> {
    const signal = AbortSignal.timeout(this.timeoutMs);
    let response: Response;
    try {
      response = await this.fetch(TURNSTILE_SITEVERIFY_URL, {
        method: 'POST',
        body: new URLSearchParams({
          secret: this.options.secret,
          response: check.token,
          remoteip: check.remoteIp,
          idempotency_key: randomUUID(),
        }),
        signal,
      });
    } catch {
      // Never log the error itself: its message may carry the request.
      return { reason: signal.aborted ? 'timeout' : 'network' };
    }
    if (!response.ok) {
      return { reason: 'status', status: response.status };
    }
    try {
      const parsed = SiteverifyResponse.safeParse(await response.json());
      return parsed.success ? parsed.data : { reason: 'body' };
    } catch {
      return { reason: signal.aborted ? 'timeout' : 'body' };
    }
  }
}
