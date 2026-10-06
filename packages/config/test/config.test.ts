import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import { Linter } from 'eslint';
import tseslint from 'typescript-eslint';
import { describe, expect, it } from 'vitest';

import baseConfig from '../eslint/base.mjs';

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
});
