import { AuditMetaJson } from '@quad/contracts';

/** One field of a School settings change, as stored. */
export interface FieldChange {
  readonly field: string;
  readonly before: unknown;
  readonly after: unknown;
}

const SETTINGS_KEYS: ReadonlySet<string> = new Set(['fields', 'before', 'after']);

const recordOf = (value: unknown): Readonly<Record<string, unknown>> => {
  const parsed = AuditMetaJson.safeParse(value);
  return parsed.success ? parsed.data : {};
};

/** A `settings.updated` entry's fields with their values before and after (D49). */
export function changesOf(action: string, meta: AuditMetaJson): FieldChange[] {
  const fields = meta['fields'];
  if (action !== 'settings.updated' || !Array.isArray(fields)) return [];
  const before = recordOf(meta['before']);
  const after = recordOf(meta['after']);
  return fields
    .filter((field): field is string => typeof field === 'string')
    .map((field) => ({ field, before: before[field] ?? null, after: after[field] ?? null }));
}

/** The rest of an entry's `meta`, one line per key: plain values as they are, nested as JSON. */
export function detailsOf(meta: AuditMetaJson, action?: string): { key: string; value: string }[] {
  return Object.entries(meta)
    .filter(([key]) => action !== 'settings.updated' || !SETTINGS_KEYS.has(key))
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
