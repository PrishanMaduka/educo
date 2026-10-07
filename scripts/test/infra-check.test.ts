import { describe, expect, it } from 'vitest';

import {
  checkSteps,
  INFRA_MODULES,
  INFRA_ROOTS,
  infraEnv,
  scannerPolicy,
  selectDirs,
} from '../infra-check.mjs';

const commands = (steps: { command: string[] }[]) => steps.map((s) => s.command.join(' '));
const none = () => false;

describe('infraEnv', () => {
  it('drops every AWS_ variable and turns off the instance metadata lookup', () => {
    expect(infraEnv({ AWS_ACCESS_KEY_ID: 'x', AWS_PROFILE: 'p', PATH: '/bin' })).toEqual({
      PATH: '/bin',
      AWS_EC2_METADATA_DISABLED: 'true',
      TF_IN_AUTOMATION: '1',
    });
  });

  it('does not change the environment it was given', () => {
    const env = { AWS_REGION: 'ap-south-1' };
    infraEnv(env);
    expect(env).toEqual({ AWS_REGION: 'ap-south-1' });
  });
});

describe('infra directories', () => {
  it('lists the three roots and five modules', () => {
    expect(INFRA_ROOTS).toEqual(['infra/bootstrap', 'infra/envs/global', 'infra/envs/staging']);
    expect(INFRA_MODULES).toEqual([
      'infra/modules/network',
      'infra/modules/data',
      'infra/modules/edge',
      'infra/modules/dns',
      'infra/modules/app',
    ]);
  });
});

describe('checkSteps', () => {
  it('starts with fmt, then initialises each directory without a backend and validates it', () => {
    const steps = commands(
      checkSteps(['infra/modules/network'], { tflint: false, checkov: false }, none),
    );
    expect(steps).toEqual([
      'terraform fmt -check -recursive infra',
      'terraform -chdir=infra/modules/network init -backend=false -input=false',
      'terraform -chdir=infra/modules/network validate',
    ]);
  });

  it('runs terraform test only where a tests directory exists', () => {
    const steps = commands(
      checkSteps(
        ['infra/modules/data', 'infra/modules/edge'],
        { tflint: false, checkov: false },
        (p) => p === 'infra/modules/edge/tests',
      ),
    );
    expect(steps).toContain('terraform -chdir=infra/modules/edge test');
    expect(steps).not.toContain('terraform -chdir=infra/modules/data test');
  });

  it('leaves validation to terraform test for a tested module that declares provider aliases', () => {
    const steps = commands(
      checkSteps(
        ['infra/modules/edge', 'infra/modules/dns'],
        { tflint: false, checkov: false },
        (p) => p === 'infra/modules/edge/tests',
        () => true,
      ),
    );
    expect(steps).not.toContain('terraform -chdir=infra/modules/edge validate');
    expect(steps).toContain('terraform -chdir=infra/modules/edge test');
    // Without tests nothing else would validate it, so it is still validated (and fails).
    expect(steps).toContain('terraform -chdir=infra/modules/dns validate');
  });

  it('adds tflint only when it is available, with an absolute config path', () => {
    expect(
      commands(checkSteps([], { tflint: false, checkov: false }, none)).join('\n'),
    ).not.toContain('tflint');
    const steps = checkSteps([], { tflint: true, checkov: false }, none);
    const tflint = steps.filter((s) => s.command[0] === 'tflint');
    expect(tflint.map((s) => s.command.slice(0, 2))).toEqual([
      ['tflint', '--init'],
      ['tflint', '--recursive'],
    ]);
    for (const step of tflint) {
      expect(step.cwd).toBe('infra');
      expect(step.command.at(-1)).toMatch(/^\/.*\/infra\/\.tflint\.hcl$/);
    }
  });

  it('adds checkov last, only when it is available', () => {
    expect(
      commands(checkSteps([], { tflint: false, checkov: false }, none)).join('\n'),
    ).not.toContain('checkov');
    expect(commands(checkSteps([], { tflint: true, checkov: true }, none)).at(-1)).toBe(
      'checkov -d infra --config-file infra/.checkov.yaml',
    );
  });
});

describe('scannerPolicy', () => {
  it('warns about a missing scanner by default', () => {
    expect(scannerPolicy({ tflint: false, checkov: true }, {})).toEqual({
      missing: ['tflint'],
      action: 'warn',
    });
  });

  it('fails on a missing scanner with QUAD_REQUIRE_INFRA_TOOLS=1', () => {
    expect(
      scannerPolicy({ tflint: false, checkov: false }, { QUAD_REQUIRE_INFRA_TOOLS: '1' }),
    ).toEqual({
      missing: ['tflint', 'checkov'],
      action: 'fail',
    });
  });

  it('has nothing to report when both scanners are present', () => {
    expect(
      scannerPolicy({ tflint: true, checkov: true }, { QUAD_REQUIRE_INFRA_TOOLS: '1' }),
    ).toEqual({
      missing: [],
      action: 'ok',
    });
  });
});

describe('selectDirs', () => {
  it('checks every module, then every root, by default', () => {
    expect(selectDirs(undefined)).toEqual([...INFRA_MODULES, ...INFRA_ROOTS]);
  });

  it('checks one known root or module with --only', () => {
    expect(selectDirs('infra/envs/staging')).toEqual(['infra/envs/staging']);
    expect(selectDirs('infra/modules/edge/')).toEqual(['infra/modules/edge']);
  });

  it.each(['infra', 'infra/modules/nope', '../elsewhere', ''])('refuses --only %j', (dir) => {
    expect(() => selectDirs(dir)).toThrow(/not an infra root or module/);
  });
});
