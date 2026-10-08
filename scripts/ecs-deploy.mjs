#!/usr/bin/env node
// The staging deploy's ECS steps (deploy-staging.yml, D28). Each subcommand shells out to the aws
// CLI with the deploy role's credentials and reads the cluster, subnets and security groups from
// the SSM parameters under /quad/staging/deploy (infra/modules/app/ssm.tf):
//   node scripts/ecs-deploy.mjs setting --name <cluster|subnets|security_groups|ecr_registry|…>
//   node scripts/ecs-deploy.mjs image-ref --repo <repository url> --tag <git sha>
//   node scripts/ecs-deploy.mjs register --family <f> --container <c> --image <ref> [--env K=V]...
//   node scripts/ecs-deploy.mjs run-task --family-arn <arn> --container <c>
//   node scripts/ecs-deploy.mjs update-service --service <s> --task-definition <arn>
//   node scripts/ecs-deploy.mjs wait-stable --expect <service>=<task definition arn>,…
// run-task exits 1 unless the one-off task's container exited 0, so a failed migration stops the
// workflow before any service is updated (Review Focus #4); a task still running when the waiter
// gives up is stopped. wait-stable exits 1 unless each service's PRIMARY deployment runs the
// expected revision and completed, so a circuit-breaker rollback fails the deploy. update-service
// never passes --desired-count: Terraform owns the count (ruling R-desired-count).
import { spawnSync } from 'node:child_process';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

/** @typedef {{ status: number | null, stdout: string, stderr?: string }} AwsResult */
/** @typedef {(args: string[]) => AwsResult} Aws */
/** @typedef {{ command: Command, options: Record<string, string>, env: Record<string, string> }} DeployArgs */
/** @typedef {'setting' | 'image-ref' | 'register' | 'run-task' | 'update-service' | 'wait-stable'} Command */

const SETTINGS_PREFIX = '/quad/staging/deploy';

/**
 * The tags every task definition the workflow registers carries, as Terraform's provider
 * default_tags do for the ones it creates (Global Constraints); `service` is added per container.
 */
export const DEPLOY_TAGS = [
  { key: 'env', value: 'staging' },
  { key: 'owner', value: 'platform' },
  { key: 'cost-centre', value: 'quad-staging' },
];

/** Fields describe-task-definition returns that register-task-definition does not accept. */
const READ_ONLY_FIELDS = [
  'taskDefinitionArn',
  'revision',
  'status',
  'requiresAttributes',
  'compatibilities',
  'registeredAt',
  'registeredBy',
  'deregisteredAt',
];

/** @type {Record<Command, { required: string[], optional?: string[], env?: boolean }>} */
const COMMANDS = {
  setting: { required: ['name'] },
  'image-ref': { required: ['repo', 'tag'] },
  register: { required: ['family', 'container', 'image'], env: true },
  'run-task': { required: ['family-arn', 'container'] },
  'update-service': { required: ['service', 'task-definition'] },
  'wait-stable': { required: ['expect'] },
};

/**
 * @param {unknown} value
 * @returns {value is Record<string, unknown>}
 */
const isRecord = (value) => typeof value === 'object' && value !== null && !Array.isArray(value);

/**
 * @param {unknown} value
 * @returns {Record<string, unknown>[]}
 */
const records = (value) => (Array.isArray(value) ? value.filter(isRecord) : []);

/**
 * The input for register-task-definition: `current` (describe-task-definition's `taskDefinition`)
 * without its read-only fields, with `change.image` on the named container and `change.environment`
 * upserted into that container's environment. `current` is not changed.
 * @param {Record<string, unknown>} current
 * @param {{ container: string, image: string, environment?: Record<string, string> }} change
 * @returns {Record<string, unknown>}
 */
export function renderTaskDefinition(current, change) {
  const containers = records(current.containerDefinitions);
  if (!containers.some((container) => container.name === change.container)) {
    throw new Error(`The task definition has no container ${JSON.stringify(change.container)}.`);
  }
  const updates = Object.entries(change.environment ?? {});
  const containerDefinitions = containers.map((container) => {
    if (container.name !== change.container) return container;
    const environment = records(container.environment).filter(
      (variable) => !updates.some(([name]) => variable.name === name),
    );
    for (const [name, value] of updates) environment.push({ name, value });
    return {
      ...container,
      image: change.image,
      ...(environment.length > 0 ? { environment } : {}),
    };
  });
  return {
    ...Object.fromEntries(
      Object.entries(current).filter(([field]) => !READ_ONLY_FIELDS.includes(field)),
    ),
    containerDefinitions,
  };
}

