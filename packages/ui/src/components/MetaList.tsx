'use client';

import { useId } from 'react';

import type { MetaLine } from '../lib/meta-lines';

export interface MetaListProps {
  title: string;
  lines: readonly MetaLine[];
}

/** An audit entry's recorded detail (`metaLines`), key and value in monospace; nothing when empty. */
export function MetaList({ title, lines }: MetaListProps) {
  const id = useId();
  if (lines.length === 0) return null;
  return (
    <section aria-labelledby={id} className="flex flex-col gap-2">
      <h3 id={id} className="m-0 text-[13px] font-bold text-ink">
        {title}
      </h3>
      <dl className="m-0 flex flex-col gap-1.5 rounded-xl bg-surface-2 px-3.5 py-3">
        {lines.map((line) => (
          <div key={line.key} className="flex flex-wrap gap-x-3 gap-y-0.5 text-[13px]">
            <dt className="font-mono text-ink-2">{line.key}</dt>
            <dd className="m-0 min-w-0 font-mono break-all text-ink">{line.value}</dd>
          </div>
        ))}
      </dl>
    </section>
  );
}
