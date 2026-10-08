import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { describe, expect, it } from 'vitest';

const root = resolve(__dirname, '../..');

describe('.env.example', () => {
  it('lists every variable named in spec 02, in the same order', () => {
    const spec = readFileSync(resolve(root, 'docs/spec/02-architecture.md'), 'utf8');
    const section = spec.split(/^### Environment variables\s*$/m)[1]?.split(/^#{1,3} /m)[0] ?? '';
    const rows = section.split('\n').filter((l) => l.startsWith('|') && !/^\|\s*(Area|-)/.test(l));
    const names = rows.flatMap((row) => {
      const variables = row.split('|')[2] ?? '';
      return [...variables.matchAll(/`([A-Z][A-Z0-9]*_[A-Z0-9_]+)`/g)].map((m) => m[1] as string);
    });
    expect(names.length).toBeGreaterThan(50);

    const env = readFileSync(resolve(root, '.env.example'), 'utf8');
    const keys = env
      .split('\n')
      .map((l) => /^([A-Z][A-Z0-9_]*)=/.exec(l)?.[1])
      .filter((k): k is string => Boolean(k));
    expect(names.filter((n) => !keys.includes(n))).toEqual([]);
    expect(keys).toEqual(names);
  });
});
