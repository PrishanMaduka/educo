import { describe, expect, it } from 'vitest';

import {
  AuditEntry,
  AuditLog,
  AuditLogQuery,
  AuditPeople,
  PlatformAuditPeople,
  PlatformAuditEntry,
  PlatformAuditLogAction,
  PlatformAuditLogQuery,
} from '../index';

const pathOf = (result: { success: boolean; error?: { issues: { path: unknown[] }[] } }) =>
  result.error?.issues[0]?.path;

const ID = '018f6b3a-0000-7000-8000-000000000001';

describe('AuditLogQuery (GET /audit)', () => {
  it('takes the filters and a page, with the default page size', () => {
    expect(
      AuditLogQuery.parse({
        actor: ID,
        action: 'user.invited',
        from: '2026-10-01T00:00:00.000Z',
        to: '2026-10-08T00:00:00.000Z',
      }),
    ).toEqual({
      actor: ID,
      action: 'user.invited',
      from: '2026-10-01T00:00:00.000Z',
      to: '2026-10-08T00:00:00.000Z',
      limit: 50,
    });
    expect(AuditLogQuery.parse({ limit: '200', cursor: 'abc' })).toEqual({
      limit: 200,
      cursor: 'abc',
    });
  });

  it.each([
    [{ actor: 'someone' }, 'actor'],
    [{ action: 'tenant.renamed' }, 'action'],
    [{ action: 'made.up' }, 'action'],
    [{ from: '2026-10-01' }, 'from'],
    [{ to: '2026-10-01T00:00:00+05:30' }, 'to'],
    [{ from: '2026-10-08T00:00:00Z', to: '2026-10-01T00:00:00Z' }, 'to'],
    [{ from: '2026-10-08T00:00:00Z', to: '2026-10-08T00:00:00Z' }, 'to'],
    [{ limit: '201' }, 'limit'],
  ])('refuses %j on %s', (query, path) => {
    expect(pathOf(AuditLogQuery.safeParse(query))).toEqual([path]);
  });
});

describe('the from/to range', () => {
  // Compared as instants, not as text: '…00Z' sorts after '…00.5Z' as text (Task 15 review M1).
  it.each([
    ['2026-10-08T00:00:00Z', '2026-10-08T00:00:00.5Z'],
    ['2026-10-08T00:00:00.000001Z', '2026-10-08T00:00:00.000002Z'],
    ['2026-10-08T00:00:00.9Z', '2026-10-08T00:00:01Z'],
    ['2026-10-08T23:59:59.999999Z', '2026-10-09T00:00:00Z'],
  ])('accepts from %s before to %s', (from, to) => {
    expect(AuditLogQuery.safeParse({ from, to }).success).toBe(true);
    expect(PlatformAuditLogQuery.safeParse({ from, to }).success).toBe(true);
  });

  it.each([
    ['2026-10-08T00:00:00.5Z', '2026-10-08T00:00:00Z'],
    ['2026-10-08T00:00:00.500Z', '2026-10-08T00:00:00.5Z'],
    ['2026-10-08T00:00:00Z', '2026-10-08T00:00:00.000Z'],
    ['2026-10-08T00:00:00.000002Z', '2026-10-08T00:00:00.000001Z'],
  ])('refuses from %s not before to %s', (from, to) => {
    expect(pathOf(AuditLogQuery.safeParse({ from, to }))).toEqual(['to']);
    expect(pathOf(PlatformAuditLogQuery.safeParse({ from, to }))).toEqual(['to']);
  });
});

