import path from 'node:path';

import { dynamicSource, isInside, repoRelativePath } from './repo-path.mjs';

const CLI_FOLDER = 'apps/api/src/cli/';
// The commands themselves, and their unit tests, may import the CLI modules.
const ALLOWED_FOLDERS = [CLI_FOLDER, 'apps/api/test/'];

/** True when `source`, imported from `relPath`, points into apps/api/src/cli. */
function pointsIntoCli(source, relPath) {
  if (source.startsWith('@quad/api/src/cli/')) return true;
  if (!source.startsWith('.')) return false;
  const target = path.posix.normalize(path.posix.join(path.posix.dirname(relPath), source));
  return target.startsWith(CLI_FOLDER) || `${target}/` === CLI_FOLDER;
}

/** @type {import('eslint').Rule.RuleModule} */
export default {
  meta: {
    type: 'problem',
    docs: {
      description:
        'Ban imports of apps/api/src/cli outside it: the commands use @quad/db/admin and exit the process.',
    },
    schema: [],
    messages: {
      cli: "apps/api/src/cli holds the api image's one-off commands (they use @quad/db/admin and exit the process); import them only from apps/api/src/cli and its tests.",
    },
  },
  create(context) {
    const relPath = repoRelativePath(context.filename);
    if (isInside(relPath, ALLOWED_FOLDERS)) return {};

    const check = (node, source) => {
      if (typeof source === 'string' && pointsIntoCli(source, relPath)) {
        context.report({ node, messageId: 'cli' });
      }
    };
    const checkDeclaration = (node) => check(node, node.source?.value);

    return {
      ImportDeclaration: checkDeclaration,
      ExportNamedDeclaration(node) {
        if (node.source) checkDeclaration(node);
      },
      ExportAllDeclaration: checkDeclaration,
      ImportExpression(node) {
        check(node, dynamicSource(node));
      },
      CallExpression(node) {
        check(node, dynamicSource(node));
      },
    };
  },
};
