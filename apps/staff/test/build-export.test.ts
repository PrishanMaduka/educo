// The pre-launch guard (D30, D31, D32): the GitHub Pages export publishes the public site only.
// `checkExport` refuses an out folder holding any portal or sign-in route, and the root layout
// (which the export re-exports) pulls in nothing from sign-in, the session or the API client.
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { REQUIRED, checkExport } from '../scripts/build-export.mjs';

const app = join(dirname(fileURLToPath(import.meta.url)), '..');

describe('checkExport', () => {
  let dir = '';

  /** An out folder with every required file, and the landing page as index.html. */
  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), 'quad-export-'));
    for (const file of REQUIRED) {
      const path = join(dir, file);
      mkdirSync(dirname(path), { recursive: true });
      if (file === '_next/static') mkdirSync(path, { recursive: true });
      else writeFileSync(path, file === 'CNAME' ? 'quad-edu.com\n' : '');
    }
    writeFileSync(join(dir, 'index.html'), '<html data-site="public"></html>');
  });

  afterEach(() => {
    rmSync(dir, { recursive: true, force: true });
  });

  it('accepts the public site alone', () => {
    expect(checkExport(dir)).toEqual([]);
  });

  it('refuses a sign-in page in any form', () => {
    writeFileSync(join(dir, 'sign-in.html'), '');
    writeFileSync(join(dir, 'sign-in'), '');
    expect(checkExport(dir)).toEqual([
      'portal route sign-in must not be exported',
      'portal route sign-in.html must not be exported',
    ]);
  });

  it('refuses a sign-in folder, such as the signed-link pages', () => {
    mkdirSync(join(dir, 'sign-in/reset'), { recursive: true });
    expect(checkExport(dir)).toEqual(['portal route sign-in must not be exported']);
  });

  it('still refuses the portal itself', () => {
    mkdirSync(join(dir, 'app'));
    writeFileSync(join(dir, 'app.html'), '');
    expect(checkExport(dir)).toEqual([
      'portal route app must not be exported',
      'portal route app.html must not be exported',
    ]);
  });
});

describe('the root layout the export re-exports', () => {
  const layout = readFileSync(join(app, 'src/app/layout.tsx'), 'utf8');
  const imports = [...layout.matchAll(/^import[^'"]*['"]([^'"]+)['"]/gm)].map((m) => m[1]);

  it('imports nothing from sign-in, the session or the API client', () => {
    expect(imports.length).toBeGreaterThan(0);
    for (const source of imports) {
      expect(source).not.toMatch(/\(auth\)|@\/lib\/session|@\/lib\/api|@quad\/client|react-query/);
    }
  });

  it('is what the export re-exports', () => {
    expect(readFileSync(join(app, 'site-export/app/layout.tsx'), 'utf8')).toContain(
      'src/app/layout',
    );
  });
});
