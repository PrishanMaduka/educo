import createClient, { type Client, type ClientOptions } from 'openapi-fetch';

import type { paths } from './generated/schema';

export type ApiClient = Client<paths>;

/**
 * Creates the typed API client.
 *
 * `baseUrl` is the origin only (for example `http://localhost:3000`). Every path in the
 * generated schema already starts with `/api/v1`, so do not add the prefix here.
 */
export function createApiClient(
  baseUrl: string,
  options: Omit<ClientOptions, 'baseUrl'> = {},
): ApiClient {
  return createClient<paths>({ ...options, baseUrl });
}
