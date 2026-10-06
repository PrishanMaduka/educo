import { existsSync } from 'node:fs';
import path from 'node:path';

const rootCache = new Map();

/** Walk up from `dir` to the directory holding pnpm-workspace.yaml (cached per directory). */
function findRepoRoot(dir) {
  const cached = rootCache.get(dir);
  if (cached !== undefined) return cached;
  let current = dir;
  let found = null;
  for (;;) {
    if (existsSync(path.join(current, 'pnpm-workspace.yaml'))) {
      found = current;
      break;
    }
    const parent = path.dirname(current);
    if (parent === current) break;
    current = parent;
  }
  rootCache.set(dir, found);
  return found;
}

/** The linted file's path relative to the repo root, with POSIX separators. */
export function repoRelativePath(filename) {
  const absolute = path.resolve(filename);
  const root = findRepoRoot(path.dirname(absolute));
  const relative = root === null ? absolute : path.relative(root, absolute);
  return relative.split(path.sep).join('/');
}

/** True when `relPath` is inside one of the POSIX folder prefixes (each ending in '/'). */
export function isInside(relPath, folders) {
  return folders.some((folder) => relPath.startsWith(folder));
}
