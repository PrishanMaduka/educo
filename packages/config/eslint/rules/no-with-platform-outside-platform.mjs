import { dynamicSource, isInside, isQuadDbSource, repoRelativePath } from './repo-path.mjs';

const ALLOWED_FOLDERS = [
  'apps/api/src/platform/',
  'apps/api/src/worker/platform-jobs/',
  'packages/db/',
];
const BANNED_NAMES = new Set(['withPlatform', 'createPlatformDb']);

const nameOf = (node) => (node.type === 'Identifier' ? node.name : String(node.value));

/** The property name of a member access, or null when it is computed and not a literal. */
function memberName(node) {
  const { property } = node;
  if (!node.computed) return property.type === 'Identifier' ? property.name : null;
  return property.type === 'Literal' ? String(property.value) : null;
}

/** @type {import('eslint').Rule.RuleModule} */
export default {
  meta: {
    type: 'problem',
    docs: {
      description: 'Ban withPlatform() and createPlatformDb() outside the platform folders.',
    },
    schema: [],
    messages: {
      platform:
        'withPlatform() bypasses row-level security and is only allowed in apps/api/src/platform/** and apps/api/src/worker/platform-jobs/**.',
    },
  },
  create(context) {
    if (isInside(repoRelativePath(context.filename), ALLOWED_FOLDERS)) return {};

    const report = (node) => context.report({ node, messageId: 'platform' });
    // Local names bound to a whole module (import * as x, const x = await import(...)).
    const namespaces = new Set();

    // Handles import('x') and require('x'), which cannot be followed past the first binding.
    const checkDynamic = (node) => {
      const source = dynamicSource(node);
      if (source === null) return;
      let wrapper = node;
      while (wrapper.parent?.type === 'AwaitExpression') wrapper = wrapper.parent;
      const declarator = wrapper.parent;
      const bound = declarator?.type === 'VariableDeclarator' && declarator.init === wrapper;
      if (bound && declarator.id.type === 'ObjectPattern') {
        let safe = true;
        for (const prop of declarator.id.properties) {
          if (prop.type === 'RestElement') safe = false;
          else if (!prop.computed || prop.key.type === 'Literal') {
            if (BANNED_NAMES.has(nameOf(prop.key))) report(prop);
          } else safe = false;
        }
        if (!safe && isQuadDbSource(source)) report(node);
        return;
      }
      if (bound && declarator.id.type === 'Identifier') {
        namespaces.add(declarator.id.name);
        return;
      }
      // Not bound to a name: for @quad/db we cannot follow the module object, so refuse it.
      if (isQuadDbSource(source)) report(node);
    };

    return {
      ImportDeclaration(node) {
        if (node.importKind === 'type') return;
        for (const spec of node.specifiers) {
          if (spec.type === 'ImportSpecifier') {
            if (spec.importKind !== 'type' && BANNED_NAMES.has(nameOf(spec.imported))) report(spec);
          } else if (spec.type === 'ImportNamespaceSpecifier') {
            namespaces.add(spec.local.name);
          }
        }
      },
      ExportNamedDeclaration(node) {
        if (node.exportKind === 'type' || !node.source) return;
        for (const spec of node.specifiers) {
          if (spec.exportKind !== 'type' && BANNED_NAMES.has(nameOf(spec.local))) report(spec);
        }
      },
      ExportAllDeclaration(node) {
        if (node.exportKind !== 'type' && isQuadDbSource(node.source.value)) report(node);
      },
      ImportExpression: checkDynamic,
      CallExpression: checkDynamic,
      MemberExpression(node) {
        if (node.object.type !== 'Identifier' || !namespaces.has(node.object.name)) return;
        const name = memberName(node);
        if (name !== null && BANNED_NAMES.has(name)) report(node);
      },
    };
  },
};
