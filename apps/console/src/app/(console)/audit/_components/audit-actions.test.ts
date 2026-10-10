import { PlatformAuditLogAction } from '@quad/contracts';
import en from '@quad/contracts/i18n/en.json';
import { describe, expect, it } from 'vitest';

import { PLATFORM_AUDIT_ACTIONS, platformAuditActionOf, platformGroupOf } from './audit-actions';

describe('the console audit log’s actions', () => {
  it('offers every action platform_audit records, each with a label', () => {
    expect(PLATFORM_AUDIT_ACTIONS).toEqual(PlatformAuditLogAction.options);
    const labels: Record<string, string> = en;
    for (const action of PLATFORM_AUDIT_ACTIONS) {
      expect(labels[`console.audit.action.${action}`], action).toBeTruthy();
    }
  });

  it.each([
    ['auth.sign_in', 'signIn'],
    ['auth.two_step_setup_started', 'signIn'],
    ['support_session.started', 'support'],
    ['tenant.renamed', 'console'],
    ['audit.exported', 'console'],
    ['settings.updated', 'school'],
    ['role_preview.started', 'school'],
  ] as const)('puts %s under %s', (action, group) => {
    expect(platformGroupOf(action)).toBe(group);
  });

  it('accepts only a recorded action from the filter', () => {
    expect(platformAuditActionOf('tenant.renamed')).toBe('tenant.renamed');
    expect(platformAuditActionOf('made.up')).toBeNull();
  });
});
