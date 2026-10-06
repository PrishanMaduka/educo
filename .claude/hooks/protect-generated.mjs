#!/usr/bin/env node
// PreToolUse hook: block hand edits to generated files (CLAUDE.md: regenerate, never edit).
let raw = '';
process.stdin.on('data', (c) => (raw += c));
process.stdin.on('end', () => {
  let file = '';
  try {
    file = JSON.parse(raw)?.tool_input?.file_path ?? '';
  } catch {
    process.exit(0);
  }
  const rules = [
    [/packages\/client\/src\/generated\//, 'pnpm api:client'],
    [/packages\/contracts\/openapi\.json$/, 'pnpm api:client'],
    [/apps\/parent\/packages\/quad_api\//, 'pnpm api:client'],
    [/apps\/parent\/lib\/theme\/tokens\.g\.dart$/, 'pnpm tokens:build'],
    [/packages\/tokens\/dist\//, 'pnpm tokens:build'],
    [/apps\/parent\/lib\/l10n\/app_[a-z]+\.arb$/, 'pnpm i18n:build (edit packages/contracts/i18n/en.json)'],
    [/\.(g|freezed)\.dart$/, 'dart run build_runner build'],
    [/(^|\/)(pnpm-lock\.yaml|pubspec\.lock)$/, 'pnpm install / flutter pub get'],
  ];
  const hit = rules.find(([re]) => re.test(file));
  if (hit) {
    process.stderr.write(`${file} is generated. Change its source and run \`${hit[1]}\` instead of editing it by hand.\n`);
    process.exit(2);
  }
});