/**
 * The reasons in an ECS `failures` list, or an empty string.
 * @param {unknown} output
 * @returns {string}
 */
function failureReasons(output) {
  if (!isRecord(output)) return '';
  return records(output.failures)
    .map((failure) => [failure.reason, failure.detail].filter(Boolean).join(': '))
    .join('; ');
}

/**
 * Whether a one-off task succeeded: no `failures` from run-task or describe-tasks, exactly one
 * task, and `container` exited 0. Otherwise the message names the container and the exit code,
 * the task's stoppedReason, or the failure reason.
 * @param {Record<string, unknown> | null} runTaskOutput
 * @param {Record<string, unknown>} describeTasksOutput
 * @param {string} container
 * @returns {{ ok: boolean, message: string }}
 */
export function taskOutcome(runTaskOutput, describeTasksOutput, container) {
  if (runTaskOutput === null) {
    return { ok: false, message: `run-task returned nothing, so ${container} did not run.` };
  }
  const runFailures = failureReasons(runTaskOutput);
  if (runFailures !== '') {
    return { ok: false, message: `run-task could not start ${container}: ${runFailures}.` };
  }
  const describeFailures = failureReasons(describeTasksOutput);
  if (describeFailures !== '') {
    return { ok: false, message: `describe-tasks failed for ${container}: ${describeFailures}.` };
  }
  const tasks = records(describeTasksOutput.tasks);
  if (tasks.length !== 1) {
    return {
      ok: false,
      message: `Expected one ${container} task, found ${String(tasks.length)} tasks.`,
    };
  }
  const [task = {}] = tasks;
  const entry = records(task.containers).find((candidate) => candidate.name === container);
  if (entry === undefined) {
    return { ok: false, message: `The task has no container ${JSON.stringify(container)}.` };
  }
  if (typeof entry.exitCode === 'number') {
    const message = `${container} exited with code ${String(entry.exitCode)}.`;
    return entry.exitCode === 0
      ? { ok: true, message }
      : {
          ok: false,
          message: entry.reason === undefined ? message : `${message} ${String(entry.reason)}`,
        };
  }
  const why = [task.stoppedReason, entry.reason].filter(Boolean).map(String).join(': ');
  const status = typeof task.lastStatus === 'string' ? task.lastStatus : 'unknown';
  return {
    ok: false,
    message:
      why === ''
        ? `${container} did not stop with an exit code (status ${status}).`
        : `${container} did not run to completion: ${why}.`,
  };
}

/**
 * Parses `--expect api=<arn>,worker=<arn>`: the task definition each service must end up running.
 * @param {string} value
 * @returns {Record<string, string>}
 */
export function parseExpectations(value) {
  /** @type {Record<string, string>} */
  const expected = {};
  for (const pair of value.split(',')) {
    const eq = pair.indexOf('=');
    const service = pair.slice(0, eq);
    const arn = pair.slice(eq + 1);
    if (eq <= 0 || arn === '') {
      throw new Error(`--expect ${JSON.stringify(pair)} is not <service>=<task definition arn>.`);
    }
    if (Object.hasOwn(expected, service)) {
      throw new Error(`--expect names ${service} twice.`);
    }
    expected[service] = arn;
  }
  return expected;
}

/**
 * Whether every service finished deploying what was registered for it: its PRIMARY deployment
 * runs the expected task definition and its rolloutState is COMPLETED. A deployment circuit
 * breaker that rolled back leaves the previous revision as PRIMARY, so it is reported as a failure.
 * @param {Record<string, unknown>} describeServicesOutput
 * @param {Record<string, string>} expected service name → task definition ARN
 * @returns {{ ok: boolean, message: string }}
 */
export function serviceOutcome(describeServicesOutput, expected) {
  const failures = failureReasons(describeServicesOutput);
  if (failures !== '') return { ok: false, message: `describe-services failed: ${failures}.` };
  const services = records(describeServicesOutput.services);
  const problems = Object.entries(expected).flatMap(([name, arn]) => {
    const service = services.find((candidate) => candidate.serviceName === name);
    if (service === undefined) return [`${name} was not found`];
    const primary = records(service.deployments).find(
      (deployment) => deployment.status === 'PRIMARY',
    );
    if (primary === undefined) return [`${name} has no PRIMARY deployment`];
    if (primary.taskDefinition !== arn) {
      return [`${name} runs ${String(primary.taskDefinition)}, not ${arn} (rolled back?)`];
    }
    if (primary.rolloutState !== 'COMPLETED') {
      return [`${name}'s rollout is ${String(primary.rolloutState)}, not COMPLETED`];
    }
    return [];
  });
  return problems.length === 0
    ? { ok: true, message: `Deployed and stable: ${Object.keys(expected).join(', ')}.` }
    : { ok: false, message: `${problems.join('; ')}.` };
}

