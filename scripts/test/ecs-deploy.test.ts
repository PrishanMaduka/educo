import { describe, expect, it } from 'vitest';

import {
  DEPLOY_TAGS,
  parseDeployArgs,
  renderTaskDefinition,
  runDeploy,
  runTaskArgs,
  taskOutcome,
  updateServiceArgs,
} from '../ecs-deploy.mjs';

/** What `aws ecs describe-task-definition` returns under `taskDefinition`, trimmed. */
const current = {
  taskDefinitionArn: 'arn:aws:ecs:ap-south-1:222222222222:task-definition/quad-staging-api:7',
  family: 'quad-staging-api',
  revision: 7,
  status: 'ACTIVE',
  requiresAttributes: [{ name: 'com.amazonaws.ecs.capability.logging-driver.awslogs' }],
  compatibilities: ['EC2', 'FARGATE'],
  registeredAt: '2026-10-07T10:00:00Z',
  registeredBy: 'arn:aws:sts::222222222222:assumed-role/quad-staging-deploy/gh',
  networkMode: 'awsvpc',
  containerDefinitions: [
    {
      name: 'api',
      image: '222222222222.dkr.ecr.ap-south-1.amazonaws.com/quad/api:old',
      environment: [
        { name: 'APP_ENV', value: 'staging' },
        { name: 'SENTRY_RELEASE', value: 'old' },
      ],
    },
    { name: 'sidecar', image: 'example/sidecar:1' },
  ],
};

const newImage = '222222222222.dkr.ecr.ap-south-1.amazonaws.com/quad/api@sha256:abc';

describe('renderTaskDefinition', () => {
  const rendered = renderTaskDefinition(current, {
    container: 'api',
    image: newImage,
    environment: { SENTRY_RELEASE: 'f00d' },
  });

  it('drops the read-only fields that register-task-definition refuses', () => {
    for (const field of [
      'taskDefinitionArn',
      'revision',
      'status',
      'requiresAttributes',
      'compatibilities',
      'registeredAt',
      'registeredBy',
    ]) {
      expect(rendered).not.toHaveProperty(field);
    }
    expect(rendered).toMatchObject({ family: 'quad-staging-api', networkMode: 'awsvpc' });
  });

  it('sets the image on the named container only', () => {
    const [api, sidecar] = (rendered as typeof current).containerDefinitions;
    expect(api?.image).toBe(newImage);
    expect(sidecar?.image).toBe('example/sidecar:1');
  });

  it('upserts SENTRY_RELEASE without duplicating it and keeps the other variables', () => {
    const [api] = (rendered as typeof current).containerDefinitions;
    expect(api?.environment).toEqual([
      { name: 'APP_ENV', value: 'staging' },
      { name: 'SENTRY_RELEASE', value: 'f00d' },
    ]);
  });

  it('adds a variable the container did not have', () => {
    const [, sidecar] = (
      renderTaskDefinition(current, {
        container: 'sidecar',
        image: 'example/sidecar:2',
        environment: { SENTRY_RELEASE: 'f00d' },
      }) as typeof current
    ).containerDefinitions;
    expect(sidecar?.environment).toEqual([{ name: 'SENTRY_RELEASE', value: 'f00d' }]);
  });

  it('does not change the input', () => {
    expect(current.containerDefinitions[0]?.image).toContain(':old');
    expect(current).toHaveProperty('revision', 7);
  });

  it('refuses a container the task definition does not have', () => {
    expect(() => renderTaskDefinition(current, { container: 'worker', image: newImage })).toThrow(
      /no container "worker"/,
    );
  });
});

const taskArn = 'arn:aws:ecs:ap-south-1:222222222222:task/quad-staging/abc';
const started = { tasks: [{ taskArn }], failures: [] };
const stopped = (container: Record<string, unknown>, task: Record<string, unknown> = {}) => ({
  tasks: [{ taskArn, ...task, containers: [{ name: 'migrate', ...container }] }],
  failures: [],
});

