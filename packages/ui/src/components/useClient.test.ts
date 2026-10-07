import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

const dir = __dirname;
const files = readdirSync(dir).filter((f) => f.endsWith('.tsx') && !f.endsWith('.test.tsx'));
const source = new Map(files.map((f) => [f, readFileSync(join(dir, f), 'utf8')]));

const hookImport =
  /import\s+(?!type\b)\{[^}]*\b(use[A-Z]\w*|createContext)\b[^}]*\}\s+from\s+'react'/;
const radixImport = /from\s+'@radix-ui\//;

/** A component needs 'use client' when it uses hooks or Radix, or renders another component that does (it may pass functions to it). */
function needsClient(file: string, seen = new Set<string>()): boolean {
  if (seen.has(file)) return false;
  seen.add(file);
  const text = source.get(file) ?? '';
  if (hookImport.test(text) || radixImport.test(text)) return true;
  return [...text.matchAll(/from\s+'\.\/(\w+)'/g)].some((m) => {
    const dep = `${m[1]}.tsx`;
    return source.has(dep) && needsClient(dep, seen);
  });
}

describe('use client boundaries', () => {
  for (const file of files) {
    it(`${file} ${needsClient(file) ? 'starts with use client' : 'stays server-safe'}`, () => {
      const first = (source.get(file) ?? '').split('\n')[0]?.trim();
      if (needsClient(file)) expect(first).toBe("'use client';");
      else expect(first).not.toBe("'use client';");
    });
  }
});
