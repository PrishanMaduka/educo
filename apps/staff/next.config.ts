import { parseWebPublicEnv } from '@quad/contracts/web-env';

import type { NextConfig } from 'next';

// Spec 02 "Web public (build time)": refuse to build with invalid public variables.
const env = parseWebPublicEnv(process.env);

const config: NextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  // The workspace packages ship TypeScript source.
  transpilePackages: ['@quad/contracts', '@quad/domain', '@quad/tokens', '@quad/ui'],
  // `pnpm lint` runs ESLint for every package; the build only type-checks.
  eslint: { ignoreDuringBuilds: true },
  rewrites() {
    // Locally the API runs on :4000; in staging and production the edge routes /api/v1 first (spec 02).
    return Promise.resolve([
      { source: '/api/v1/:path*', destination: `${env.NEXT_PUBLIC_API_URL}/api/v1/:path*` },
    ]);
  },
};

export default config;
