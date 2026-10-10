import { join } from 'node:path';

import { parseWebPublicEnv } from '@quad/contracts/web-env';

import type { NextConfig } from 'next';

/*
 * The pre-launch public site as static files (decision log, 2026-10-08): GitHub Pages serves the
 * export at quad-edu.com until the AWS deploy exists. This Next.js root holds only the public
 * routes; each file under app/ re-exports the staff app's own module, so the page is built from the
 * same components while the portal, the health check, the middleware and the server
 * instrumentation stay out. Build it with `pnpm --filter @quad/staff build:export`.
 */
const env = parseWebPublicEnv(process.env, { demoForm: true });
if (!env.NEXT_PUBLIC_QUAD_PRELAUNCH) {
  throw new Error('The static export is the pre-launch site: set NEXT_PUBLIC_QUAD_PRELAUNCH=true.');
}

/** The webpack settings this config changes. */
interface WebpackConfig {
  resolve: { alias?: Record<string, string | false | string[]> };
}

const config: NextConfig = {
  reactStrictMode: true,
  output: 'export',
  // The modules live in ../src, outside this root.
  experimental: { externalDir: true, optimizePackageImports: ['@quad/ui'] },
  transpilePackages: ['@quad/contracts', '@quad/domain', '@quad/tokens', '@quad/ui'],
  // `pnpm lint` and `pnpm typecheck` cover these files with the staff app.
  eslint: { ignoreDuringBuilds: true },
  typescript: { ignoreBuildErrors: true },
  images: { unoptimized: true },
  // The build split (D57): `(public)/_live` (sign-in, the API client, Turnstile) is swapped for the
  // stubs in prelaunch/ before compilation, so none of it is bundled; checkExport then scans the
  // output for anything that would still need the API.
  webpack: (webpackConfig: WebpackConfig, { dir }: { dir: string }) => {
    webpackConfig.resolve.alias = {
      ...webpackConfig.resolve.alias,
      [join(dir, '..', 'src/app/(public)/_live')]: join(dir, 'prelaunch'),
    };
    return webpackConfig;
  },
};

export default config;
