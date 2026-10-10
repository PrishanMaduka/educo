import { randomUUID } from 'node:crypto';

import { Inject, Injectable } from '@nestjs/common';

import { CaptchaFailedError, CaptchaUnavailableError, RateLimitedError } from '../../common/errors';
import { RateLimitService } from '../../common/rate-limit/rate-limit.service';
import { salesInboxOf } from '../../config';
import { CLOCK, CONFIG, DELIVERY, LOGGER, TENANT_DB, TURNSTILE } from '../../tokens';

import { demoRequestEmailJobs } from './demo-request-emails';
import { leadIpHasher } from './lead-ip-hash';

import type { DemoRequestDetails, DemoRequestEmailSettings } from './demo-request-emails';
import type { DeliveryQueue } from '../../common/delivery/delivery.service';
import type { TurnstileVerifier } from '../../common/turnstile/turnstile';
import type { Config } from '../../config';
import type { Clock } from '../../tokens';
import type { DemoRequestBody, LeadKind } from '@quad/contracts';
import type { DemoRequestRecord, QuadTenantDb } from '@quad/db';
import type { Logger } from 'pino';

/** One parsed demo request and what the route knows about its sender. */
export interface DemoRequestSubmission {
  readonly body: DemoRequestBody;
  /** `request.ip`, from Fastify's `trustProxy` (`TRUST_PROXY_HOPS`); never X-Forwarded-For. */
  readonly ip: string;
  readonly userAgent: string | undefined;
}

/**
 * OQ4: 3 a day per email, so the confirmation cannot be used to flood an inbox. Counted after
 * Turnstile (D57), so no one can use up a prospect's requests without solving the captcha.
 */
const PER_EMAIL = { limit: 3, windowSeconds: 24 * 60 * 60 } as const;

/**
 * The per-email rate-limit subject: trimmed, NFKC-normalised and lower-cased, so `A@x.com`,
 * ` a@x.com ` and a full-width spelling are one subject. Only its HMAC reaches Redis.
 */
export function normalisedEmail(email: string): string {
  return email.normalize('NFKC').trim().toLowerCase();
}

/** `platform_leads.user_agent` holds at most 400 characters. */
const USER_AGENT_MAX = 400;

const LEAD_KINDS = {
  school: 'school_demo',
  parent: 'parent_intro',
} as const satisfies Record<DemoRequestBody['kind'], LeadKind>;

/** At most 400 characters (code points, as Postgres counts them); none when the header is blank. */
function cutUserAgent(userAgent: string | undefined): string | null {
  if (userAgent === undefined || userAgent.trim() === '') return null;
  return Array.from(userAgent).slice(0, USER_AGENT_MAX).join('');
}

/** The request without the anti-spam fields, as the emails get it. */
function detailsOf(body: DemoRequestBody): DemoRequestDetails {
  const { name, email, school } = body;
  if (body.kind === 'school') {
    const { students, curriculum, country } = body;
    return { kind: 'school', name, email, school, students, curriculum, country };
  }
  const { city, note } = body;
  return { kind: 'parent', name, email, school, city, note };
}

function recordOf(
  details: DemoRequestDetails,
  ipHash: Buffer,
  userAgent: string | null,
): DemoRequestRecord {
  const { name, email, school } = details;
  const common = { kind: LEAD_KINDS[details.kind], name, email, school, ipHash, userAgent };
  if (details.kind === 'school') {
    return {
      ...common,
      students: details.students,
      curriculum: details.curriculum,
      country: details.country ?? null,
      city: null,
      note: null,
    };
  }
  return {
    ...common,
    students: null,
    curriculum: null,
    country: null,
    city: details.city ?? null,
    note: details.note ?? null,
  };
}

/**
 * The landing page's demo and "tell my school" requests (spec 19; D57). Tenant-less (D16): it
 * opens no school, account or platform transaction, and writes only through the
 * `record_demo_request` definer; the school name is free text that is only stored.
 */
@Injectable()
export class DemoRequestsService {
  private readonly hashIp: (ip: string) => Buffer;
  private readonly emailSettings: DemoRequestEmailSettings;

  constructor(
    @Inject(TENANT_DB) private readonly db: QuadTenantDb,
    @Inject(TURNSTILE) private readonly turnstile: TurnstileVerifier,
    @Inject(DELIVERY) private readonly delivery: DeliveryQueue,
    private readonly limits: RateLimitService,
    @Inject(CLOCK) private readonly now: Clock,
    @Inject(LOGGER) private readonly logger: Logger,
    @Inject(CONFIG) config: Config,
  ) {
    this.hashIp = leadIpHasher(config.SESSION_SECRET);
    this.emailSettings = { salesInbox: salesInboxOf(config), consoleUrl: config.CONSOLE_URL };
  }

  /**
   * After the per-IP limit and the body: the honeypot, Turnstile, the per-email limit, the lead,
   * then its emails. A honeypot hit, a new lead and an updated one all end the same way, so the
   * caller's 202 never tells a bot it was caught or a visitor that the email has asked before.
   */
  async submit({ body, ip, userAgent }: DemoRequestSubmission): Promise<void> {
    if (body.website !== undefined && body.website !== '') {
      this.logger.info({ metric: 'demo_request_honeypot' }, 'Demo request dropped: honeypot');
      return;
    }
    await this.verifyCaptcha(body.turnstileToken, ip);
    await this.countEmail(body.email);

    const details = detailsOf(body);
    const lead = await this.db.definers.recordDemoRequest(
      recordOf(details, this.hashIp(ip), cutUserAgent(userAgent)),
    );
    this.logger.info(
      { leadId: lead.leadId, created: lead.created, kind: LEAD_KINDS[details.kind] },
      'Demo request stored',
    );
    // Both emails in one transaction: a failure never leaves sales told and the requester not.
    await this.delivery.queueEmails(
      demoRequestEmailJobs(lead, details, this.emailSettings, randomUUID()),
    );
  }

  /**
   * The per-email limit, as `@RateLimit` would count it (HMAC subject, fixed window, 429 with
   * Retry-After). Fails open when Redis cannot answer, as every route limit does (D32).
   */
  private async countEmail(email: string): Promise<void> {
    const subject = this.limits.hashSubject(normalisedEmail(email));
    const result = await this.limits
      .hit(`demo-request:email:h:${subject}`, PER_EMAIL.limit, PER_EMAIL.windowSeconds, this.now())
      .catch((error: unknown) => {
        this.logger.warn(
          {
            metric: 'rate_limit_unavailable',
            reason: error instanceof Error ? error.name : 'unknown',
          },
          'Rate limits skipped: Redis did not answer',
        );
        return null;
      });
    if (result !== null && !result.allowed) throw new RateLimitedError(result.retryAfter);
  }

  private async verifyCaptcha(token: string, remoteIp: string): Promise<void> {
    const { outcome } = await this.turnstile.verify({ token, remoteIp, action: 'demo-request' });
    switch (outcome) {
      case 'pass':
        return;
      case 'fail':
        throw new CaptchaFailedError();
      case 'unavailable':
        this.logger.warn(
          { metric: 'demo_request_captcha_unavailable' },
          'Demo request refused: Turnstile could not be asked',
        );
        throw new CaptchaUnavailableError();
    }
  }
}
