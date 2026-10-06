import { isInside, repoRelativePath } from './repo-path.mjs';

const ALLOWED_FOLDERS = [
  'apps/api/src/platform/',
  'apps/api/src/worker/platform-jobs/',
  'packages/db/',
];

const isDbSource = (value) =>
  typeof value === 'string' && (value === '@quad/db' || value.startsWith('@quad/db/'));
const nameOf = (node) => (node.type === 'Identifier' ? node.name : String(node.value));

/** @type {import('eslint').Rule.RuleModule} */
export default {
  meta: {
    type: 'problem',
    docs: { description: 'Ban withPlatform() outside the platform folders.' },
    schema: [],
    messages: {
      platform:
        'withPlatform() bypasses row-level security and is only allowed in apps/api/src/platform/** and apps/api/src/worker/platform-jobs/**.',
    },
  },
  create(context) {
    if (isInside(repoRelativePath(context.filename), ALLOWED_FOLDERS)) return {};

    const report = (node) => context.report({ node, messageId: 'platform' });
    const namespaces = new Set();

    return {
      ImportDeclaration(node) {
        if (node.importKind === 'type' || !isDbSource(node.source.value)) return;
        for (const spec of node.specifiers) {
          if (spec.type === 'ImportSpecifier') {
            if (spec.importKind !== 'type' && nameOf(spec.imported) === 'withPlatform')
              report(spec);
          } else if (spec.type === 'ImportNamespaceSpecifier') {
            namespaces.add(spec.local.name);
          }
        }
      },
      ExportNamedDeclaration(node) {
        if (node.exportKind === 'type' || !node.source || !isDbSource(node.source.value)) return;
        for (const spec of node.specifiers) {
          if (spec.exportKind !== 'type' && nameOf(spec.local) === 'withPlatform') report(spec);
        }
      },
      MemberExpression(node) {
        if (node.object.type !== 'Identifier' || !namespaces.has(node.object.name)) return;
        const { property } = node;
        const name = node.computed
          ? property.type === 'Literal'
            ? String(property.value)
            : null
          : property.type === 'Identifier'
            ? property.name
            : null;
        if (name === 'withPlatform') report(node);
      },
    };
  },
};