describe('taskOutcome (Review Focus #4)', () => {
  it('is ok when the container exits 0', () => {
    expect(taskOutcome(started, stopped({ exitCode: 0 }), 'migrate')).toEqual({
      ok: true,
      message: 'migrate exited with code 0.',
    });
  });

  it('is not ok when the container exits 1', () => {
    const outcome = taskOutcome(started, stopped({ exitCode: 1 }), 'migrate');
    expect(outcome.ok).toBe(false);
    expect(outcome.message).toContain('migrate exited with code 1');
  });

  it('is not ok, naming the reason, when the task never started', () => {
    const outcome = taskOutcome(
      started,
      stopped({ reason: 'pull access denied' }, { stoppedReason: 'CannotPullContainerError' }),
      'migrate',
    );
    expect(outcome.ok).toBe(false);
    expect(outcome.message).toContain('CannotPullContainerError');
    expect(outcome.message).toContain('migrate');
  });

  it('is not ok when run-task reports failures', () => {
    const outcome = taskOutcome(
      { tasks: [], failures: [{ arn: 'x', reason: 'RESOURCE:MEMORY' }] },
      { tasks: [], failures: [] },
      'migrate',
    );
    expect(outcome.ok).toBe(false);
    expect(outcome.message).toContain('RESOURCE:MEMORY');
  });

  it('is not ok when describe-tasks reports failures', () => {
    const outcome = taskOutcome(
      started,
      { tasks: [], failures: [{ arn: taskArn, reason: 'MISSING' }] },
      'migrate',
    );
    expect(outcome.ok).toBe(false);
    expect(outcome.message).toContain('MISSING');
  });

  it('is not ok when two tasks ran', () => {
    const two = {
      tasks: [
        { taskArn, containers: [{ name: 'migrate', exitCode: 0 }] },
        { taskArn: `${taskArn}2`, containers: [{ name: 'migrate', exitCode: 0 }] },
      ],
      failures: [],
    };
    const outcome = taskOutcome(started, two, 'migrate');
    expect(outcome.ok).toBe(false);
    expect(outcome.message).toContain('2 tasks');
  });

  it('is not ok when the container is missing from the task', () => {
    const outcome = taskOutcome(started, stopped({ exitCode: 0 }), 'seed');
    expect(outcome.ok).toBe(false);
    expect(outcome.message).toContain('seed');
  });

  it('is not ok when run-task returned nothing', () => {
    expect(taskOutcome(null, { tasks: [], failures: [] }, 'migrate').ok).toBe(false);
  });
});

describe('updateServiceArgs (ruling R-desired-count)', () => {
  const args = updateServiceArgs({
    cluster: 'quad-staging',
    service: 'api',
    taskDefinition: 'arn:td:8',
  });

  it('forces a new deployment of the given task definition', () => {
    expect(args).toEqual([
      'ecs',
      'update-service',
      '--cluster',
      'quad-staging',
      '--service',
      'api',
      '--task-definition',
      'arn:td:8',
      '--force-new-deployment',
      '--output',
      'json',
    ]);
  });

  it('never passes --desired-count: Terraform owns the count', () => {
    expect(args.join(' ')).not.toContain('desired-count');
  });
});

describe('runTaskArgs', () => {
  it('runs one Fargate task in the private subnets without a public IP', () => {
    const args = runTaskArgs({
      cluster: 'quad-staging',
      taskDefinition: 'arn:td:3',
      subnets: 'subnet-a,subnet-b',
      securityGroups: 'sg-1,sg-2',
    }).join(' ');
    expect(args).toContain('ecs run-task --cluster quad-staging --task-definition arn:td:3');
    expect(args).toContain('--launch-type FARGATE --count 1');
    expect(args).toContain(
      'awsvpcConfiguration={subnets=[subnet-a,subnet-b],securityGroups=[sg-1,sg-2],assignPublicIp=DISABLED}',
    );
    expect(args).toContain('--propagate-tags TASK_DEFINITION');
  });
});

describe('parseDeployArgs', () => {
  it('reads a subcommand, its options and repeated --env pairs', () => {
    expect(
      parseDeployArgs([
        'register',
        '--family',
        'quad-staging-api',
        '--container',
        'api',
        '--image',
        newImage,
        '--env',
        'SENTRY_RELEASE=f00d',
        '--env',
        'APP_ENV=staging',
      ]),
    ).toEqual({
      command: 'register',
      options: { family: 'quad-staging-api', container: 'api', image: newImage },
      env: { SENTRY_RELEASE: 'f00d', APP_ENV: 'staging' },
    });
  });

  it.each([
    [[], /Name a subcommand/],
    [['launch'], /Unknown subcommand "launch"/],
    [['register', '--family'], /--family needs a value/],
    [['register', '--env', 'NOPE'], /is not K=V/],
    [['register', '--colour', 'red'], /Unknown option "--colour"/],
    [['update-service', '--service', 'api'], /--task-definition is required/],
    [
      ['update-service', '--service', 'api', '--task-definition', 'x', '--desired-count', '2'],
      /Unknown option "--desired-count"/,
    ],
  ])('refuses %j', (argv, error) => {
    expect(() => parseDeployArgs(argv)).toThrow(error);
  });
});

