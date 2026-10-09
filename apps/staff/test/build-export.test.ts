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

/**
 * Every module a source file loads: static `import … from`, bare `import '…'`, `export … from`
 * and dynamic `import('…')`, so a lazy import cannot slip sign-in code into the export.
 */
function importSourcesOf(source: string): string[] {
  const patterns = [
    /^\s*(?:import|export)\b[^'"`;]*?\bfrom\s*['"]([^'"]+)['"]/gm,
    /^\s*import\s*['"]([^'"]+)['"]/gm,
    /\bimport\s*\(\s*['"`]([^'"`]+)['"`]\s*\)/g,
  ];
  return patterns.flatMap((pattern) => [...source.matchAll(pattern)].map((m) => m[1] ?? ''));
}

describe('importSourcesOf', () => {
  it('finds static, bare, re-exported and dynamic imports', () => {
    const source = [
      "import type { Metadata } from 'next';",
      "import './globals.css';",
      "export { x } from '@/lib/x';",
      "const Flow = lazy(() => import('@/app/(auth)/flow'));",
      'const api = await import(`@/lib/api`);',
    ].join('\n');
    expect(importSourcesOf(source).sort()).toEqual(
      ['./globals.css', '@/app/(auth)/flow', '@/lib/api', '@/lib/x', 'next'].sort(),
    );
  });
});

describe('the root layout the export re-exports', () => {
  const layout = readFileSync(join(app, 'src/app/layout.tsx'), 'utf8');
  const imports = importSourcesOf(layout);

  it('imports nothing from sign-in, the session or the API client', () => {
    expect(imports.length).toBeGreaterThan(0);
    for (const source of imports) {
      expect(source).not.toMatch(
        /\(auth\)|@\/lib\/(?:session|api|server-session)|@\/components\/shell|@quad\/client|react-query/,
      );
    }
  });

  it('is what the export re-exports', () => {
    expect(readFileSync(join(app, 'site-export/app/layout.tsx'), 'utf8')).toContain(
      'src/app/layout',
    );
  });
});
