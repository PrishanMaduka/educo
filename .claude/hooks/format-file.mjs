#!/usr/bin/env node
// PostToolUse hook: format the file Claude just wrote, if the tools are installed. Never fails the edit.
import { execFileSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { join } from 'node:path';

let raw = '';
process.stdin.on('data', (c) => (raw += c));
process.stdin.on('end', () => {
  let file = '';
  try {
    file = JSON.parse(raw)?.tool_input?.file_path ?? '';
  } catch {
    return;
  }
  // design/ is hand-written prototype HTML; leave its formatting alone.
  if (!file || file.includes('/design/') || !existsSync(file)) return;
  const root = process.env.CLAUDE_PROJECT_DIR ?? process.cwd();
  const run = (cmd, args) => {
    try {
      execFileSync(cmd, args, { cwd: root, stdio: 'ignore', timeout: 30_000 });
    } catch {
      // Best effort: lint in pnpm verify is the real gate.
    }
  };
  const eslint = join(root, 'node_modules/.bin/eslint');
  const prettier = join(root, 'node_modules/.bin/prettier');
  if (/\.(ts|tsx|js|jsx|mjs|cjs)$/.test(file) && existsSync(eslint)) run(eslint, ['--fix', '--no-warn-ignored', file]);
  if (/\.(ts|tsx|js|jsx|mjs|cjs|json|css|md|ya?ml)$/.test(file) && existsSync(prettier)) run(prettier, ['--write', '--ignore-unknown', file]);
  if (file.endsWith('.dart')) run('dart', ['format', file]);
});