type Call = string[];
/** A fake `aws` CLI: answers by subcommand, records every call. */
function fakeAws(answers: Record<string, unknown>, statuses: Record<string, number> = {}) {
  const calls: Call[] = [];
  const aws = (args: string[]) => {
    calls.push(args);
    const key = args.slice(0, 2).join(' ');
    if (key === 'ssm get-parameter') {
      const name = args[args.indexOf('--name') + 1] ?? '';
      const settings: Record<string, string> = {
        '/quad/staging/deploy/cluster': 'quad-staging',
        '/quad/staging/deploy/subnets': 'subnet-a,subnet-b',
        '/quad/staging/deploy/security_groups': 'sg-1',
        '/quad/staging/deploy/ecr_registry': '222222222222.dkr.ecr.ap-south-1.amazonaws.com',
      };
      return { status: 0, stdout: `${settings[name] ?? ''}\n` };
    }
    return { status: statuses[key] ?? 0, stdout: JSON.stringify(answers[key] ?? {}) };
  };
  return { aws, calls };
}

function capture() {
  const lines: string[] = [];
  return { lines, write: (line: string) => lines.push(line) };
}

describe('runDeploy', () => {
  it('run-task stops the deploy without waiting when run-task reports failures', () => {
    const { aws, calls } = fakeAws({
      'ecs run-task': { tasks: [], failures: [{ reason: 'RESOURCE:MEMORY' }] },
    });
    const out = capture();
    const err = capture();
    const code = runDeploy(
      parseDeployArgs(['run-task', '--family-arn', 'arn:td:3', '--container', 'migrate']),
      aws,
      out.write,
      err.write,
    );
    expect(code).toBe(1);
    expect(calls.some((call) => call.includes('wait'))).toBe(false);
    expect(err.lines.join('')).toContain('RESOURCE:MEMORY');
  });

  it('run-task waits for the task to stop and fails on a non-zero exit', () => {
    const { aws, calls } = fakeAws({
      'ecs run-task': started,
      'ecs describe-tasks': stopped({ exitCode: 1 }),
    });
    const err = capture();
    const code = runDeploy(
      parseDeployArgs(['run-task', '--family-arn', 'arn:td:3', '--container', 'migrate']),
      aws,
      capture().write,
      err.write,
    );
    expect(code).toBe(1);
    const waited = calls.find((call) => call.join(' ').startsWith('ecs wait tasks-stopped'));
    expect(waited).toContain(taskArn);
    expect(err.lines.join('')).toContain('migrate exited with code 1');
  });

  it('run-task succeeds when the container exits 0', () => {
    const { aws } = fakeAws({
      'ecs run-task': started,
      'ecs describe-tasks': stopped({ exitCode: 0 }),
    });
    const out = capture();
    const code = runDeploy(
      parseDeployArgs(['run-task', '--family-arn', 'arn:td:3', '--container', 'migrate']),
      aws,
      out.write,
      capture().write,
    );
    expect(code).toBe(0);
    expect(out.lines.join('')).toContain('migrate exited with code 0');
  });

  it('run-task still reads the stopped task when the waiter gives up', () => {
    const { aws } = fakeAws(
      {
        'ecs run-task': started,
        'ecs describe-tasks': {
          tasks: [{ taskArn, lastStatus: 'RUNNING', containers: [{ name: 'migrate' }] }],
          failures: [],
        },
      },
      { 'ecs wait': 255 },
    );
    const err = capture();
    expect(
      runDeploy(
        parseDeployArgs(['run-task', '--family-arn', 'arn:td:3', '--container', 'migrate']),
        aws,
        capture().write,
        err.write,
      ),
    ).toBe(1);
    expect(err.lines.join('')).toContain('did not stop');
  });

  it('register renders the latest revision, tags it and prints the new ARN', () => {
    const { aws, calls } = fakeAws({
      'ecs describe-task-definition': { taskDefinition: current },
      'ecs register-task-definition': {
        taskDefinition: {
          taskDefinitionArn: 'arn:aws:ecs:ap-south-1:2:task-definition/quad-staging-api:8',
        },
      },
    });
    const out = capture();
    const code = runDeploy(
      parseDeployArgs([
        'register',
        '--family',
        'quad-staging-api',
        '--container',
        'api',
        '--image',
        newImage,
        '--env',
        'SENTRY_RELEASE=f00d',
      ]),
      aws,
      out.write,
      capture().write,
    );
    expect(code).toBe(0);
    expect(out.lines.join('')).toBe(
      'arn:aws:ecs:ap-south-1:2:task-definition/quad-staging-api:8\n',
    );
    const register = calls.find((call) => call[1] === 'register-task-definition') ?? [];
    const input = JSON.parse(register[register.indexOf('--cli-input-json') + 1] ?? '{}') as {
      containerDefinitions: { image: string }[];
      tags: { key: string; value: string }[];
      revision?: number;
    };
    expect(input.containerDefinitions[0]?.image).toBe(newImage);
    expect(input.revision).toBeUndefined();
    expect(input.tags).toEqual([...DEPLOY_TAGS, { key: 'service', value: 'api' }]);
  });

  it('image-ref resolves a tag to the immutable digest', () => {
    const { aws, calls } = fakeAws({
      'ecr describe-images': { imageDetails: [{ imageDigest: 'sha256:abc' }] },
    });
    const out = capture();
    const repo = '222222222222.dkr.ecr.ap-south-1.amazonaws.com/quad/api';
    const code = runDeploy(
      parseDeployArgs(['image-ref', '--repo', repo, '--tag', 'f00d']),
      aws,
      out.write,
      capture().write,
    );
    expect(code).toBe(0);
    expect(out.lines.join('')).toBe(`${repo}@sha256:abc\n`);
    expect(calls[0]?.join(' ')).toContain(
      'ecr describe-images --repository-name quad/api --image-ids imageTag=f00d',
    );
  });

  it('update-service updates the service in the deploy cluster without a count', () => {
    const { aws, calls } = fakeAws({ 'ecs update-service': { service: { serviceName: 'api' } } });
    const code = runDeploy(
      parseDeployArgs(['update-service', '--service', 'api', '--task-definition', 'arn:td:8']),
      aws,
      capture().write,
      capture().write,
    );
    expect(code).toBe(0);
    const update = calls.find((call) => call[1] === 'update-service');
    expect(update).toEqual(
      updateServiceArgs({ cluster: 'quad-staging', service: 'api', taskDefinition: 'arn:td:8' }),
    );
  });

  it('wait-stable waits for every named service and fails when the waiter does', () => {
    const { aws, calls } = fakeAws({}, { 'ecs wait': 255 });
    const err = capture();
    const code = runDeploy(
      parseDeployArgs(['wait-stable', '--services', 'api,worker,staff']),
      aws,
      capture().write,
      err.write,
    );
    expect(code).toBe(1);
    expect(calls.at(-1)).toEqual([
      'ecs',
      'wait',
      'services-stable',
      '--cluster',
      'quad-staging',
      '--services',
      'api',
      'worker',
      'staff',
    ]);
    expect(err.lines.join('')).toContain('api, worker, staff');
  });

  it('setting prints one deploy setting', () => {
    const { aws } = fakeAws({});
    const out = capture();
    expect(
      runDeploy(
        parseDeployArgs(['setting', '--name', 'ecr_registry']),
        aws,
        out.write,
        capture().write,
      ),
    ).toBe(0);
    expect(out.lines.join('')).toBe('222222222222.dkr.ecr.ap-south-1.amazonaws.com\n');
  });

  it('fails with the aws error when a call fails', () => {
    const aws = () => ({ status: 254, stdout: '', stderr: 'AccessDenied' });
    const err = capture();
    expect(
      runDeploy(parseDeployArgs(['setting', '--name', 'cluster']), aws, capture().write, err.write),
    ).toBe(1);
    expect(err.lines.join('')).toContain('AccessDenied');
  });
});
