import { AuditMetaJson } from '@quad/contracts';
import { metaLines, type MetaLine } from '@quad/ui';

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

/** The rest of an entry's `meta` as lines, leaving out what `changesOf` shows for a settings change. */
export function detailsOf(meta: AuditMetaJson, action?: string): MetaLine[] {
  return metaLines(meta, action === 'settings.updated' ? SETTINGS_KEYS : new Set());
}
