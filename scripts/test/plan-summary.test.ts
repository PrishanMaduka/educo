import { describe, expect, it } from 'vitest';

import { actionOf, summarizePlan } from '../plan-summary.mjs';

const change = (address: string, actions: string[], extra: Record<string, unknown> = {}) => ({
  address,
  change: { actions, before: { secret: 'old-value' }, after: { secret: 'new-value' }, ...extra },
});

/** The shape of `terraform show -json tfplan`, trimmed. */
const plan = {
  format_version: '1.2',
  resource_changes: [
    change('module.app.aws_ecs_service.this["api"]', ['update']),
    change('module.app.aws_ssm_parameter.deploy["cluster"]', ['create']),
    change('module.data.aws_db_instance.this', ['delete', 'create']),
    change('module.edge.aws_lb.this', ['no-op']),
    change('data.aws_caller_identity.current', ['read']),
    change('module.dns.aws_route53_record.old', ['delete']),
  ],
  resource_drift: [change('module.app.aws_ecs_service.this["worker"]', ['update'])],
};

describe('actionOf', () => {
  it.each([
    [['create'], 'create'],
    [['update'], 'update'],
    [['delete'], 'delete'],
    [['delete', 'create'], 'replace'],
    [['create', 'delete'], 'replace'],
    [['no-op'], 'no-op'],
    [['read'], 'read'],
  ])('%j is %s', (actions, action) => {
    expect(actionOf(actions)).toBe(action);
  });
});

describe('summarizePlan', () => {
  const summary = summarizePlan(plan, { title: 'Terraform plan for `infra/envs/staging`' });

  it('counts like terraform: a replacement adds one and destroys one', () => {
    expect(summary).toContain('**2 to add, 1 to change, 2 to destroy.**');
  });

  it('lists each changed resource with its action, skipping no-ops and reads', () => {
    expect(summary).toContain('| update | `module.app.aws_ecs_service.this["api"]` |');
    expect(summary).toContain('| replace | `module.data.aws_db_instance.this` |');
    expect(summary).not.toContain('aws_lb.this');
    expect(summary).not.toContain('aws_caller_identity');
  });

  it('never includes attribute values (I1: the repository is public)', () => {
    expect(summary).not.toContain('old-value');
    expect(summary).not.toContain('new-value');
    expect(summary).not.toContain('secret');
  });

  it('says so when nothing changes', () => {
    expect(
      summarizePlan({ resource_changes: [change('a.b', ['no-op'])] }, { title: 'T' }),
    ).toContain('No changes.');
  });

  it('summarizes drift from resource_drift for a refresh-only plan', () => {
    const drift = summarizePlan(plan, { title: 'Drift', drift: true });
    expect(drift).toContain('**1 resource changed outside Terraform.**');
    expect(drift).toContain('| update | `module.app.aws_ecs_service.this["worker"]` |');
    expect(drift).not.toContain('aws_db_instance');
  });

  it('escapes table pipes and backticks in addresses', () => {
    const odd = summarizePlan(
      { resource_changes: [change('a.b["x|`y"]', ['create'])] },
      { title: 'T' },
    );
    expect(odd).toContain('a.b["x\\|\'y"]');
  });

  it('caps the list and says how many more there are', () => {
    const many = {
      resource_changes: Array.from({ length: 205 }, (_, i) =>
        change(`a.r${String(i)}`, ['create']),
      ),
    };
    const text = summarizePlan(many, { title: 'T' });
    expect(text).toContain('**205 to add, 0 to change, 0 to destroy.**');
    expect(text).toContain('`a.r199`');
    expect(text).not.toContain('`a.r200`');
    expect(text).toContain('… and 5 more.');
  });
});
