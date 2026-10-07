import { parseWebPublicEnv } from '@quad/contracts/web-env';
import { withSentryConfig } from '@sentry/nextjs/config';

import type { NextConfig } from 'next';

// Spec 02 "Web public (build time)": refuse to build with invalid public variables.
const env = parseWebPublicEnv(process.env);

const config: NextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  // The workspace packages ship TypeScript source.
  transpilePackages: ['@quad/contracts', '@quad/tokens', '@quad/ui'],
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

// Sentry's build plugin, with nothing sent from the build: no telemetry, no release and no
// source map upload (deferred, D28). Error reporting itself is set up in src/instrumentation*.ts.
export default withSentryConfig(config, {
  silent: true,
  telemetry: false,
  sourcemaps: { disable: true },
  release: { create: false, finalize: false },
});
