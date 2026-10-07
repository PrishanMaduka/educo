import strings from '@quad/contracts/i18n/design.en.json';

import { i18n } from '@/i18n';

/*
 * The style guide's strings are a separate catalogue (packages/contracts/i18n/design.en.json), so they stay
 * out of en.json and the parent app's ARB. Importing this module adds them to the shared i18next instance
 * as the `design` namespace, on the server and in the browser.
 */
export const DESIGN_NS = 'design';

if (!i18n.hasResourceBundle('en', DESIGN_NS)) i18n.addResourceBundle('en', DESIGN_NS, strings);