describe('AuditEntry and AuditLog', () => {
  const entry = {
    id: ID,
    at: '2026-10-08T06:30:00.000Z',
    action: 'user.invited',
    summary: 'Invited Nadeesha Jayasinghe',
    actor: { type: 'member', id: ID, name: 'Prishan Maduka' },
    viaSupport: false,
    target: { type: 'user', id: ID },
    meta: { resent: false },
    ip: '203.0.113.8',
  };

  it('accepts a member, Quad support or the system as the actor', () => {
    expect(AuditEntry.parse(entry)).toEqual(entry);
    for (const actor of [{ type: 'quad_support' }, { type: 'system' }]) {
      expect(AuditEntry.safeParse({ ...entry, actor, viaSupport: true }).success).toBe(true);
    }
    expect(AuditLog.parse({ items: [entry], nextCursor: null }).items).toHaveLength(1);
  });

  it('refuses a member without a name, and an actor type it does not know', () => {
    expect(pathOf(AuditEntry.safeParse({ ...entry, actor: { type: 'member', id: ID } }))).toEqual([
      'actor',
      'name',
    ]);
    expect(pathOf(AuditEntry.safeParse({ ...entry, actor: { type: 'quad' } }))).toEqual([
      'actor',
      'type',
    ]);
  });
});

describe('AuditPeople (GET /audit/people)', () => {
  it('accepts the members who appear in the log, each with an id and a name', () => {
    const people = { items: [{ id: ID, name: 'Prishan Maduka' }] };
    expect(AuditPeople.parse(people)).toEqual(people);
  });

  it('refuses a person without a name', () => {
    expect(pathOf(AuditPeople.safeParse({ items: [{ id: ID }] }))).toEqual(['items', 0, 'name']);
  });
});

describe('PlatformAuditLogQuery (GET /platform/audit)', () => {
  it('takes the console and the copied school actions, and a school', () => {
    expect(PlatformAuditLogAction.options).toEqual(
      expect.arrayContaining(['tenant.renamed', 'audit.exported', 'user.invited']),
    );
    // Each key once, though the two lists share some.
    expect(new Set(PlatformAuditLogAction.options).size).toBe(
      PlatformAuditLogAction.options.length,
    );
    expect(PlatformAuditLogQuery.parse({ tenantId: ID, action: 'tenant.renamed' })).toEqual({
      tenantId: ID,
      action: 'tenant.renamed',
      limit: 50,
    });
  });

  it.each([
    [{ tenantId: 'school-a' }, 'tenantId'],
    [{ actor: 'x' }, 'actor'],
    [{ action: 'made.up' }, 'action'],
    [{ from: '2026-10-08T00:00:00Z', to: '2026-10-01T00:00:00Z' }, 'to'],
  ])('refuses %j on %s', (query, path) => {
    expect(pathOf(PlatformAuditLogQuery.safeParse(query))).toEqual([path]);
  });

  it('describes a console entry with its school, or none', () => {
    const entry = {
      id: ID,
      at: '2026-10-08T06:30:00.000Z',
      action: 'tenant.renamed',
      summary: 'Renamed the school from “A” to “B”',
      actor: { type: 'system' },
      school: { id: ID, name: 'B' },
      viaSupport: false,
      target: { type: 'tenant', id: ID },
      meta: { from: 'A', to: 'B' },
      ip: null,
    };
    expect(PlatformAuditEntry.parse(entry)).toEqual(entry);
    expect(PlatformAuditEntry.safeParse({ ...entry, school: null }).success).toBe(true);
    expect(pathOf(PlatformAuditEntry.safeParse({ ...entry, actor: { type: 'member' } }))).toEqual([
      'actor',
      'type',
    ]);
  });
});

describe('PlatformAuditPeople (GET /platform/audit/people)', () => {
  it('accepts the Quad staff who appear in the console log, each with an id and a name', () => {
    const people = { items: [{ id: ID, name: 'Nora Lindqvist' }] };
    expect(PlatformAuditPeople.parse(people)).toEqual(people);
  });

  it('refuses a person without a name', () => {
    expect(pathOf(PlatformAuditPeople.safeParse({ items: [{ id: ID }] }))).toEqual([
      'items',
      0,
      'name',
    ]);
  });
});
