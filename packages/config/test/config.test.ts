import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import { Linter } from 'eslint';
import tseslint from 'typescript-eslint';
import { describe, expect, it } from 'vitest';

import baseConfig from '../eslint/base.mjs';
import { defineWebAppConfig } from '../playwright/preset';
import { vitestPreset } from '../vitest/preset';

const read = (rel: string) => readFileSync(fileURLToPath(new URL(rel, import.meta.url)), 'utf8');

describe('@quad/config', () => {
  it('base ESLint config reports no-explicit-any', () => {
    const linter = new Linter({ configType: 'flat' });
    // The Linter API has no TypeScript project, so switch off the type-aware rules only.
    const messages = linter.verify(
      'const x: any = 1;\nexport { x };\n',
      [...baseConfig, tseslint.configs.disableTypeChecked] as Linter.Config[],
      { filename: 'sample.ts' },
    );
    expect(messages.map((m) => m.ruleId)).toContain('@typescript-eslint/no-explicit-any');
  });

  it('base tsconfig is strict with noUncheckedIndexedAccess', () => {
    const tsconfig = JSON.parse(read('../tsconfig/base.json')) as {
      compilerOptions: Record<string, unknown>;
    };
    expect(tsconfig.compilerOptions.strict).toBe(true);
    expect(tsconfig.compilerOptions.noUncheckedIndexedAccess).toBe(true);
  });

  it.each(['react', 'next'])('%s ESLint config loads as a non-empty array', async (name) => {
    const mod = (await import(`../eslint/${name}.mjs`)) as { default: unknown };
    expect(Array.isArray(mod.default)).toBe(true);
    expect((mod.default as unknown[]).length).toBeGreaterThan(0);
  });

  it('react ESLint config reports arbitrary colours in .ts and .tsx files', async () => {
    const react = ((await import('../eslint/react.mjs')) as { default: Linter.Config[] }).default;
    const linter = new Linter({ configType: 'flat' });
    const config = [...react, tseslint.configs.disableTypeChecked] as Linter.Config[];
    for (const filename of ['variants.ts', 'Card.tsx']) {
      const messages = linter.verify("export const c = 'dark:bg-[#000]';\n", config, { filename });
      expect(messages.map((m) => m.ruleId)).toContain('quad/no-arbitrary-colour');
    }
  });

  it('Vitest preset fails a run that contains .only', () => {
    expect(vitestPreset.test?.allowOnly).toBe(false);
  });

  it('Playwright preset fails on .only outside CI too', () => {
    expect(defineWebAppConfig({ port: 3000 }).forbidOnly).toBe(true);
  });

  it('Playwright webServer starts the existing build and never reuses a running server', () => {
    const { webServer } = defineWebAppConfig({ port: 3000 });
    expect(webServer).toMatchObject({
      command: 'pnpm exec next start --port 3000',
      reuseExistingServer: false,
    });
  });

  it('starts no API stack unless the specs need it', () => {
    expect(Array.isArray(defineWebAppConfig({ port: 3000 }).webServer)).toBe(false);
  });

  it('starts the e2e stack on :4000 before next start when the specs need the API', () => {
    const config = defineWebAppConfig({ port: 3000, stack: true });
    expect(Array.isArray(config.webServer)).toBe(true);
    const [stack, next] = config.webServer as unknown[];
    expect(stack).toMatchObject({
      url: 'http://localhost:4000/api/v1/health/ready',
      reuseExistingServer: false,
      // SIGTERM and a wait, never an immediate kill: the stack drops its database on the way out.
      gracefulShutdown: { signal: 'SIGTERM' },
    });
    expect((stack as { command: string }).command).toMatch(/e2e-stack\.mjs" --port 4000$/);
    expect(next).toMatchObject({ command: 'pnpm exec next start --port 3000', port: 3000 });
    expect(config.use?.stackPort).toBe(4000);
  });

  it('takes the stack port, so a second app can run its stack on :4001', () => {
    const config = defineWebAppConfig({ port: 3001, stack: { port: 4001 } });
    const [stack] = config.webServer as unknown[];
    expect(stack).toMatchObject({ url: 'http://localhost:4001/api/v1/health/ready' });
    expect(config.use?.stackPort).toBe(4001);
  });
});
