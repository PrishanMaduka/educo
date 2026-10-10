import { Inject, Injectable } from '@nestjs/common';

import { CaptchaFailedError, CaptchaUnavailableError } from '../../common/errors';
import { CONFIG, DEMO_REQUEST_EMAILS, LOGGER, TENANT_DB, TURNSTILE } from '../../tokens';

import { demoRequestEmailsFor } from './demo-request-emails';
import { leadIpHasher } from './lead-ip-hash';

import type { DemoRequestDetails, DemoRequestEmails } from './demo-request-emails';
import type { TurnstileVerifier } from '../../common/turnstile/turnstile';
import type { Config } from '../../config';
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

  constructor(
    @Inject(TENANT_DB) private readonly db: QuadTenantDb,
    @Inject(TURNSTILE) private readonly turnstile: TurnstileVerifier,
    @Inject(DEMO_REQUEST_EMAILS) private readonly emails: DemoRequestEmails,
    @Inject(LOGGER) private readonly logger: Logger,
    @Inject(CONFIG) config: Config,
  ) {
    this.hashIp = leadIpHasher(config.SESSION_SECRET);
  }

  /**
   * After the rate limits and the body: the honeypot, Turnstile, the lead, then its emails. A
   * honeypot hit, a new lead and an updated one all end the same way, so the caller's 202 never
   * tells a bot it was caught or a visitor that the email has asked before.
   */
  async submit({ body, ip, userAgent }: DemoRequestSubmission): Promise<void> {
    if (body.website !== undefined && body.website !== '') {
      this.logger.info({ metric: 'demo_request_honeypot' }, 'Demo request dropped: honeypot');
      return;
    }
    await this.verifyCaptcha(body.turnstileToken, ip);

    const details = detailsOf(body);
    const lead = await this.db.definers.recordDemoRequest(
      recordOf(details, this.hashIp(ip), cutUserAgent(userAgent)),
    );
    for (const email of demoRequestEmailsFor(lead.leadId, lead.created)) {
      await this.emails.queue({ ...email, leadId: lead.leadId, request: details });
    }
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
