/** Every route is served under this prefix (spec 02, D15). */
export const API_PREFIX = '/api/v1';

/** `API_PREFIX` as a regex source. */
export const API_PREFIX_PATTERN = API_PREFIX.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
