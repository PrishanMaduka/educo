import { parseWebPublicEnv } from '@quad/contracts/web-env';

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

export default config;
