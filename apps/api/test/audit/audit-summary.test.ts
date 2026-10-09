import { AuditAction, PlatformAuditAction } from '@quad/contracts';
import { describe, expect, it } from 'vitest';

import { auditSummary } from '../../src/common/audit/audit-summary';

import type { SummaryInput } from '../../src/common/audit/audit-summary';

const entry = (overrides: Partial<SummaryInput>): SummaryInput => ({
  action: 'auth.sign_in',
  targetType: null,
  targetName: null,
  meta: {},
  ...overrides,
});

describe('auditSummary', () => {
  it.each([
    [{ action: 'auth.sign_in' }, 'Signed in'],
    [
      { action: 'user.invited', targetType: 'user', targetName: 'Nadeesha Jayasinghe' },
      'Invited Nadeesha Jayasinghe',
    ],
    [
      {
        action: 'user.invited',
        targetType: 'user',
        targetName: 'Nadeesha Jayasinghe',
        meta: { resent: true },
      },
      'Sent Nadeesha Jayasinghe a new invitation',
    ],
    [{ action: 'user.deactivated', targetType: 'user' }, 'Deactivated a member of staff'],
    [
      { action: 'role.deleted', targetType: 'role', meta: { name: 'Bursar' } },
      'Deleted the role Bursar',
    ],
    [{ action: 'role_preview.ended', targetType: 'role' }, 'Stopped previewing a role'],
    [
      { action: 'role.permissions_changed', targetType: 'role', targetName: 'Teacher' },
      'Changed what the role Teacher can do',
    ],
    [
      { action: 'settings.updated', meta: { fields: ['officeEmail', 'address'] } },
      'Changed School settings: office email and address',
    ],
    [
      { action: 'settings.updated', meta: { fields: ['name', 'officePhone', 'futureField'] } },
      'Changed School settings: name, office phone, and futureField',
    ],
    [{ action: 'settings.updated', meta: {} }, 'Changed School settings'],
    [{ action: 'audit.exported', meta: { rows: 1 } }, 'Exported the audit log (1 entry)'],
    [{ action: 'audit.exported', meta: { rows: 1200 } }, 'Exported the audit log (1,200 entries)'],
    [{ action: 'sensitive.accessed', meta: { key: 'medical' } }, 'Viewed medical details'],
    [{ action: 'sensitive.accessed', meta: { key: 'unknown' } }, 'Viewed sensitive records'],
    [
      { action: 'tenant.renamed', meta: { from: 'Old School', to: 'New School' } },
      'Renamed the school from “Old School” to “New School”',
    ],
    [{ action: 'made_up.key' }, 'made_up.key'],
  ] as const)('%j reads “%s”', (input, line) => {
    expect(auditSummary(entry(input))).toBe(line);
  });

  it('has a line for every school and console action, without a raw placeholder', () => {
    for (const action of [...AuditAction.options, ...PlatformAuditAction.options]) {
      const line = auditSummary(entry({ action, targetType: 'user' }));
      expect(line).not.toBe(action);
      expect(line).not.toMatch(/[{}]/);
    }
  });
});