/**
 * aws ecs update-service: a forced deployment of `taskDefinition`. Never --desired-count
 * (ruling R-desired-count: Terraform owns the count).
 * @param {{ cluster: string, service: string, taskDefinition: string }} target
 * @returns {string[]}
 */
export function updateServiceArgs({ cluster, service, taskDefinition }) {
  return [
    'ecs',
    'update-service',
    '--cluster',
    cluster,
    '--service',
    service,
    '--task-definition',
    taskDefinition,
    '--force-new-deployment',
    '--output',
    'json',
  ];
}

/**
 * aws ecs run-task: one Fargate task in the private subnets, without a public IP, tagged like its
 * task definition.
 * @param {{ cluster: string, taskDefinition: string, subnets: string, securityGroups: string }} target
 * @returns {string[]}
 */
export function runTaskArgs({ cluster, taskDefinition, subnets, securityGroups }) {
  return [
    'ecs',
    'run-task',
    '--cluster',
    cluster,
    '--task-definition',
    taskDefinition,
    '--launch-type',
    'FARGATE',
    '--count',
    '1',
    '--started-by',
    'deploy-staging',
    '--propagate-tags',
    'TASK_DEFINITION',
    '--network-configuration',
    `awsvpcConfiguration={subnets=[${subnets}],securityGroups=[${securityGroups}],assignPublicIp=DISABLED}`,
    '--output',
    'json',
  ];
}

/**
 * Parses the CLI arguments: a subcommand, its `--name value` options and repeated `--env K=V`.
 * @param {string[]} argv
 * @returns {DeployArgs}
 */
export function parseDeployArgs(argv) {
  const [name, ...rest] = argv;
  if (name === undefined) {
    throw new Error(`Name a subcommand: ${Object.keys(COMMANDS).join(', ')}.`);
  }
  const command = /** @type {Command | undefined} */ (
    Object.keys(COMMANDS).find((candidate) => candidate === name)
  );
  if (command === undefined) throw new Error(`Unknown subcommand ${JSON.stringify(name)}.`);
  const spec = COMMANDS[command];
  /** @type {Record<string, string>} */
  const options = {};
  /** @type {Record<string, string>} */
  const env = {};
  for (let i = 0; i < rest.length; i += 2) {
    const flag = rest[i] ?? '';
    const option = flag.replace(/^--/, '');
    const known =
      flag.startsWith('--') &&
      (spec.required.includes(option) || (spec.env === true && option === 'env'));
    if (!known) throw new Error(`Unknown option ${JSON.stringify(flag)} for ${command}.`);
    const value = rest[i + 1];
    if (value === undefined || value === '' || value.startsWith('--')) {
      throw new Error(`${flag} needs a value.`);
    }
    if (option === 'env') {
      const eq = value.indexOf('=');
      if (eq <= 0) throw new Error(`--env ${JSON.stringify(value)} is not K=V.`);
      env[value.slice(0, eq)] = value.slice(eq + 1);
    } else options[option] = value;
  }
  for (const option of spec.required) {
    if (options[option] === undefined) throw new Error(`--${option} is required for ${command}.`);
  }
  return { command, options, env };
}

/**
 * Runs `aws`, returning its stdout, or throws with its stderr when it fails.
 * @param {Aws} aws
 * @param {string[]} args
 * @returns {string}
 */
function call(aws, args) {
  const result = aws(args);
  if (result.status !== 0) {
    const detail = (result.stderr ?? '').trim();
    throw new Error(
      `aws ${args.slice(0, 2).join(' ')} failed (${String(result.status)})${detail === '' ? '.' : `: ${detail}`}`,
    );
  }
  return result.stdout;
}

/**
 * @param {Aws} aws
 * @param {string[]} args
 * @returns {Record<string, unknown>}
 */
function callJson(aws, args) {
  const parsed = /** @type {unknown} */ (JSON.parse(call(aws, args)));
  return isRecord(parsed) ? parsed : {};
}

