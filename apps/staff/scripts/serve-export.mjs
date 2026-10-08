#!/usr/bin/env node
// Serves site-export/out the way GitHub Pages does (index.html for /, 404.html for anything
// missing), for the Playwright run against the export: `node scripts/serve-export.mjs [port]`.
import console from 'node:console';
import { createReadStream, existsSync, statSync } from 'node:fs';
import { createServer } from 'node:http';
import { extname, join, normalize, resolve } from 'node:path';
import process from 'node:process';
import { URL, fileURLToPath } from 'node:url';

const out = resolve(fileURLToPath(new URL('../site-export/out', import.meta.url)));
const port = Number(process.argv[2] ?? 3002);
const TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript',
  '.css': 'text/css',
  '.svg': 'image/svg+xml',
  '.woff2': 'font/woff2',
  '.txt': 'text/plain; charset=utf-8',
};

createServer((request, response) => {
  const path = decodeURIComponent(new URL(request.url ?? '/', 'http://localhost').pathname);
  let file = normalize(join(out, path));
  if (!file.startsWith(out)) file = join(out, '404.html');
  if (existsSync(file) && statSync(file).isDirectory()) file = join(file, 'index.html');
  const found = existsSync(file);
  const served = found ? file : join(out, '404.html');
  response.writeHead(found ? 200 : 404, {
    'content-type': TYPES[extname(served)] ?? 'application/octet-stream',
  });
  createReadStream(served).pipe(response);
}).listen(port, () => console.log(`Serving ${out} on http://localhost:${port}`));
