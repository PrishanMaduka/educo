import { defineConfig } from 'tsup';

/**
 * Bundles the API, worker, OpenAPI export and image commands into CommonJS files under `dist/`.
 * `scripts/copy-migrations.mjs` then copies the migrations into `dist/migrations`.
 * - `@quad/*` workspace packages ship TypeScript source, so they are bundled in (they are
 *   devDependencies for that reason). Every npm package they use at runtime (`pg`,
 *   `drizzle-orm`, `zod`) must also be an apps/api dependency, so it stays external, loads from
 *   node_modules and can be patched by OpenTelemetry. `scripts/check-dist.mjs` fails the build
 *   otherwise.
 * - tsup transpiles with SWC because `emitDecoratorMetadata` is on in tsconfig.json; Nest's
 *   dependency injection needs that metadata.
 */
export default defineConfig({
  entry: {
    main: 'src/main.ts',
    worker: 'src/worker.ts',
    'openapi-export': 'src/openapi/export.ts',
    // One-off commands and the worker health check of the api image (D28).
    migrate: 'src/cli/migrate.ts',
    seed: 'src/cli/seed.ts',
    'db-bootstrap': 'src/cli/db-bootstrap.ts',
    'worker-health': 'src/cli/worker-health.ts',
  },
  format: ['cjs'],
  platform: 'node',
  target: 'node22',
  outDir: 'dist',
  sourcemap: true,
  clean: true,
  // `import.meta.url` in bundled workspace code (for example @quad/db's env helpers).
  shims: true,
  noExternal: [/^@quad\//],
});