/**
 * One deploy setting from SSM.
 * @param {Aws} aws
 * @param {string} name
 * @returns {string}
 */
function setting(aws, name) {
  const value = call(aws, [
    'ssm',
    'get-parameter',
    '--name',
    `${SETTINGS_PREFIX}/${name}`,
    '--query',
    'Parameter.Value',
    '--output',
    'text',
  ]).trim();
  if (value === '') throw new Error(`The deploy setting ${name} is empty.`);
  return value;
}

/**
 * Runs one subcommand and returns the exit code. `write` gets the result (an ARN, an image
 * reference, a setting); `writeError` gets what went wrong.
 * @param {DeployArgs} parsed
 * @param {Aws} aws
 * @param {(line: string) => void} write
 * @param {(line: string) => void} writeError
 * @returns {number}
 */
export function runDeploy(parsed, aws, write, writeError) {
  const { command, options, env } = parsed;
  const option = (/** @type {string} */ name) => options[name] ?? '';
  try {
    switch (command) {
      case 'setting':
        write(`${setting(aws, option('name'))}\n`);
        return 0;
      case 'image-ref': {
        const repo = option('repo');
        const repositoryName = repo.slice(repo.indexOf('/') + 1);
        const described = callJson(aws, [
          'ecr',
          'describe-images',
          '--repository-name',
          repositoryName,
          '--image-ids',
          `imageTag=${option('tag')}`,
          '--output',
          'json',
        ]);
        const [image] = records(described.imageDetails);
        const digest = typeof image?.imageDigest === 'string' ? image.imageDigest : '';
        if (!digest.startsWith('sha256:')) {
          throw new Error(`${repositoryName}:${option('tag')} has no image digest.`);
        }
        write(`${repo}@${digest}\n`);
        return 0;
      }
      case 'register': {
        const described = callJson(aws, [
          'ecs',
          'describe-task-definition',
          '--task-definition',
          option('family'),
          '--output',
          'json',
        ]);
        const current = isRecord(described.taskDefinition) ? described.taskDefinition : {};
        const input = {
          ...renderTaskDefinition(current, {
            container: option('container'),
            image: option('image'),
            environment: env,
          }),
          tags: [...DEPLOY_TAGS, { key: 'service', value: option('container') }],
        };
        const registered = callJson(aws, [
          'ecs',
          'register-task-definition',
          '--cli-input-json',
          JSON.stringify(input),
          '--output',
          'json',
        ]);
        const arn = isRecord(registered.taskDefinition)
          ? registered.taskDefinition.taskDefinitionArn
          : undefined;
        if (typeof arn !== 'string') throw new Error('register-task-definition returned no ARN.');
        write(`${arn}\n`);
        return 0;
      }
      case 'run-task':
        return runOneOff(aws, option('family-arn'), option('container'), write, writeError);
      case 'update-service': {
        call(
          aws,
          updateServiceArgs({
            cluster: setting(aws, 'cluster'),
            service: option('service'),
            taskDefinition: option('task-definition'),
          }),
        );
        write(`${option('service')} is deploying ${option('task-definition')}.\n`);
        return 0;
      }
      case 'wait-stable':
        return waitStable(aws, parseExpectations(option('expect')), write, writeError);
      default: {
        /** @type {never} */
        const unknown = command;
        throw new Error(`Unknown subcommand ${String(unknown)}.`);
      }
    }
  } catch (error) {
    writeError(
      `ecs-deploy ${command}: ${error instanceof Error ? error.message : String(error)}\n`,
    );
    return 1;
  }
}

/**
 * The waiter's own message (its stderr), on a line of its own, or nothing.
 * @param {AwsResult} result
 * @returns {string}
 */
const waiterError = (result) => {
  const detail = (result.stderr ?? '').trim();
  return detail === '' ? '' : `${detail}\n`;
};

/**
 * Waits for the services to be stable, then checks that each one runs its expected revision.
 * describe-services runs even when the waiter gives up, so the message says what went wrong.
 * @param {Aws} aws
 * @param {Record<string, string>} expected
 * @param {(line: string) => void} write
 * @param {(line: string) => void} writeError
 * @returns {number}
 */
