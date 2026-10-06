import { isInside, repoRelativePath } from './repo-path.mjs';

const ALLOWED_FOLDERS = ['packages/db/'];
const BANNED = [
  'pg',
  'pg-pool',
  'postgres',
  'drizzle-orm/node-postgres',
  'drizzle-orm/postgres-js',
];

function isBanned(source) {
  if (BANNED.some((name) => source === name || source.startsWith(`${name}/`))) return true;
  return source === '@quad/db/internal' || source.startsWith('@quad/db/src/');
}

const isTypeSpecifier = (s) => s.importKind === 'type' || s.exportKind === 'type';

/** @type {import('eslint').Rule.RuleModule} */
export default {
  meta: {
    type: 'problem',
    docs: { description: 'Ban the raw database client outside packages/db.' },
    schema: [],
    messages: {
      raw: 'Use withTenant() from @quad/db; the raw database client is only allowed inside packages/db.',
    },
  },
  create(context) {
    if (isInside(repoRelativePath(context.filename), ALLOWED_FOLDERS)) return {};

    const check = (node, source) => {
      if (typeof source === 'string' && isBanned(source)) {
        context.report({ node, messageId: 'raw' });
      }
    };
    // `import type` and `import { type X }` are erased at build time, so they are allowed.
    const checkDeclaration = (node) => {
      if (node.importKind === 'type' || node.exportKind === 'type') return;
      const specifiers = node.specifiers ?? [];
      if (specifiers.length > 0 && specifiers.every(isTypeSpecifier)) return;
      check(node, node.source?.value);
    };

    return {
      ImportDeclaration: checkDeclaration,
      ExportNamedDeclaration(node) {
        if (node.source) checkDeclaration(node);
      },
      ExportAllDeclaration: checkDeclaration,
      ImportExpression(node) {
        if (node.source.type === 'Literal') check(node, node.source.value);
      },
      CallExpression(node) {
        const [arg] = node.arguments;
        if (
          node.callee.type === 'Identifier' &&
          node.callee.name === 'require' &&
          arg?.type === 'Literal'
        ) {
          check(node, arg.value);
        }
      },
    };
  },
};
