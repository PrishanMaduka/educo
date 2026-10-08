import { describe, expect, it } from 'vitest';

import { ConfigError, loadConfig } from '../../src/config';
import { localEnv, productionEnv } from '../env';

function problemsOf(env: NodeJS.ProcessEnv): string[] {
  try {
    loadConfig(env);
  } catch (error) {
    if (error instanceof ConfigError)
      return error.problems.map((p) => `${p.variable} ${p.problem}`);
    throw error;
  }
  return [];
}

describe('email and SMS settings at boot', () => {
  it('accepts SMTP with an SMTP_URL, and SES with its region and sending domain', () => {
    expect(
      problemsOf(localEnv({ EMAIL_PROVIDER: 'smtp', SMTP_URL: 'smtp://localhost:1025' })),
    ).toEqual([]);
    expect(
      problemsOf(
        productionEnv({
          EMAIL_PROVIDER: 'ses',
          SES_REGION: 'ap-south-1',
          EMAIL_FROM_DOMAIN: 'mail.quad-edu.com',
        }),
      ),
    ).toEqual([]);
  });

  it('refuses EMAIL_PROVIDER=smtp without SMTP_URL', () => {
    expect(problemsOf(localEnv({ EMAIL_PROVIDER: 'smtp' }))).toEqual([
      'SMTP_URL is missing (EMAIL_PROVIDER=smtp needs it)',
    ]);
  });

  it('refuses EMAIL_PROVIDER=ses without SES_REGION and EMAIL_FROM_DOMAIN', () => {
    expect(problemsOf(productionEnv({ EMAIL_PROVIDER: 'ses' }))).toEqual([
      'SES_REGION is missing (EMAIL_PROVIDER=ses needs it)',
      'EMAIL_FROM_DOMAIN is missing (EMAIL_PROVIDER=ses needs it)',
    ]);
  });

  it('refuses SMS_PROVIDER=live until live SMS ships in M6 (OQ12)', () => {
    expect(problemsOf(localEnv({ SMS_PROVIDER: 'live' }))).toEqual([
      'SMS_PROVIDER must be log until live SMS ships (M6, OQ12)',
    ]);
  });
});
