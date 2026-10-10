#!/usr/bin/env node
// Builds the pre-launch public site as static files for GitHub Pages (decision log, 2026-10-08):
// `next build site-export` (output: 'export'), then the files GitHub Pages needs, then a check that
// the result holds the public site and nothing else, and nothing in it needs the API (D57).
// Output: apps/staff/site-export/out.
import { spawnSync } from 'node:child_process';
import console from 'node:console';
import { copyFileSync, cpSync, existsSync, readFileSync, readdirSync } from 'node:fs';
import { dirname, join, relative, resolve, sep } from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

const app = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const root = join(app, 'site-export');
const out = join(root, 'out');

/** Files the published site must have. */
export const REQUIRED = [
  'index.html',
  'about.html',
  'security.html',
  'legal/privacy.html',
  'legal/terms.html',
  'sitemap.xml',
  '404.html',
  'CNAME',
  'robots.txt',
  'icon.svg',
  '_next/static',
];

/**
 * Routes the pre-launch site must never publish: the portal, the style guide, the health check,
 * and sign-in with its signed-link pages (D32: `/sign-in` and `/app` stay out of the export).
 */
const PORTAL_ROUTES = [
  'app',
  'app.html',
  'design',
  'design.html',
  'healthz',
  'sign-in',
  'sign-in.html',
];

/**
 * The app-link routes (D57): `/p/*` fallback pages and the `.well-known` files need the live
 * server (`/p/*` paths can carry signed tokens), so the export never holds them.
 */
const APP_LINK_ROUTES = ['p', 'p.html', '.well-known'];

/**
 * Text that means a file needs the live site (D57): an API call, the Turnstile script, the sign-in
 * dialog, or a link to the sign-in page. The export aliases `(public)/_live` to stubs, so none of
 * these should ever reach it.
 */
const LIVE_ONLY = [
  { text: '/api/v1/', what: 'a call to the API' },
  { text: 'challenges.cloudflare.com', what: 'Turnstile' },
  { text: 'data-signin-dialog', what: 'the sign-in dialog' },
  { text: 'href="/sign-in', what: 'a link to sign-in' },
];

/** The files the scan reads: pages, scripts and the RSC payloads. */
const SCANNED = /\.(?:html|js|txt)$/;

/** Every file under `dir`, relative to it, with `/` separators, in a stable order. */
function filesIn(dir) {
  return readdirSync(dir, { recursive: true, withFileTypes: true })
    .filter((entry) => entry.isFile())
    .map((entry) => relative(dir, join(entry.parentPath, entry.name)).split(sep).join('/'))
    .sort();
}

/**
 * Problems with an export folder: missing files, portal or app-link routes, no landing page, or a
 * file that needs the live site.
 */
export function checkExport(dir) {
  const problems = REQUIRED.filter((file) => !existsSync(join(dir, file))).map(
    (file) => `missing ${file}`,
  );
  for (const portal of PORTAL_ROUTES) {
    if (existsSync(join(dir, portal))) problems.push(`portal route ${portal} must not be exported`);
  }
  for (const route of APP_LINK_ROUTES) {
    if (existsSync(join(dir, route))) problems.push(`app-link route ${route} must not be exported`);
  }
  if (
    existsSync(join(dir, 'CNAME')) &&
    readFileSync(join(dir, 'CNAME'), 'utf8').trim() !== 'quad-edu.com'
  ) {
    problems.push('CNAME must be quad-edu.com');
  }
  if (
    existsSync(join(dir, 'index.html')) &&
    !readFileSync(join(dir, 'index.html'), 'utf8').includes('data-site="public"')
  ) {
    problems.push('index.html is not the landing page');
  }
  if (
    existsSync(join(dir, 'sitemap.xml')) &&
    readFileSync(join(dir, 'sitemap.xml'), 'utf8').includes('/sign-in')
  ) {
    problems.push('sitemap.xml lists /sign-in');
  }
  for (const file of filesIn(dir).filter((name) => SCANNED.test(name))) {
    const content = readFileSync(join(dir, file), 'utf8');
    for (const { text, what } of LIVE_ONLY) {
      if (content.includes(text)) problems.push(`${file} contains ${text} (${what})`);
    }
  }
  return problems;
}

const isMain = process.argv[1] === fileURLToPath(import.meta.url);
if (isMain) {
  // The favicon is the staff app's own file (a metadata file must sit in app/, so it is copied).
  copyFileSync(join(app, 'src/app/icon.svg'), join(root, 'app/icon.svg'));
  const env = {
    ...process.env,
    NEXT_PUBLIC_QUAD_PRELAUNCH: process.env.NEXT_PUBLIC_QUAD_PRELAUNCH ?? 'true',
  };
  const build = spawnSync('pnpm', ['exec', 'next', 'build', 'site-export'], {
    cwd: app,
    env,
    stdio: 'inherit',
  });
  if (build.status !== 0) process.exit(build.status ?? 1);
  for (const file of readdirSync(join(root, 'pages-files')))
    cpSync(join(root, 'pages-files', file), join(out, file));
  const problems = checkExport(out);
  if (problems.length > 0) {
    console.error(`The static export is not ready:\n  ${problems.join('\n  ')}`);
    process.exit(1);
  }
  console.log(`Static export ready in ${out}`);
}
