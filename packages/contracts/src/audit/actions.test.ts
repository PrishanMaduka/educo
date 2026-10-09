import { describe, expect, it } from 'vitest';

import { AuditAction, PlatformAuditAction } from '../index';

describe('audit action keys', () => {
  it('lists the school actions of spec 05 → Audit as stable area.verb keys', () => {
    expect(AuditAction.options).toEqual([
      'auth.sign_in',
      'auth.sign_in_failed',
      'auth.sign_out',
      'auth.password_reset',
      'auth.two_step_enabled',
      'user.invited',
      'user.role_changed',
      'user.deactivated',
      'user.reactivated',
      'user.two_step_reminded',
      'user.password_reset_sent',
      'user.signed_out_everywhere',
      'role.created',
      'role.updated',
      'role.deleted',
      'role.permissions_changed',
      'role_preview.started',
      'role_preview.ended',
      'settings.updated',
      'support_session.started',
      'support_session.ended',
      'audit.exported',
    ]);
  });

  it('lists the platform actions, including the ones the definers write themselves', () => {
    // update_current_tenant_name and end_support_session (0006) write these two directly.
    expect(PlatformAuditAction.options).toEqual(
      expect.arrayContaining(['tenant.renamed', 'support_session.ended']),
    );
  });

  it('keeps every key in area.verb form', () => {
    for (const key of [...AuditAction.options, ...PlatformAuditAction.options]) {
      expect(key).toMatch(/^[a-z_]+\.[a-z_]+$/);
    }
  });
});
