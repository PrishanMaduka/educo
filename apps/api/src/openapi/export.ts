import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';

import { buildOpenApiDocument } from './document';

/**
 * Writes the OpenAPI document to the given path without starting the server:
 * `pnpm --filter @quad/api openapi:export ../../packages/contracts/openapi.json`.
 */
function main(argv: readonly string[]): void {
  const target = argv[2];
  if (target === undefined) {
    process.stderr.write('Usage: openapi:export <output path>\n');
    process.exit(1);
  }
  const path = resolve(process.cwd(), target);
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, `${JSON.stringify(buildOpenApiDocument(), null, 2)}\n`);
  process.stdout.write(`Wrote ${path}\n`);
}

main(process.argv);
