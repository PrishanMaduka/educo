import { defineConfig } from 'tsup';

/**
 * Bundles the API, worker and OpenAPI export into CommonJS files under `dist/`.
 * - `@quad/*` workspace packages ship TypeScript source, so they are bundled in (they are
 *   devDependencies for that reason); npm `dependencies` stay external and load from
 *   node_modules, which also lets OpenTelemetry patch them as they are required.
 * - tsup transpiles with SWC because `emitDecoratorMetadata` is on in tsconfig.json; Nest's
 *   dependency injection needs that metadata.
 */
export default defineConfig({
  entry: {
    main: 'src/main.ts',
    worker: 'src/worker.ts',
    'openapi-export': 'src/openapi/export.ts',
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
  // Optional native binding that `pg` only loads on request.
  external: ['pg-native'],
});
