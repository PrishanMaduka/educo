import type { ApiClient } from './fetcher';

/** Throws the API error body (or a generic error) so TanStack Query surfaces it. */
function unwrap<T>(result: { data?: T; error?: unknown }): T {
  if (result.data === undefined) {
    throw result.error instanceof Error ? result.error : new Error('The request failed.');
  }
  return result.data;
}

/**
 * TanStack Query option builders. Spread the result into `useQuery` / `queryClient.fetchQuery`.
 * Add one builder per read endpoint as the API grows.
 */
export const apiQueryOptions = {
  healthLive: (client: ApiClient) => ({
    queryKey: ['health', 'live'] as const,
    queryFn: async () => unwrap(await client.GET('/api/v1/health/live')),
  }),
};
