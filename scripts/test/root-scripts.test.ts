import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

const repo = (rel: string) => fileURLToPath(new URL(`../../${rel}`, import.meta.url));
const readJson = (rel: string) =>
  JSON.parse(readFileSync(repo(rel), 'utf8')) as { name: string; scripts?: Record<string, string> };

const workspaces = ['apps', 'packages']
  .flatMap((root) => readdirSync(repo(root)).map((dir) => `${root}/${dir}/package.json`))
  .filter((rel) => existsSync(repo(rel)))
  .map(readJson);

const delegated = Object.entries(readJson('package.json').scripts ?? {}).flatMap(([name, command]) => {
  const match = /^pnpm --filter (\S+) (\S+)$/.exec(command);
  return match ? [{ name, pkg: match[1]!, script: match[2]! }] : [];
});

describe('root package scripts', () => {
  it('delegates to at least one workspace script', () => {
    expect(delegated.length).toBeGreaterThan(0);
  });

  it.each(delegated)('$name calls $pkg $script, which exists', ({ pkg, script }) => {
    const target = workspaces.find((w) => w.name === pkg);
    expect(target, `${pkg} is not a known workspace`).toBeDefined();
    expect(Object.keys(target?.scripts ?? {})).toContain(script);
  });
});