function waitStable(aws, expected, write, writeError) {
  const services = Object.keys(expected);
  const cluster = setting(aws, 'cluster');
  const waited = aws([
    'ecs',
    'wait',
    'services-stable',
    '--cluster',
    cluster,
    '--services',
    ...services,
  ]);
  if (waited.status !== 0) writeError(waiterError(waited));
  const described = callJson(aws, [
    'ecs',
    'describe-services',
    '--cluster',
    cluster,
    '--services',
    ...services,
    '--output',
    'json',
  ]);
  const outcome = serviceOutcome(described, expected);
  if (waited.status !== 0 || !outcome.ok) {
    const prefix =
      waited.status === 0 ? '' : 'The services did not become stable before the waiter gave up. ';
    writeError(`${prefix}${outcome.message}\n`);
    return 1;
  }
  write(`${outcome.message}\n`);
  return 0;
}

/**
 * Runs a one-off task, waits for it to stop and checks its outcome.
 * @param {Aws} aws
 * @param {string} taskDefinition
 * @param {string} container
 * @param {(line: string) => void} write
 * @param {(line: string) => void} writeError
 * @returns {number}
 */
function runOneOff(aws, taskDefinition, container, write, writeError) {
  const cluster = setting(aws, 'cluster');
  const started = callJson(
    aws,
    runTaskArgs({
      cluster,
      taskDefinition,
      subnets: setting(aws, 'subnets'),
      securityGroups: setting(aws, 'security_groups'),
    }),
  );
  const taskArns = records(started.tasks)
    .map((task) => task.taskArn)
    .filter((arn) => typeof arn === 'string');
  if (failureReasons(started) !== '' || taskArns.length === 0) {
    writeError(`${taskOutcome(started, { tasks: [], failures: [] }, container).message}\n`);
    return 1;
  }
  write(`Started ${container}: ${taskArns.join(', ')}. Waiting for it to stop.\n`);
  // The waiter gives up after 10 minutes; describe-tasks still says whether the task stopped.
  const waited = aws([
    'ecs',
    'wait',
    'tasks-stopped',
    '--cluster',
    cluster,
    '--tasks',
    ...taskArns,
  ]);
  const described = callJson(aws, [
    'ecs',
    'describe-tasks',
    '--cluster',
    cluster,
    '--tasks',
    ...taskArns,
    '--output',
    'json',
  ]);
  const outcome = taskOutcome(started, described, container);
  if (waited.status !== 0) writeError(waiterError(waited));
  if (!outcome.ok) {
    // The outcome comes first, so a failing stop-task below can never hide why the deploy failed.
    writeError(`${outcome.message}\n`);
    const running = records(described.tasks).filter((task) => task.lastStatus !== 'STOPPED');
    // A task the waiter gave up on would otherwise keep running (and, for migrate, keep holding
    // its lock) after the deploy failed.
    for (const task of running) {
      const arn = String(task.taskArn);
      try {
        call(aws, [
          'ecs',
          'stop-task',
          '--cluster',
          cluster,
          '--task',
          arn,
          '--reason',
          'deploy-staging: the waiter gave up',
          '--output',
          'json',
        ]);
        writeError(`The deploy stopped it (${arn}).\n`);
      } catch (error) {
        const detail = error instanceof Error ? error.message : String(error);
        writeError(`Note: Could not stop ${arn}; stop it by hand. ${detail}\n`);
      }
    }
    return 1;
  }
  write(`${outcome.message}\n`);
  return 0;
}

const isMain = process.argv[1] === fileURLToPath(import.meta.url);
if (isMain) {
  /** @type {DeployArgs} */
  let parsed;
  try {
    parsed = parseDeployArgs(process.argv.slice(2));
  } catch (error) {
    process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
    process.stderr.write(
      'Usage: node scripts/ecs-deploy.mjs <setting|image-ref|register|run-task|update-service|wait-stable> [options]\n',
    );
    process.exit(2);
  }
  process.exit(
    runDeploy(
      parsed,
      (args) => {
        // stdout and stderr are captured: runDeploy parses stdout and passes a failed call's
        // stderr (a waiter's message included) to writeError.
        const result = spawnSync('aws', args, {
          encoding: 'utf8',
          stdio: ['ignore', 'pipe', 'pipe'],
          maxBuffer: 16 * 1024 * 1024,
        });
        if (result.error !== undefined) {
          return { status: 1, stdout: '', stderr: `could not run aws: ${result.error.message}` };
        }
        return { status: result.status, stdout: result.stdout, stderr: result.stderr };
      },
      (line) => {
        process.stdout.write(line);
      },
      (line) => {
        process.stderr.write(line);
      },
    ),
  );
}
