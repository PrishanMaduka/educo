/**
 * The staff portal's strings: the shared en.json instance from @quad/ui (server `t`). Client
 * components read them through `@/i18n/client`. Kept apart so that a server component importing
 * `t` does not add the browser's i18n code to its page (the public pages load none).
 */
export { i18n, SLOT_MARKER, splitAround, t, type MessageKey } from '@quad/ui/i18n';
