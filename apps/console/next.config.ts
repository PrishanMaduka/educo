import { fileURLToPath } from 'node:url';

import { parseWebPublicEnv } from '@quad/contracts/web-env';
import { PHASE_PRODUCTION_SERVER } from 'next/constants';

import type { NextConfig } from 'next';

// Spec 02 "Web public (build time)": refuse to build with invalid public variables.
const env = parseWebPublicEnv(process.env);

const config: NextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  // The images run `.next/standalone` (docker/web.Dockerfile). Tracing starts at the repository
  // root so the workspace packages and the pnpm store links are copied in with the server.
  output: 'standalone',
  outputFileTracingRoot: fileURLToPath(new URL('../../', import.meta.url)),
  // The images run on Alpine (musl), so the glibc sharp builds are dead weight; TypeScript is
  // only needed to build.
  outputFileTracingExcludes: {
    '*': [
      '**/@img/sharp-libvips-linux-x64/**',
      '**/@img/sharp-linux-x64/**',
      '**/node_modules/typescript/**',
    ],
  },
  // The workspace packages ship TypeScript source.
  transpilePackages: ['@quad/client', '@quad/contracts', '@quad/tokens', '@quad/ui'],
  // `pnpm lint` runs ESLint for every package; the build only type-checks.
  eslint: { ignoreDuringBuilds: true },
  rewrites() {
    // The console only calls the platform API (spec 02: console.quad-edu.com/api/v1/platform/*).
    return Promise.resolve([
      {
        source: '/api/v1/platform/:path*',
        destination: `${env.NEXT_PUBLIC_API_URL}/api/v1/platform/:path*`,
      },
    ]);
  },
};

/**
 * Sentry's build plugin, with nothing sent from the build: no telemetry, no release and no source
 * map upload (deferred, D28). No build-time rewriting or wrapping of server code: errors are
 * reported through `onRequestError` in src/instrumentation.ts. The browser bundle drops Sentry's
 * tracing, debug logging and replay code. `next start` only reads this file for runtime options,
 * so there the plugin is not loaded at all (nothing from Sentry loads unless SENTRY_DSN is set).
 */
export default async function nextConfig(phase: string): Promise<NextConfig> {
  if (phase === PHASE_PRODUCTION_SERVER) return config;
  const { withSentryConfig } = await import('@sentry/nextjs/config');
  return withSentryConfig(config, {
    silent: true,
    telemetry: false,
    sourcemaps: { disable: true },
    release: { create: false, finalize: false },
    // No build-time rewriting of server dependencies, and no Sentry runtime in the server bundle.
    buildTimeInstrumentation: false,
    webpack: {
      autoInstrumentServerFunctions: false,
      autoInstrumentMiddleware: false,
      autoInstrumentAppDirectory: false,
      treeshake: {
        removeTracing: true,
        removeDebugLogging: true,
        excludeReplayIframe: true,
        excludeReplayShadowDOM: true,
        excludeReplayCompressionWorker: true,
      },
    },
  });
}
