import { isInside, repoRelativePath } from './repo-path.mjs';

/**
 * `withOpen` runs a transaction with neither `app.tenant_id` nor `app.account_id` (D32), for the
 * open table `otp_challenges` only. Only the parent sign-in code (`apps/api/src/modules/auth/otp`)
 * and `packages/db` itself may reach it, the same way `PLATFORM_DB` is fenced (Task 9 fix round 1).
 */
const ALLOWED_FOLDERS = ['apps/api/src/modules/auth/otp/', 'packages/db/'];
const BANNED_NAMES = new Set(['withOpen', 'createOpenRunner', 'OpenTx', 'OpenRunner']);

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
      description:
        'Ban withOpen() and its types outside the parent sign-in code (otp) and packages/db.',
    },
    schema: [],
    messages: {
      open: 'withOpen() runs with no school and no account; only apps/api/src/modules/auth/otp/** may use it (the open otp_challenges table).',
    },
  },
  create(context) {
    if (isInside(repoRelativePath(context.filename), ALLOWED_FOLDERS)) return {};
    const report = (node) => context.report({ node, messageId: 'open' });
    return {
      ImportSpecifier(node) {
        if (BANNED_NAMES.has(nameOf(node.imported))) report(node);
      },
      ExportSpecifier(node) {
        if (BANNED_NAMES.has(nameOf(node.local))) report(node);
      },
      MemberExpression(node) {
        if (memberName(node) === 'withOpen') report(node);
      },
      Property(node) {
        if (node.parent.type !== 'ObjectPattern' || node.computed) return;
        if (nameOf(node.key) === 'withOpen') report(node);
      },
    };
  },
};
