import { describe, expect, it } from 'vitest';

import { runSteps, STEPS } from '../verify.mjs';

const step = (name: string) => ({ name, command: ['pnpm', name] });

describe('STEPS', () => {
  it('runs the gate in the order spec 17 and the delivery plan set', () => {
    expect(STEPS.map((s) => s.command.join(' '))).toEqual([
      'pnpm exec turbo run typecheck lint test',
      'pnpm codegen:check',
      'node scripts/check-services.mjs',
      'pnpm test:api',
      'pnpm e2e',
      'pnpm audit --prod --audit-level high',
    ]);
  });
});

describe('runSteps', () => {
  it('runs every step in order and passes when all exit 0', () => {
    const ran: string[] = [];
    const log: string[] = [];
    const result = runSteps(
      [step('a'), step('b')],
      (command) => {
        ran.push(command.join(' '));
        return 0;
      },
      (line) => log.push(line),
    );

    expect(result).toEqual({ ok: true });
    expect(ran).toEqual(['pnpm a', 'pnpm b']);
    expect(log[0]).toBe('verify [1/2] a: pnpm a');
    expect(log[1]).toBe('verify [2/2] b: pnpm b');
    expect(log.at(-1)).toBe('verify passed: all 2 steps succeeded.');
  });

  it('stops at the first failing step and names it', () => {
    const ran: string[] = [];
    const log: string[] = [];
    const result = runSteps(
      [step('a'), step('b'), step('c')],
      (command) => {
        ran.push(command.join(' '));
        return command[1] === 'b' ? 2 : 0;
      },
      (line) => log.push(line),
    );

    expect(ran).toEqual(['pnpm a', 'pnpm b']);
    expect(result).toEqual({ ok: false, failed: step('b'), status: 2 });
    expect(log.at(-1)).toBe('verify FAILED at step 2/3 (b): "pnpm b" exited with code 2.');
  });

  it('passes each step to exec and prefixes log lines with the label', () => {
    const seen: string[] = [];
    const log: string[] = [];
    const steps = [{ ...step('a'), cwd: 'infra' }];
    const result = runSteps(
      steps,
      (_command, s) => {
        seen.push(s.cwd);
        return 0;
      },
      (line) => log.push(line),
      'infra-check',
    );

    expect(result).toEqual({ ok: true });
    expect(seen).toEqual(['infra']);
    expect(log).toEqual([
      'infra-check [1/1] a: pnpm a',
      'infra-check passed: all 1 steps succeeded.',
    ]);
  });

  it('treats a command killed by a signal as a failure', () => {
    const result = runSteps(
      [step('a')],
      () => null,
      () => undefined,
    );

    expect(result).toEqual({ ok: false, failed: step('a'), status: null });
  });
});
