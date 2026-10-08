import { describe, expect, it } from 'vitest';

import { deployDecision, gateInputFromEnv, runGate } from '../deploy-gate.mjs';

const sha = 'a'.repeat(40);
const newer = 'b'.repeat(40);

/** A green CI run of a push to main in this repository, for the tip of main. */
const fromCi = {
  event: 'workflow_run',
  ref: 'refs/heads/main',
  repository: 'prishanmaduka/educo',
  sha,
  run: {
    conclusion: 'success',
    event: 'push',
    headRepository: 'prishanmaduka/educo',
    headBranch: 'main',
  },
  mainTip: sha,
  ciPassed: false,
};

const byHand = {
  event: 'workflow_dispatch',
  ref: 'refs/heads/main',
  repository: 'prishanmaduka/educo',
  sha,
  run: undefined,
  mainTip: sha,
  ciPassed: true,
};

describe('deployDecision', () => {
  it('deploys the tip of main after CI succeeded on a push to it', () => {
    expect(deployDecision(fromCi)).toEqual({
      deploy: true,
      reason: `Deploying ${sha}, the tip of main.`,
    });
  });

  it('skips a commit that is no longer the tip of main (I3)', () => {
    const decision = deployDecision({ ...fromCi, mainTip: newer });
    expect(decision.deploy).toBe(false);
    expect(decision.reason).toContain(`main is now at ${newer}`);
  });

  it.each([
    ['CI failed', { conclusion: 'failure' }, 'CI did not succeed'],
    ['CI ran for a pull request', { event: 'pull_request' }, 'not a push'],
    ['CI ran for a fork', { headRepository: 'someone/educo' }, 'another repository'],
    ['CI ran for another branch', { headBranch: 'develop' }, 'not main'],
  ])('skips when %s', (_name, run, reason) => {
    const decision = deployDecision({ ...fromCi, run: { ...fromCi.run, ...run } });
    expect(decision.deploy).toBe(false);
    expect(decision.reason).toContain(reason);
  });

  it('deploys by hand from main when CI passed for the commit (M2)', () => {
    expect(deployDecision(byHand).deploy).toBe(true);
  });

  it('refuses by hand when CI has not passed for the commit (M2)', () => {
    const decision = deployDecision({ ...byHand, ciPassed: false });
    expect(decision.deploy).toBe(false);
    expect(decision.reason).toContain('CI has not succeeded');
  });

  it('refuses by hand from another branch', () => {
    const decision = deployDecision({ ...byHand, ref: 'refs/heads/claude/x' });
    expect(decision.deploy).toBe(false);
    expect(decision.reason).toContain('only from main');
  });

  it('refuses any other event', () => {
    expect(deployDecision({ ...byHand, event: 'push' }).deploy).toBe(false);
  });

  it('refuses when the tip of main is unknown', () => {
    expect(deployDecision({ ...fromCi, mainTip: '' }).deploy).toBe(false);
  });
});

describe('gateInputFromEnv', () => {
  it('reads the workflow_run fields only for a workflow_run', () => {
    const env = {
      EVENT_NAME: 'workflow_run',
      REF: 'refs/heads/main',
      REPOSITORY: 'prishanmaduka/educo',
      DEPLOY_SHA: sha,
      RUN_CONCLUSION: 'success',
      RUN_EVENT: 'push',
      RUN_HEAD_REPOSITORY: 'prishanmaduka/educo',
      RUN_HEAD_BRANCH: 'main',
    };
    expect(gateInputFromEnv(env)).toEqual({
      event: 'workflow_run',
      ref: 'refs/heads/main',
      repository: 'prishanmaduka/educo',
      sha,
      run: fromCi.run,
    });
    expect(gateInputFromEnv({ ...env, EVENT_NAME: 'workflow_dispatch' }).run).toBeUndefined();
  });
});

describe('runGate', () => {
  const env = {
    EVENT_NAME: 'workflow_dispatch',
    REF: 'refs/heads/main',
    REPOSITORY: 'prishanmaduka/educo',
    DEPLOY_SHA: sha,
  };

  it('asks GitHub for the tip of main and a green CI push run, and writes the output', () => {
    const calls: string[][] = [];
    const gh = (args: string[]) => {
      calls.push(args);
      const path = args.find((arg) => arg.startsWith('repos/')) ?? '';
      if (path.endsWith('/git/ref/heads/main')) return { status: 0, stdout: `${sha}\n` };
      return { status: 0, stdout: '1\n' };
    };
    const outputs: string[] = [];
    const code = runGate(
      env,
      gh,
      (line) => outputs.push(line),
      () => undefined,
    );
    expect(code).toBe(0);
    expect(outputs).toEqual(['deploy=true\n']);
    const runs = calls.find((call) =>
      call.some((arg) => arg.includes('/actions/workflows/ci.yml/runs')),
    );
    expect(runs?.join(' ')).toContain(`head_sha=${sha}`);
    expect(runs?.join(' ')).toContain('event=push');
    expect(runs?.join(' ')).toContain('status=success');
  });

  it('writes deploy=false, without failing, when the commit is stale', () => {
    const gh = (args: string[]) =>
      args.some((arg) => arg.endsWith('/git/ref/heads/main'))
        ? { status: 0, stdout: `${newer}\n` }
        : { status: 0, stdout: '1\n' };
    const outputs: string[] = [];
    const notes: string[] = [];
    expect(
      runGate(
        env,
        gh,
        (line) => outputs.push(line),
        (line) => notes.push(line),
      ),
    ).toBe(0);
    expect(outputs).toEqual(['deploy=false\n']);
    expect(notes.join('')).toContain('main is now at');
  });

  it('fails when GitHub cannot be asked', () => {
    const gh = () => ({ status: 1, stdout: '', stderr: 'HTTP 401' });
    const notes: string[] = [];
    expect(
      runGate(
        env,
        gh,
        () => undefined,
        (line) => notes.push(line),
      ),
    ).toBe(1);
    expect(notes.join('')).toContain('HTTP 401');
  });
});
