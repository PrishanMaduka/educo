import noRawDbClient from './rules/no-raw-db-client.mjs';
import noWithPlatformOutsidePlatform from './rules/no-with-platform-outside-platform.mjs';

/** Quad's own ESLint rules, registered as the `quad` plugin. */
const quad = {
  meta: { name: 'quad' },
  rules: {
    'no-raw-db-client': noRawDbClient,
    'no-with-platform-outside-platform': noWithPlatformOutsidePlatform,
  },
};

export { quad };
export default quad;
