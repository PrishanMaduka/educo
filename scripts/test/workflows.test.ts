// The GitHub Actions workflows (D28): the named required checks, and every AWS job skipped, not
// failed, until its role variable exists (Review Focus #5).
import { readdirSync, readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';
import { parse } from 'yaml';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const workflowDir = join(root, '.github/workflows');

type Step = {
  name?: string;
  uses?: string;
  run?: string;
  if?: string;
  with?: Record<string, unknown>;
  env?: Record<string, string>;
};
type Job = {
  name?: string;
  if?: string;
  needs?: string | string[];
  environment?: string | { name: string };
  permissions?: Record<string, string> | string;
  strategy?: { matrix?: Record<string, unknown> };
  env?: Record<string, string>;
  steps?: Step[];
  uses?: string;
};
type Workflow = {
  name: string;
  on: Record<string, unknown>;
  permissions?: Record<string, string> | string;
  concurrency?: unknown;
  env?: Record<string, string>;
  jobs: Record<string, Job>;
};

const text = (file: string) => readFileSync(join(workflowDir, file), 'utf8');
/** The file without its comment lines, which may name what the workflow must never do. */
const code = (file: string) => text(file).replace(/^\s*#.*$/gm, '');
const load = (file: string) => parse(text(file)) as Workflow;
const files = readdirSync(workflowDir).filter((file) => /\.ya?ml$/.test(file));
const ci = load('ci.yml');
const deploy = load('deploy-staging.yml');
const infra = load('infra.yml');
const setupAction = readFileSync(join(root, '.github/actions/setup/action.yml'), 'utf8');

const needsOf = (job: Job | undefined) =>
  job?.needs === undefined ? [] : Array.isArray(job.needs) ? job.needs : [job.needs];
const runs = (job: Job | undefined) => (job?.steps ?? []).map((step) => step.run ?? '').join('\n');
const usesAws = (job: Job) =>
  (job.steps ?? []).some((step) => step.uses?.startsWith('aws-actions/') === true);
const environmentOf = (job: Job | undefined) =>
  typeof job?.environment === 'object' ? job.environment.name : job?.environment;
/** Every `uses:` in a workflow or action file, workflows' job-level ones included. */
const usesIn = (source: string) =>
  [...source.matchAll(/^\s*(?:-\s+)?uses:\s*(\S+)/gm)].map((m) => m[1] ?? '');

describe('every workflow', () => {
  it.each(files)('%s defaults to read-only contents and never uses pull_request_target', (file) => {
    const workflow = load(file);
    expect(workflow.permissions).toEqual({ contents: 'read' });
    expect(Object.keys(workflow.on)).not.toContain('pull_request_target');
    expect(code(file)).not.toContain('pull_request_target');
  });

  it.each(files)('%s grants write permissions only where a job needs them', (file) => {
    for (const [id, job] of Object.entries(load(file).jobs)) {
      if (job.permissions === undefined) continue;
      expect(typeof job.permissions, `${file} ${id}`).toBe('object');
      for (const [scope, level] of Object.entries(job.permissions as Record<string, string>)) {
        if (level !== 'write') continue;
        if (scope === 'id-token') {
          // OIDC only for a job that assumes an AWS role.
          expect(usesAws(job), `${file} ${id} id-token without AWS`).toBe(true);
        } else {
          // The PR plan comment is the only other write.
          expect([file, id, scope], `${file} ${id} ${scope}: write`).toEqual([
            'infra.yml',
            'plan',
            'pull-requests',
          ]);
        }
      }
    }
  });

  it.each([...files, '../actions/setup/action.yml'])(
    '%s pins every action to a major version or a commit',
    (file) => {
      const source = file.startsWith('../') ? setupAction : text(file);
      for (const ref of usesIn(source)) {
        if (ref.startsWith('./')) continue;
        expect(ref, `${file}: ${ref}`).toMatch(/@(v\d+|[0-9a-f]{40})$/);
      }
    },
  );

  it.each(files)('%s names AWS roles only through variables, never secrets', (file) => {
    const source = text(file);
    expect(source).not.toMatch(/secrets\.AWS/);
    const roles = [...source.matchAll(/role-to-assume:\s*(.+)$/gm)].map((m) => m[1] ?? '');
    for (const role of roles) expect(role.trim()).toMatch(/^\$\{\{ vars\./);
  });

  it.each(files)('%s never puts a secret into a shell command line', (file) => {
    for (const [id, job] of Object.entries(load(file).jobs)) {
      for (const step of job.steps ?? []) {
        expect(step.run ?? '', `${file} ${id} ${step.name ?? ''}`).not.toContain('secrets.');
      }
    }
  });

  it.each(files)('%s never passes --desired-count (ruling R-desired-count)', (file) => {
    expect(code(file)).not.toContain('desired-count');
  });

  it('every job that assumes an AWS role is gated on a role variable at job level', () => {
    for (const file of files) {
      for (const [id, job] of Object.entries(load(file).jobs)) {
        if (!usesAws(job)) continue;
        expect(job.if ?? '', `${file} ${id}`).toMatch(/vars\.AWS_[A-Z_]+_ROLE_ARN != ''/);
      }
    }
  });
});

describe('ci.yml', () => {
  it('keeps the triggers: pull requests, pushes to main, develop and claude/**, and by hand', () => {
    expect(ci.name).toBe('CI');
    expect(ci.on).toEqual({
      pull_request: null,
      push: { branches: ['main', 'develop', 'claude/**'] },
      workflow_dispatch: null,
    });
    expect(ci.concurrency).toMatchObject({ group: '${{ github.workflow }}-${{ github.ref }}' });
  });

  it('has the required checks from spec 17/20 plus the image and Android builds', () => {
    expect(Object.keys(ci.jobs).sort()).toEqual(
      [
        'typecheck',
        'lint',
        'unit',
        'codegen',
        'api-integration',
        'e2e-smoke',
        'build',
        'images',
        'parent-build',
      ].sort(),
    );
  });

  it('runs every step of pnpm verify, the audit and the build somewhere', () => {
    const all = Object.values(ci.jobs).map(runs).join('\n');
    expect(runs(ci.jobs.typecheck)).toContain('turbo run typecheck');
    expect(runs(ci.jobs.lint)).toContain('turbo run lint');
    expect(runs(ci.jobs.lint)).toContain('pnpm format:check');
    expect(runs(ci.jobs.unit)).toContain('turbo run test');
    expect(runs(ci.jobs.unit)).toContain('pnpm audit --prod --audit-level high');
    expect(runs(ci.jobs.codegen)).toContain('pnpm codegen:check');
    expect(runs(ci.jobs['api-integration'])).toContain('node scripts/check-services.mjs');
    expect(runs(ci.jobs['api-integration'])).toContain('pnpm test:api');
    expect(runs(ci.jobs['api-integration'])).toContain('docker/postgres/init/01-roles.sql');
    expect(runs(ci.jobs['e2e-smoke'])).toContain('pnpm e2e');
    expect(runs(ci.jobs.build)).toContain('pnpm build');
    expect(all).not.toContain('pnpm verify');
  });

  it('gives api-integration Postgres and Redis service containers', () => {
    const job = ci.jobs['api-integration'] as Job & { services?: Record<string, unknown> };
    expect(Object.keys(job.services ?? {}).sort()).toEqual(['postgres', 'redis']);
  });

  it('fails Flutter checks instead of skipping them wherever Flutter runs', () => {
    for (const id of ['typecheck', 'lint', 'unit', 'codegen', 'parent-build']) {
      expect(ci.jobs[id]?.env?.QUAD_REQUIRE_FLUTTER, id).toBe('1');
    }
  });

  it('builds every image without pushing and lints the Dockerfiles with hadolint v2.14.0', () => {
    const script = runs(ci.jobs.images);
    expect(script).toContain(
      'node scripts/docker-build.mjs all --build-arg NEXT_PUBLIC_APP_ENV=local',
    );
    expect(script).not.toContain('--push');
    expect(script).toContain('hadolint/hadolint:v2.14.0');
    expect(ci.jobs.images?.env?.QUAD_IMAGE_REGISTRY).toBe('mirror.gcr.io/');
    for (const file of [
      'docker/api.Dockerfile',
      'docker/web.Dockerfile',
      'docker/clamav/Dockerfile',
    ]) {
      expect(script).toContain(file);
    }
  });

  it('builds the staging Android app on Ubuntu with Java 17 and the debug-key fallback', () => {
    const job = ci.jobs['parent-build'];
    const script = runs(job);
    expect(script).toContain(
      'flutter build apk --flavor staging --release --dart-define-from-file=env/staging.json',
    );
    expect(script).toContain('flutter build appbundle --flavor staging --release');
    const setup = (job?.steps ?? []).find((step) => step.uses === './.github/actions/setup');
    expect(setup?.with).toMatchObject({ java: true, flutter: true });
    expect(JSON.stringify(job)).not.toContain('secrets.');
  });

  it('reads the Flutter and Node versions from the pinned files in the setup action', () => {
    expect(setupAction).toContain('flutter-version-file: .fvmrc');
    expect(setupAction).toContain('node-version-file: .nvmrc');
    expect(setupAction).toContain('pnpm install --frozen-lockfile');
    expect(readFileSync(join(root, '.fvmrc'), 'utf8')).toContain('3.47.6');
  });
});

const DEPLOY_GATE = "vars.AWS_STAGING_DEPLOY_ROLE_ARN != ''";
const GATE_OPEN = "needs.gate.outputs.deploy == 'true'";
const AWS_DEPLOY_JOBS = ['build-push', 'migrate', 'deploy', 'seed', 'smoke'];

describe('deploy-staging.yml', () => {
  it('runs after CI succeeds on a push to main, or by hand', () => {
    expect(deploy.on).toEqual({
      workflow_run: { workflows: ['CI'], types: ['completed'], branches: ['main'] },
      workflow_dispatch: null,
    });
    expect(deploy.concurrency).toEqual({ group: 'deploy-staging', 'cancel-in-progress': false });
  });

  it('has the gate, the deploy jobs and the two store lanes', () => {
    expect(Object.keys(deploy.jobs).sort()).toEqual(
      ['gate', ...AWS_DEPLOY_JOBS, 'parent-ios', 'parent-android'].sort(),
    );
  });

  it('starts with a gate that decides without AWS and without failing (I3, M1, M2)', () => {
    const gate = deploy.jobs.gate as Job & { outputs?: Record<string, string> };
    expect(Object.keys(deploy.jobs)[0]).toBe('gate');
    // It needs nothing from AWS, only something to deploy to.
    expect(gate.if).toBe(
      "${{ vars.AWS_STAGING_DEPLOY_ROLE_ARN != '' || vars.IOS_UPLOAD_ENABLED == 'true' || vars.PLAY_UPLOAD_ENABLED == 'true' }}",
    );
    expect(needsOf(gate)).toEqual([]);
    expect(usesAws(gate)).toBe(false);
    expect(gate.permissions).toEqual({ contents: 'read', actions: 'read' });
    expect(gate.outputs?.deploy).toBe('${{ steps.decide.outputs.deploy }}');
    const decide = (gate.steps ?? []).find((step) => step.run?.includes('scripts/deploy-gate.mjs'));
    expect(decide?.env).toMatchObject({
      GH_TOKEN: '${{ github.token }}',
      EVENT_NAME: '${{ github.event_name }}',
      REF: '${{ github.ref }}',
      REPOSITORY: '${{ github.repository }}',
      RUN_CONCLUSION: '${{ github.event.workflow_run.conclusion }}',
      RUN_EVENT: '${{ github.event.workflow_run.event }}',
      RUN_HEAD_REPOSITORY: '${{ github.event.workflow_run.head_repository.full_name }}',
      RUN_HEAD_BRANCH: '${{ github.event.workflow_run.head_branch }}',
    });
    expect(JSON.stringify(gate)).not.toContain('secrets.');
  });

  it.each(AWS_DEPLOY_JOBS)(
    '%s is skipped until the deploy role exists and the gate says deploy',
    (id) => {
      const job = deploy.jobs[id];
      expect(job?.if).toContain(DEPLOY_GATE);
      expect(job?.if).toContain(GATE_OPEN);
      expect(needsOf(job)).toContain('gate');
      expect(environmentOf(job)).toBe('staging');
    },
  );

  it.each([
    ['parent-ios', 'IOS_UPLOAD_ENABLED', 'macos'],
    ['parent-android', 'PLAY_UPLOAD_ENABLED', 'ubuntu'],
  ])('%s checks its own upload variable and runs the Task 14 lane', (id, variable, os) => {
    const job = deploy.jobs[id] as Job & { 'runs-on': string };
    expect(job.if).toContain(`vars.${variable} == 'true'`);
    expect(job.if).toContain(GATE_OPEN);
    expect(job.if).not.toContain('AWS_');
    // Only the gate: the lanes never wait for the AWS jobs.
    expect(needsOf(job)).toEqual(['gate']);
    expect(environmentOf(job)).toBe('staging');
    expect(job['runs-on']).toContain(os);
    expect(job.env?.BUILD_NUMBER).toBe('${{ github.run_number }}');
    expect(runs(job)).toMatch(/bundle exec fastlane (ios|android) staging/);
    expect(job.permissions).toEqual({ contents: 'read' });
  });

  it('runs the jobs in order: build-push, migrate, deploy, seed, smoke', () => {
    expect(needsOf(deploy.jobs.migrate)).toContain('build-push');
    expect(needsOf(deploy.jobs.deploy)).toContain('migrate');
    expect(needsOf(deploy.jobs.seed)).toContain('deploy');
    expect(needsOf(deploy.jobs.smoke)).toContain('seed');
  });

  it('builds and pushes each image tagged with the commit', () => {
    const job = deploy.jobs['build-push'];
    expect(job?.strategy?.matrix?.image).toEqual(['api', 'staff', 'console', 'clamav']);
    const script = runs(job);
    expect(script).toContain('node scripts/docker-build.mjs');
    expect(script).toContain('--push');
    expect(script).toContain(':$DEPLOY_SHA');
    expect(script).toContain('NEXT_PUBLIC_APP_ENV=staging');
    expect(script).toContain('NEXT_PUBLIC_API_URL=https://staging.quad-edu.com');
    // Same digests, pulled through the mirror (M5).
    expect(job?.env?.QUAD_IMAGE_REGISTRY).toBe('mirror.gcr.io/');
    expect(JSON.stringify(job)).toContain('vars.SENTRY_DSN_STAFF');
    expect(JSON.stringify(job)).toContain('vars.SENTRY_DSN_CONSOLE');
    expect((job?.steps ?? []).map((step) => step.uses)).toContain(
      'aws-actions/amazon-ecr-login@v2',
    );
  });

  it('runs db-bootstrap, then migrate, and stops on a failed task (Review Focus #4)', () => {
    const script = runs(deploy.jobs.migrate);
    const bootstrap = script.indexOf('run-task --family-arn "$BOOTSTRAP"');
    const migrate = script.indexOf('run-task --family-arn "$MIGRATE"');
    expect(bootstrap).toBeGreaterThan(-1);
    expect(migrate).toBeGreaterThan(bootstrap);
    // Each step runs under bash -e, so a non-zero run-task ends the job and the workflow.
    for (const step of deploy.jobs.migrate?.steps ?? []) {
      expect(step['continue-on-error' as keyof Step]).toBeUndefined();
    }
  });

  it('registers every service first, then updates them all, then checks what they run (M7, I2)', () => {
    const script = runs(deploy.jobs.deploy);
    for (const service of ['api', 'worker', 'staff', 'console', 'clamav']) {
      expect(script).toContain(service);
    }
    expect(script).toContain('SENTRY_RELEASE=$DEPLOY_SHA');
    const lastRegister = script.lastIndexOf('ecs-deploy.mjs register');
    const firstUpdate = script.indexOf('ecs-deploy.mjs update-service');
    expect(lastRegister).toBeGreaterThan(-1);
    expect(firstUpdate).toBeGreaterThan(lastRegister);
    expect(script.indexOf('ecs-deploy.mjs wait-stable --expect')).toBeGreaterThan(firstUpdate);
  });

  it('seeds staging, then smoke-tests it with retries through CloudFront and the origin', () => {
    expect(runs(deploy.jobs.seed)).toContain('APP_ENV=staging');
    const smoke = runs(deploy.jobs.smoke);
    expect(smoke).toContain(
      'node scripts/smoke.mjs --web https://staging.quad-edu.com --console https://console.staging.quad-edu.com --origin https://origin.staging.quad-edu.com --expect-noindex',
    );
    expect(smoke).toMatch(/for attempt in/);
  });

  it('asks for an OIDC token only in jobs that assume the deploy role', () => {
    for (const [id, job] of Object.entries(deploy.jobs)) {
      const permissions = job.permissions as Record<string, string> | undefined;
      if (usesAws(job)) {
        expect(permissions, id).toEqual({ contents: 'read', 'id-token': 'write' });
        const credentials = (job.steps ?? []).find((step) =>
          step.uses?.startsWith('aws-actions/configure-aws-credentials'),
        );
        expect(credentials?.with, id).toEqual({
          'role-to-assume': '${{ vars.AWS_STAGING_DEPLOY_ROLE_ARN }}',
          'aws-region': 'ap-south-1',
        });
      } else {
        expect(permissions?.['id-token'], id).toBeUndefined();
      }
    }
  });

  it('checks out the commit CI tested', () => {
    for (const id of AWS_DEPLOY_JOBS) {
      const checkout = (deploy.jobs[id]?.steps ?? []).find((step) =>
        step.uses?.startsWith('actions/checkout'),
      );
      expect(checkout?.with?.ref, id).toBe(
        '${{ github.event.workflow_run.head_sha || github.sha }}',
      );
    }
  });
});

describe('infra.yml', () => {
  const paths = [
    'infra/**',
    'scripts/infra-check.mjs',
    'scripts/plan-summary.mjs',
    '.github/workflows/infra.yml',
  ];

  it('runs on pull requests and pushes that touch infra, weekly for drift, and by hand', () => {
    expect(infra.on).toMatchObject({
      pull_request: { paths },
      push: { branches: ['main', 'claude/**'], paths },
      workflow_dispatch: null,
    });
    expect(infra.on).toHaveProperty('schedule');
  });

  it('checks fmt, validate, tests, tflint and checkov with the scanners required', () => {
    const job = infra.jobs.checks;
    expect(job?.if).toBeUndefined();
    expect(job?.env?.QUAD_REQUIRE_INFRA_TOOLS).toBe('1');
    expect(runs(job)).toContain('node scripts/infra-check.mjs');
    expect(runs(job)).toContain('pip install checkov==3.3.25');
    const uses = (job?.steps ?? []).map((step) => step.uses ?? '');
    expect(uses).toContain('hashicorp/setup-terraform@v3');
    expect(uses).toContain('terraform-linters/setup-tflint@v4');
    const terraform = (job?.steps ?? []).find(
      (step) => step.uses === 'hashicorp/setup-terraform@v3',
    );
    expect(terraform?.with).toMatchObject({ terraform_wrapper: false });
    // The registry, not the local mirror: CI reaches registry.terraform.io.
    expect(JSON.stringify(job)).not.toContain('terraform-mirror');
    expect(JSON.stringify(job)).not.toContain('TF_CLI_CONFIG_FILE');
  });

  it('plans staging on same-repository pull requests only when the plan role exists', () => {
    const job = infra.jobs.plan;
    expect(job?.if).toContain("github.event_name == 'pull_request'");
    expect(job?.if).toContain("vars.AWS_STAGING_PLAN_ROLE_ARN != ''");
    expect(job?.if).toContain('github.event.pull_request.head.repo.full_name == github.repository');
    expect(job?.permissions).toEqual({
      contents: 'read',
      'id-token': 'write',
      'pull-requests': 'write',
    });
  });

  it('makes PR plans without a refresh or a lock (ruling R-pr-plan) and says so', () => {
    const script = runs(infra.jobs.plan);
    expect(script).toMatch(
      /terraform -chdir=infra\/envs\/staging plan [^\n]*-refresh=false -lock=false/,
    );
    expect(script).toContain('-var "otel_exporter_endpoint=$OTEL_ENDPOINT"');
    expect(script).toContain('-var "dns_role_arn=$DNS_ROLE_ARN"');
    const source = JSON.stringify(infra.jobs.plan);
    expect(source).toContain('vars.OTEL_EXPORTER_OTLP_ENDPOINT');
    expect(source).toContain('vars.TF_DNS_READ_ROLE_ARN');
    expect(source).toContain('vars.TF_STAGING_STATE_READ_ROLE_ARN');
    expect(source).toContain('vars.TF_STATE_KMS_KEY_ARN');
  });

  it('applies on main only, behind the infra-staging environment, from a refreshed plan', () => {
    const job = infra.jobs.apply;
    expect(job?.if).toContain("github.event_name == 'push'");
    expect(job?.if).toContain("github.ref == 'refs/heads/main'");
    expect(job?.if).toContain("vars.AWS_STAGING_APPLY_ROLE_ARN != ''");
    expect(environmentOf(job)).toBe('infra-staging');
    const script = runs(job);
    expect(script).not.toContain('-refresh=false');
    expect(script).toContain('apply');
    expect(script).toContain('-var "otel_exporter_endpoint=$OTEL_ENDPOINT"');
    const source = JSON.stringify(job);
    expect(source).toContain('vars.TF_STAGING_STATE_RW_ROLE_ARN');
    expect(source).toContain('vars.TF_STAGING_DNS_WRITE_ROLE_ARN');
    expect(source).toContain('vars.AWS_STAGING_APPLY_ROLE_ARN');
  });

  it('checks drift weekly with a refresh-only plan that fails on changes', () => {
    const job = infra.jobs.drift;
    expect(job?.if).toContain("vars.AWS_STAGING_APPLY_ROLE_ARN != ''");
    expect(environmentOf(job)).toBe('infra-staging');
    expect(runs(job)).toContain('-refresh-only -detailed-exitcode');
  });

  // The repository is public, so logs, comments and artifacts are world-readable (I1).
  it('never publishes a full plan: plan and apply output goes to a file, only a summary is shown', () => {
    const source = code('infra.yml');
    expect(source).not.toMatch(/\btee\b/);
    expect(source).not.toContain('show -no-color');
    expect(source).not.toContain('upload-artifact');
    for (const id of ['plan', 'apply', 'drift']) {
      const lines = runs(infra.jobs[id]).split('\n');
      const terraformRuns = lines.filter((line) => /terraform -chdir=\S+ (plan|apply) /.test(line));
      expect(terraformRuns.length, id).toBeGreaterThan(0);
      for (const line of terraformRuns) {
        expect(line, `${id}: ${line}`).toMatch(/> "\$RUNNER_TEMP\/[a-z-]+\.log"/);
      }
      const summary = lines.find((line) => line.includes('show -json'));
      expect(summary, id).toMatch(/show -json tfplan \| node scripts\/plan-summary\.mjs --title/);
    }
    expect(runs(infra.jobs.drift)).toContain('--drift');
    expect(runs(infra.jobs.apply)).toContain('$GITHUB_STEP_SUMMARY');
    expect(runs(infra.jobs.drift)).toContain('$GITHUB_STEP_SUMMARY');
  });

  it('keeps one plan comment per pull request up to date (M6)', () => {
    const comment = (infra.jobs.plan?.steps ?? []).find((step) =>
      step.uses?.startsWith('actions/github-script'),
    );
    const script = typeof comment?.with?.script === 'string' ? comment.with.script : '';
    expect(script).toContain('<!-- quad-terraform-plan:staging -->');
    expect(script).toContain('updateComment');
    expect(script).toContain('createComment');
    expect(script).toContain('plan-summary.md');
    expect(script).not.toContain('plan.txt');
    expect(script).toContain('without a refresh');
  });

  it('never lets init change a committed lock file (M6)', () => {
    const inits = Object.values(infra.jobs)
      .flatMap((job) => runs(job).split('\n'))
      .filter((line) => /terraform -chdir=\S+ init/.test(line));
    expect(inits.length).toBe(3);
    for (const line of inits) expect(line).toContain('-lockfile=readonly');
  });

  it('reads the backend settings, the KMS key included, from variables', () => {
    for (const id of ['plan', 'apply', 'drift']) {
      const source = JSON.stringify(infra.jobs[id]);
      for (const name of ['TF_STATE_BUCKET', 'TF_LOCK_TABLE', 'TF_STATE_KMS_KEY_ARN']) {
        expect(source, `${id} ${name}`).toContain(`vars.${name}`);
      }
      expect(runs(infra.jobs[id]), id).toContain('kms_key_id');
    }
  });
});
