import { OpenAPIRegistry, extendZodWithOpenApi } from '@asteasolutions/zod-to-openapi';
import { ErrorBodySchema } from '@quad/contracts';
import { z } from 'zod';

import type { RouteConfig } from '@asteasolutions/zod-to-openapi';

// Adds `.openapi()` to every Zod schema, including the ones packages/contracts already built.
extendZodWithOpenApi(z);

/** Every route is served under this prefix (spec 02, D15). */
export const API_PREFIX = '/api/v1';

type Method = 'get' | 'post' | 'put' | 'patch' | 'delete';

/**
 * One route's documentation. Each area keeps its routes next to its controller
 * (`<area>.routes.ts`) and adds them to `API_ROUTES` in `document.ts`; the schemas are the same
 * contract schemas the controller parses with, so the document cannot drift from validation.
 */
export interface ApiRoute {
  readonly method: Method;
  /** Relative to `/api/v1`, with OpenAPI-style params: `/invoices/{id}/remind`. */
  readonly path: string;
  readonly summary: string;
  readonly tags: readonly string[];
  readonly request?: {
    readonly params?: z.AnyZodObject;
    readonly query?: z.AnyZodObject;
    readonly body?: z.ZodTypeAny;
  };
  /** Success (and expected non-error) responses by status; omit `schema` for an empty body. */
  readonly responses: Readonly<Record<number, { description: string; schema?: z.ZodTypeAny }>>;
  /** Error statuses this route can return; each is documented with the `ErrorBody` schema. */
  readonly errors?: readonly number[];
  /** A body limit in bytes for this route, replacing Fastify's 1 MB default (`createApp`). */
  readonly bodyLimit?: number;
}

/**
 * The body limits routes declare, keyed by `METHOD /api/v1/path` with Fastify-style params, for
 * the `onRoute` hook in `createApp`.
 */
export function routeBodyLimits(routes: readonly ApiRoute[]): ReadonlyMap<string, number> {
  const limits = new Map<string, number>();
  for (const route of routes) {
    if (route.bodyLimit !== undefined) {
      const path = route.path.replace(/\{(\w+)\}/g, ':$1');
      limits.set(`${route.method.toUpperCase()} ${API_PREFIX}${path}`, route.bodyLimit);
    }
  }
  return limits;
}

/** Names a schema so it becomes a reusable `components.schemas` entry. */
export function named<T extends z.ZodTypeAny>(name: string, schema: T): T {
  return schema.openapi(name);
}

const ErrorBody = named('ErrorBody', ErrorBodySchema);

const json = (schema: z.ZodTypeAny) => ({ 'application/json': { schema } });

function toRouteConfig(route: ApiRoute): RouteConfig {
  const responses: RouteConfig['responses'] = {};
  for (const [status, response] of Object.entries(route.responses)) {
    responses[status] = {
      description: response.description,
      ...(response.schema ? { content: json(response.schema) } : {}),
    };
  }
  for (const status of route.errors ?? []) {
    responses[String(status)] = { description: 'Error', content: json(ErrorBody) };
  }
  const { params, query, body } = route.request ?? {};
  return {
    method: route.method,
    path: `${API_PREFIX}${route.path}`,
    summary: route.summary,
    tags: [...route.tags],
    request: {
      ...(params ? { params } : {}),
      ...(query ? { query } : {}),
      ...(body ? { body: { content: json(body), required: true } } : {}),
    },
    responses,
  };
}

/** A registry holding the given routes plus the shared `ErrorBody` component. */
export function createRegistry(routes: readonly ApiRoute[]): OpenAPIRegistry {
  const registry = new OpenAPIRegistry();
  registry.register('ErrorBody', ErrorBody);
  for (const route of routes) {
    registry.registerPath(toRouteConfig(route));
  }
  return registry;
}
