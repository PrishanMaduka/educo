import eslint from '@eslint/js';
import importX from 'eslint-plugin-import-x';
import globals from 'globals';
import tseslint from 'typescript-eslint';

import { quad } from './plugin.mjs';

export const importOrderRule = [
  'error',
  {
    groups: ['builtin', 'external', 'internal', 'parent', 'sibling', 'index', 'type'],
    'newlines-between': 'always',
    alphabetize: { order: 'asc', caseInsensitive: true },
  },
];

/** Base flat config for every TypeScript package: strict, type-checked, no `any`. */
export default tseslint.config(
  {
    ignores: [
      '**/node_modules/**',
      '**/dist/**',
      '**/.next/**',
      '**/coverage/**',
      '**/.turbo/**',
      '**/generated/**',
      // Flutter app: Dart is checked by flutter analyze; add TS here only with its own lint config.
      'apps/parent/**',
    ],
  },
  eslint.configs.recommended,
  tseslint.configs.strictTypeChecked,
  {
    languageOptions: { parserOptions: { projectService: true } },
    rules: {
      '@typescript-eslint/no-explicit-any': 'error',
      '@typescript-eslint/consistent-type-imports': 'error',
      '@typescript-eslint/restrict-template-expressions': ['error', { allowNumber: true }],
      // Nest modules are decorated classes with no members (`@Module({...}) class X {}`).
      '@typescript-eslint/no-extraneous-class': ['error', { allowWithDecorator: true }],
    },
  },
  {
    files: ['**/*.cjs'],
    languageOptions: { globals: { ...globals.node } },
  },
  {
    files: ['**/*.{js,mjs,cjs}'],
    extends: [tseslint.configs.disableTypeChecked],
  },
  {
    files: ['**/*.test.{ts,tsx}', '**/test/**/*.{ts,tsx}'],
    rules: { '@typescript-eslint/no-non-null-assertion': 'off' },
  },
  {
    plugins: { 'import-x': importX },
    rules: { 'import-x/order': importOrderRule },
  },
  {
    plugins: { quad },
    rules: {
      'quad/no-cli-import': 'error',
      'quad/no-raw-db-client': 'error',
      'quad/no-with-open-outside-otp': 'error',
      'quad/no-with-platform-outside-platform': 'error',
    },
  },
);
