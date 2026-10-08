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
});
