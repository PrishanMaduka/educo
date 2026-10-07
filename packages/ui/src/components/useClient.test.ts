import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

const dir = __dirname;
const files = readdirSync(dir).filter((f) => f.endsWith('.tsx') && !f.endsWith('.test.tsx'));
const source = new Map(files.map((f) => [f, readFileSync(join(dir, f), 'utf8')]));

// `import { useState } from 'react'`, also after a default import (`import React, { useId }`).
const hookImport =
  /import\s+(?!type\b)(?:\w+\s*,\s*)?\{[^}]*\b(use[A-Z]\w*|createContext)\b[^}]*\}\s+from\s+'react'/;
// `React.useState(...)`, `React.useEffect(...)`, `React.createContext(...)` through the namespace.
const namespaceHook = /\bReact\.(use[A-Z]\w*|createContext)\b/;
const radixImport = /from\s+'@radix-ui\//;

const usesClientApi = (text: string): boolean =>
  hookImport.test(text) || namespaceHook.test(text) || radixImport.test(text);

/** A component needs 'use client' when it uses hooks or Radix, or renders another component that does (it may pass functions to it). */
function needsClient(file: string, seen = new Set<string>()): boolean {
  if (seen.has(file)) return false;
  seen.add(file);
  const text = source.get(file) ?? '';
  if (usesClientApi(text)) return true;
  return [...text.matchAll(/from\s+'\.\/(\w+)'/g)].some((m) => {
    const dep = `${m[1]}.tsx`;
    return source.has(dep) && needsClient(dep, seen);
  });
}

describe('client API detection', () => {
  it.each([
    "import { useState } from 'react';",
    "import React, { useId } from 'react';",
    "import { createContext } from 'react';",
    'const [open, setOpen] = React.useState(false);',
    'React.useEffect(() => {}, []);',
    'const Ctx = React.createContext(null);',
    "import * as Dialog from '@radix-ui/react-dialog';",
  ])('needs use client for %s', (text) => {
    expect(usesClientApi(text)).toBe(true);
  });

  it.each([
    "import type { ReactNode } from 'react';",
    "import { forwardRef } from 'react';",
    'const user = useless;',
    'type P = React.ComponentProps<"div">;',
  ])('stays server-safe for %s', (text) => {
    expect(usesClientApi(text)).toBe(false);
  });
});

describe('use client boundaries', () => {
  it('finds component files to check', () => {
    expect(files.length).toBeGreaterThan(0);
  });

  for (const file of files) {
    it(`${file} ${needsClient(file) ? 'starts with use client' : 'stays server-safe'}`, () => {
      const first = (source.get(file) ?? '').split('\n')[0]?.trim();
      if (needsClient(file)) expect(first).toBe("'use client';");
      else expect(first).not.toBe("'use client';");
    });
  }
});
