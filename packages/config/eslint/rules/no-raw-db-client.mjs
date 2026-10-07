import { dynamicSource, isInside, isPackageOrSubpath, repoRelativePath } from './repo-path.mjs';

const ALLOWED_FOLDERS = ['packages/db/'];
// The api image's one-off commands (migrate, seed, db-bootstrap) may use the deploy-time tools.
const ADMIN_FOLDERS = ['apps/api/src/cli/'];
const ADMIN_ENTRY = '@quad/db/admin';
// The API's integration tests may create their own migrated database (raw pools for every role).
const TESTING_FOLDERS = ['apps/api/test/'];
const TESTING_ENTRY = '@quad/db/testing';
const BANNED = [
  'pg',
  'pg-pool',
  'postgres',
  'drizzle-orm/node-postgres',
  'drizzle-orm/postgres-js',
];

/** The message id to report for `source`, or null when it is allowed. */
function violation(source, inAdminFolder, inTestingFolder) {
  if (BANNED.some((name) => isPackageOrSubpath(source, name))) return 'raw';
  if (isPackageOrSubpath(source, ADMIN_ENTRY)) return inAdminFolder ? null : 'admin';
  if (isPackageOrSubpath(source, TESTING_ENTRY)) return inTestingFolder ? null : 'testing';
  return source === '@quad/db/internal' || source.startsWith('@quad/db/src/') ? 'raw' : null;
}

const isTypeSpecifier = (s) => s.importKind === 'type' || s.exportKind === 'type';

/** @type {import('eslint').Rule.RuleModule} */
export default {
  meta: {
    type: 'problem',
    docs: {
      description:
        'Ban the raw database client outside packages/db, @quad/db/admin outside apps/api/src/cli, and @quad/db/testing outside apps/api/test.',
    },
    schema: [],
    messages: {
      raw: 'Use withTenant() from @quad/db; the raw database client is only allowed inside packages/db.',
      admin:
        "@quad/db/admin (bootstrap, migrations, seed) is only for the api image's commands in apps/api/src/cli.",
      testing:
        '@quad/db/testing (fresh test databases with raw pools) is only for the API tests in apps/api/test.',
    },
  },
  create(context) {
    const relPath = repoRelativePath(context.filename);
    if (isInside(relPath, ALLOWED_FOLDERS)) return {};
    const inAdminFolder = isInside(relPath, ADMIN_FOLDERS);
    const inTestingFolder = isInside(relPath, TESTING_FOLDERS);

    const check = (node, source) => {
      const messageId =
        typeof source === 'string' ? violation(source, inAdminFolder, inTestingFolder) : null;
      if (messageId !== null) {
        context.report({ node, messageId });
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
        check(node, dynamicSource(node));
      },
      CallExpression(node) {
        check(node, dynamicSource(node));
      },
      // import x = require('pg')
      TSImportEqualsDeclaration(node) {
        if (node.importKind === 'type') return;
        const ref = node.moduleReference;
        if (ref.type === 'TSExternalModuleReference' && ref.expression.type === 'Literal') {
          check(node, ref.expression.value);
        }
      },
    };
  },
};
