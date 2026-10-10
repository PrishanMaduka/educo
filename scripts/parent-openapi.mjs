// The parent app's slice of the OpenAPI document (Task 10 fix round 1, M9): `pnpm api:client`
// generates the Dart client (quad_api) from it, so console, webhook and meta routes, and the
// schemas only they use, never reach the parent app.

/** The tags the parent app calls. */
export const PARENT_TAGS = ['health', 'auth', 'me'];

/**
 * The tags kept out of the parent client: the console, provider webhooks, the API description and
 * `staff` (staff portal only: `GET /me/permissions` and Preview a role, Task 12; an operation is
 * kept only when every one of its tags is a parent tag), and the staff portal's own areas: `users`
 * and `roles` (Users & roles, Task 13), `school` (School settings, Task 14), `audit` (Settings →
 * Audit, Task 15), and `public` (school websites' forms: the enquiry stub).
 * Every tag must be in one list or the other (fix round 2): a new area's tag fails
 * `pnpm api:client` until someone decides whether the parent app may call it.
 */
export const EXCLUDED_TAGS = [
  'platform',
  'webhooks',
  'meta',
  'staff',
  'users',
  'roles',
  'school',
  'audit',
  'public',
];

/**
 * @typedef {{
 *   paths: Record<string, Record<string, { tags?: string[] } & Record<string, unknown>>>,
 *   components?: { schemas?: Record<string, unknown> } & Record<string, unknown>,
 * } & Record<string, unknown>} OpenApiDocument
 */

const SCHEMA_REF = '#/components/schemas/';

/**
 * Every schema name a value refers to with `$ref`, at any depth.
 * @param {unknown} value
 * @param {Set<string>} into
 */
function collectRefs(value, into) {
  if (Array.isArray(value)) {
    for (const item of value) collectRefs(item, into);
    return;
  }
  if (typeof value !== 'object' || value === null) return;
  for (const [key, child] of Object.entries(value)) {
    if (key === '$ref' && typeof child === 'string' && child.startsWith(SCHEMA_REF)) {
      into.add(child.slice(SCHEMA_REF.length));
    } else {
      collectRefs(child, into);
    }
  }
}

/**
 * A copy of `document` with only the operations whose tags are all parent-facing, and only the
 * component schemas those operations reach. Throws for an operation with no tag, or with a tag in
 * neither `PARENT_TAGS` nor `EXCLUDED_TAGS`.
 * @param {OpenApiDocument} document
 * @param {readonly string[]} [tags]
 * @returns {OpenApiDocument & { components: { schemas: Record<string, unknown> } }}
 */
export function parentSpec(document, tags = PARENT_TAGS) {
  for (const [path, operations] of Object.entries(document.paths)) {
    for (const [method, operation] of Object.entries(operations)) {
      const route = `${method.toUpperCase()} ${path}`;
      const own = operation.tags ?? [];
      if (own.length === 0) throw new Error(`${route} has no tag`);
      for (const tag of own) {
        if (!tags.includes(tag) && !EXCLUDED_TAGS.includes(tag)) {
          throw new Error(
            `${route} has the tag ${tag}, which is neither a parent tag nor an excluded one (scripts/parent-openapi.mjs)`,
          );
        }
      }
    }
  }
  /** @type {OpenApiDocument['paths']} */
  const paths = {};
  for (const [path, operations] of Object.entries(document.paths)) {
    /** @type {OpenApiDocument['paths'][string]} */
    const kept = {};
    for (const [method, operation] of Object.entries(operations)) {
      if ((operation.tags ?? []).every((tag) => tags.includes(tag))) kept[method] = operation;
    }
    if (Object.keys(kept).length > 0) paths[path] = kept;
  }
  const all = document.components?.schemas ?? {};
  /** @type {Set<string>} */
  const reached = new Set();
  collectRefs(paths, reached);
  // Follow references inside the schemas until nothing new turns up.
  /** @type {string[]} */
  const queue = [...reached];
  while (queue.length > 0) {
    const name = queue.pop();
    if (name === undefined) break;
    /** @type {Set<string>} */
    const found = new Set();
    collectRefs(all[name], found);
    for (const next of found) {
      if (!reached.has(next)) {
        reached.add(next);
        queue.push(next);
      }
    }
  }
  /** @type {Record<string, unknown>} */
  const schemas = {};
  for (const name of Object.keys(all)) {
    if (reached.has(name)) schemas[name] = all[name];
  }
  return {
    ...document,
    paths,
    components: { ...document.components, schemas: dartNullableObjects(schemas) },
  };
}

/**
 * A copy of `value` in which no object schema requires a property typed `['object', 'null']`
 * (Task 25). openapi-generator 7.10's dart-dio ignores the `null` in a 3.1 type list when it
 * turns an inline object into a model, so `Me.preview` came out as a required `MePreview` and
 * `GET /me` (preview and support null) failed to parse. A property it does not require becomes
 * nullable in Dart; the API still always sends it. Nullable primitives already work.
 *
 * Only the inline form is handled, because it is the only one the API's document has (Zod's
 * `.nullable()` on an object). A nullable `$ref` (`anyOf: [{ $ref }, { type: 'null' }]`, or a
 * `$ref` with `nullable`) stays required; if one appears, check its generated Dart field and
 * extend this.
 * @template T
 * @param {T} value
 * @returns {T}
 */
export function dartNullableObjects(value) {
  if (Array.isArray(value)) return /** @type {T} */ (value.map(dartNullableObjects));
  if (typeof value !== 'object' || value === null) return value;
  /** @type {Record<string, unknown>} */
  const copy = {};
  for (const [key, child] of Object.entries(value)) copy[key] = dartNullableObjects(child);
  const { properties, required } = /** @type {{ properties?: unknown, required?: unknown }} */ (
    copy
  );
  if (typeof properties === 'object' && properties !== null && Array.isArray(required)) {
    const nullable = Object.entries(properties)
      .filter(([, schema]) => {
        const type = /** @type {{ type?: unknown }} */ (schema)?.type;
        return Array.isArray(type) && type.includes('object') && type.includes('null');
      })
      .map(([name]) => name);
    copy['required'] = required.filter((name) => !nullable.includes(name));
  }
  return /** @type {T} */ (copy);
}

/**
 * Generated client files that serve the console: none may exist (codegen check).
 * @param {readonly string[]} files paths relative to the client package
 * @returns {string[]}
 */
export function platformLeaks(files) {
  return files.filter((file) => (file.split('/').pop() ?? '').toLowerCase().startsWith('platform'));
}
