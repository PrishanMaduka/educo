#!/usr/bin/env node
// Builds the pre-launch public site as static files for GitHub Pages (decision log, 2026-10-08):
// `next build site-export` (output: 'export'), then the files GitHub Pages needs, then a check that
// the result holds the public site and nothing else. Output: apps/staff/site-export/out.
import { spawnSync } from 'node:child_process';
import console from 'node:console';
import { copyFileSync, cpSync, existsSync, readFileSync, readdirSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

const app = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const root = join(app, 'site-export');
const out = join(root, 'out');

/** Files the published site must have. */
export const REQUIRED = [
  'index.html',
  '404.html',
  'CNAME',
  'robots.txt',
  'icon.svg',
  '_next/static',
];

/** Problems with an export folder: missing files, portal routes, or no landing page. */
export function checkExport(dir) {
  const problems = REQUIRED.filter((file) => !existsSync(join(dir, file))).map(
    (file) => `missing ${file}`,
  );
  for (const portal of ['app', 'app.html', 'design', 'design.html', 'healthz']) {
    if (existsSync(join(dir, portal))) problems.push(`portal route ${portal} must not be exported`);
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
