import { OpenAPIRegistry, extendZodWithOpenApi } from '@asteasolutions/zod-to-openapi';
import { ErrorBodySchema, MeBrand, MeBrandTheme } from '@quad/contracts';
import { z } from 'zod';

import { API_PREFIX } from '../common/api-prefix';

import type { RouteConfig } from '@asteasolutions/zod-to-openapi';

// Adds `.openapi()` to every Zod schema, including the ones packages/contracts already built.
extendZodWithOpenApi(z);

/** Every route is served under this prefix (spec 02, D15); defined in `common/api-prefix`. */
export { API_PREFIX };

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
    /** Request headers the route reads (`If-Match`), so the generated clients send them. */
    readonly headers?: z.AnyZodObject;
    readonly body?: z.ZodTypeAny;
  };
  /**
   * Success (and expected non-error) responses by status; omit `schema` for an empty body. `csv`
   * also documents a `text/csv` body, for a list that answers `Accept: text/csv` (spec 06).
   */
  readonly responses: Readonly<
    Record<number, { description: string; schema?: z.ZodTypeAny; csv?: boolean }>
  >;
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

/**
 * Names a contract schema in place, so every schema that nests it (not only a route's own
 * schema) refers to one component. `named` returns a renamed copy, which a schema built from the
 * original in packages/contracts never sees. Only OpenAPI metadata changes; validation does not.
 */
function nameNested(name: string, schema: z.ZodTypeAny): void {
  const def: z.ZodTypeDef = schema._def;
  def.openapi = { ...def.openapi, _internal: { ...def.openapi?._internal, refId: name } };
}

// The school brand appears in `GET /me`, the staff school list and the parent sign-in (D56).
nameNested('MeBrandTheme', MeBrandTheme);
nameNested('MeBrand', MeBrand);

const ErrorBody = named('ErrorBody', ErrorBodySchema);

const json = (schema: z.ZodTypeAny) => ({ 'application/json': { schema } });
const CsvText = z.string().openapi({ description: 'RFC 4180 CSV with a header row (UTF-8)' });

function toRouteConfig(route: ApiRoute): RouteConfig {
  const responses: RouteConfig['responses'] = {};
  for (const [status, response] of Object.entries(route.responses)) {
    responses[status] = {
      description: response.description,
      ...(response.schema
        ? {
            content: {
              ...json(response.schema),
              ...(response.csv === true ? { 'text/csv': { schema: CsvText } } : {}),
            },
          }
        : {}),
    };
  }
  for (const status of route.errors ?? []) {
    responses[String(status)] = { description: 'Error', content: json(ErrorBody) };
  }
  const { params, query, headers, body } = route.request ?? {};
  return {
    method: route.method,
    path: `${API_PREFIX}${route.path}`,
    summary: route.summary,
    tags: [...route.tags],
    request: {
      ...(params ? { params } : {}),
      ...(query ? { query } : {}),
      ...(headers ? { headers } : {}),
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
