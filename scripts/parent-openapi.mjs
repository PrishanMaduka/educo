// The parent app's slice of the OpenAPI document (Task 10 fix round 1, M9): `pnpm api:client`
// generates the Dart client (quad_api) from it, so console, webhook and meta routes, and the
// schemas only they use, never reach the parent app.

/** The tags the parent app calls. */
export const PARENT_TAGS = ['health', 'auth', 'me'];

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
 * component schemas those operations reach.
 * @param {OpenApiDocument} document
 * @param {readonly string[]} [tags]
 * @returns {OpenApiDocument & { components: { schemas: Record<string, unknown> } }}
 */
export function parentSpec(document, tags = PARENT_TAGS) {
  /** @type {OpenApiDocument['paths']} */
  const paths = {};
  for (const [path, operations] of Object.entries(document.paths)) {
    /** @type {OpenApiDocument['paths'][string]} */
    const kept = {};
    for (const [method, operation] of Object.entries(operations)) {
      const own = operation.tags ?? [];
      if (own.length > 0 && own.every((tag) => tags.includes(tag))) kept[method] = operation;
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
  return { ...document, paths, components: { ...document.components, schemas } };
}

/**
 * Generated client files that serve the console: none may exist (codegen check).
 * @param {readonly string[]} files paths relative to the client package
 * @returns {string[]}
 */
export function platformLeaks(files) {
  return files.filter((file) => (file.split('/').pop() ?? '').toLowerCase().startsWith('platform'));
}
