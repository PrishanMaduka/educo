// The pre-launch guard (D30, D31, D32, D57): the GitHub Pages export publishes the public site only.
// `checkExport` refuses an out folder holding any portal, sign-in or app-link route, or any file
// that would call the API, load Turnstile or open the sign-in dialog. The root layout (which the
// export re-exports) pulls in nothing from sign-in, the session or the API client, and the public
// pages reach the API only through `(public)/_live`, which the export swaps for stubs.
import { mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
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

  /** Writes `content` to `file` inside the out folder, making its folders. */
  const put = (file: string, content: string) => {
    mkdirSync(dirname(join(dir, file)), { recursive: true });
    writeFileSync(join(dir, file), content);
  };

  it('refuses a chunk that calls the API', () => {
    put('_next/static/chunks/app/page-1.js', 'fetch("/api/v1/public/demo-requests",{})');
    expect(checkExport(dir)).toEqual([
      '_next/static/chunks/app/page-1.js contains /api/v1/ (a call to the API)',
    ]);
  });

  it('refuses a page that loads Turnstile', () => {
    put('about.html', '<script src="https://challenges.cloudflare.com/turnstile/v0/api.js">');
    expect(checkExport(dir)).toEqual(['about.html contains challenges.cloudflare.com (Turnstile)']);
  });

  it('refuses the sign-in dialog and sign-in links, in pages and in RSC payloads', () => {
    put('index.html', '<html data-site="public"><dialog data-signin-dialog></dialog></html>');
    put('legal/terms.txt', '1:["$","a",null,{"href":"/sign-in"}]\n<a href="/sign-in">');
    expect(checkExport(dir)).toEqual([
      'index.html contains data-signin-dialog (the sign-in dialog)',
      'legal/terms.txt contains href="/sign-in (a link to sign-in)',
      'legal/terms.txt contains "href":"/sign-in (a link to sign-in in an RSC payload)',
    ]);
  });

  it('refuses a sign-in link in a bundled script', () => {
    put('_next/static/chunks/app/page-2.js', 'jsx("a",{href:"/sign-in?next=%2Fapp",children:t})');
    expect(checkExport(dir)).toEqual([
      '_next/static/chunks/app/page-2.js contains href:"/sign-in (a link to sign-in in a script)',
    ]);
  });

  it('only scans pages, scripts and payloads', () => {
    put('_next/static/media/notes.css', '/* /api/v1/ */');
    put('_next/static/chunks/page.js.map', '/api/v1/');
    expect(checkExport(dir)).toEqual([]);
  });

  it('refuses the /p/* app-link pages and the .well-known files', () => {
    put('p/index.html', '<html></html>');
    put('.well-known/assetlinks.json', '[]');
    expect(checkExport(dir)).toEqual([
      'app-link route p must not be exported',
      'app-link route .well-known must not be exported',
    ]);
  });

  it('refuses a sitemap that lists sign-in', () => {
    put('sitemap.xml', '<urlset><url><loc>https://quad-edu.com/sign-in</loc></url></urlset>');
    expect(checkExport(dir)).toEqual(['sitemap.xml lists /sign-in']);
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

/** Every .ts and .tsx file under `dir`, relative to it. */
function sourceFiles(dir: string): string[] {
  return readdirSync(dir, { recursive: true, encoding: 'utf8' }).filter((file) =>
    /\.tsx?$/.test(file),
  );
}

describe('the public pages outside (public)/_live', () => {
  const publicDir = join(app, 'src/app/(public)');
  const outside = sourceFiles(publicDir).filter((file) => !file.startsWith('_live/'));

  it('load nothing that needs the API, even lazily (D57)', () => {
    expect(outside.length).toBeGreaterThan(0);
    for (const file of outside) {
      for (const source of importSourcesOf(readFileSync(join(publicDir, file), 'utf8'))) {
        expect(source, file).not.toMatch(
          /^@quad\/client(?:\/|$)|^@tanstack\/react-query(?:\/|$)|^@\/lib\/api(?:\/|$)|(?:^|\/)\(auth\)(?:\/|$)/,
        );
      }
    }
  });

  it('reach _live only through its index, which the export swaps for stubs', () => {
    for (const file of outside) {
      for (const source of importSourcesOf(readFileSync(join(publicDir, file), 'utf8'))) {
        expect(source, file).not.toMatch(/(?:^|\/)_live\/./);
      }
    }
  });
});

describe('the pre-launch stubs', () => {
  it('stand in for every export of (public)/_live', async () => {
    const live = await import('../src/app/(public)/_live');
    const stubs = await import('../site-export/prelaunch');
    expect(Object.keys(stubs).sort()).toEqual(Object.keys(live).sort());
  });

  it('show nothing, and refuse to send a demo request or load Turnstile', async () => {
    const stubs = await import('../site-export/prelaunch');
    expect(stubs.LiveSignIn({ label: 'Sign in' })).toBeNull();
    expect(stubs.SignedInHint()).toBeNull();
    expect(() => stubs.TurnstileField()).toThrow(/pre-launch/);
    expect(() => stubs.submitDemoRequest()).toThrow(/pre-launch/);
  });

  it('are what the export build aliases (public)/_live to', () => {
    const config = readFileSync(join(app, 'site-export/next.config.ts'), 'utf8');
    expect(config).toContain("'src/app/(public)/_live'");
    expect(config).toContain("'prelaunch'");
  });
});
