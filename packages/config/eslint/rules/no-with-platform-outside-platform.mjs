import path from 'node:path';

import { dynamicSource, isInside, isQuadDbSource, repoRelativePath } from './repo-path.mjs';

const ALLOWED_FOLDERS = [
  'apps/api/src/platform/',
  'apps/api/src/worker/platform-jobs/',
  'packages/db/',
];
const BANNED_NAMES = new Set(['withPlatform', 'createPlatformDb']);
/**
 * The API's `quad_platform` handle: the `PLATFORM_DB` token and the module that provides it.
 * Holding either is holding `withPlatform`, so they are refused outside the platform folders
 * too; the API's own tests may reach them to arrange and check platform rows.
 */
const HANDLE_NAMES = new Set(['PLATFORM_DB', 'PlatformCoreModule']);
const HANDLE_FILES = new Set([
  'apps/api/src/platform/tokens',
  'apps/api/src/platform/platform-core.module',
]);
const HANDLE_ALLOWED_FOLDERS = [...ALLOWED_FOLDERS, 'apps/api/test/'];

const nameOf = (node) => (node.type === 'Identifier' ? node.name : String(node.value));

/** The property name of a member access, or null when it is computed and not a literal. */
function memberName(node) {
  const { property } = node;
  if (!node.computed) return property.type === 'Identifier' ? property.name : null;
  return property.type === 'Literal' ? String(property.value) : null;
}

/** True when a relative import from `filename` names one of the handle's files. */
function isHandleFile(filename, source) {
  if (typeof source !== 'string' || !source.startsWith('.')) return false;
  const target = repoRelativePath(path.resolve(path.dirname(filename), source));
  return HANDLE_FILES.has(target.replace(/\.(?:[cm]?[jt]s)$/, ''));
}

/** @type {import('eslint').Rule.RuleModule} */
export default {
  meta: {
    type: 'problem',
    docs: {
      description:
        'Ban withPlatform(), createPlatformDb() and the PLATFORM_DB handle outside the platform folders.',
    },
    schema: [],
    messages: {
      platform:
        'withPlatform() bypasses row-level security and is only allowed in apps/api/src/platform/** and apps/api/src/worker/platform-jobs/**.',
      handle:
        'PLATFORM_DB and PlatformCoreModule hold withPlatform(); only apps/api/src/platform/**, apps/api/src/worker/platform-jobs/** and the API tests may import them.',
    },
  },
  create(context) {
    const relPath = repoRelativePath(context.filename);
    if (isInside(relPath, ALLOWED_FOLDERS)) return {};
    const checkHandle = !isInside(relPath, HANDLE_ALLOWED_FOLDERS);

    const report = (node) => context.report({ node, messageId: 'platform' });
    const reportHandle = (node) => {
      if (checkHandle) context.report({ node, messageId: 'handle' });
    };
    const checkHandleSource = (node, source) => {
      if (isHandleFile(context.filename, source)) reportHandle(node);
    };
    /** `x.withPlatform(...)` on any object (a handle reached through injection), not only `@quad/db`. */
    const checkMemberCall = (node) => {
      if (!checkHandle) return;
      const callee = node.callee.type === 'ChainExpression' ? node.callee.expression : node.callee;
      if (callee.type !== 'MemberExpression' || memberName(callee) !== 'withPlatform') return;
      // A namespace import of @quad/db is reported by MemberExpression below.
      if (callee.object.type === 'Identifier' && namespaces.has(callee.object.name)) return;
      report(callee);
    };
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
        checkHandleSource(node, node.source.value);
        for (const spec of node.specifiers) {
          if (spec.type === 'ImportSpecifier') {
            if (spec.importKind !== 'type' && BANNED_NAMES.has(nameOf(spec.imported))) report(spec);
            if (spec.importKind !== 'type' && HANDLE_NAMES.has(nameOf(spec.imported))) {
              reportHandle(spec);
            }
          } else if (spec.type === 'ImportNamespaceSpecifier') {
            namespaces.add(spec.local.name);
          }
        }
      },
      ExportNamedDeclaration(node) {
        if (node.exportKind === 'type' || !node.source) return;
        checkHandleSource(node, node.source.value);
        for (const spec of node.specifiers) {
          if (spec.exportKind !== 'type' && BANNED_NAMES.has(nameOf(spec.local))) report(spec);
          if (spec.exportKind !== 'type' && HANDLE_NAMES.has(nameOf(spec.local)))
            reportHandle(spec);
        }
      },
      ExportAllDeclaration(node) {
        if (node.exportKind !== 'type' && isQuadDbSource(node.source.value)) report(node);
        if (node.exportKind !== 'type') checkHandleSource(node, node.source.value);
      },
      ImportExpression(node) {
        checkDynamic(node);
        checkHandleSource(node, dynamicSource(node));
      },
      CallExpression(node) {
        checkDynamic(node);
        checkHandleSource(node, dynamicSource(node));
        checkMemberCall(node);
      },
      MemberExpression(node) {
        if (node.object.type !== 'Identifier' || !namespaces.has(node.object.name)) return;
        const name = memberName(node);
        if (name !== null && BANNED_NAMES.has(name)) report(node);
      },
    };
  },
};
