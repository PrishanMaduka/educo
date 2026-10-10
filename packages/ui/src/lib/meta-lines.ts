import type { AuditMetaJson } from '@quad/contracts';

/** One line of an audit entry's `meta`: its key, and its value as text. */
export interface MetaLine {
  readonly key: string;
  readonly value: string;
}

/**
 * An audit entry's `meta` as lines for its detail drawer (spec 07: "the metadata JSON in a
 * readable layout"): plain values as they are, anything nested as JSON, leaving out `omit`
 * (what the drawer already shows another way).
 */
export function metaLines(meta: AuditMetaJson, omit: ReadonlySet<string> = new Set()): MetaLine[] {
  return Object.entries(meta)
    .filter(([key]) => !omit.has(key))
    .map(([key, value]) => ({
      key,
      value:
        typeof value === 'string'
          ? value
          : typeof value === 'number' || typeof value === 'boolean'
            ? String(value)
            : JSON.stringify(value),
    }));
}
