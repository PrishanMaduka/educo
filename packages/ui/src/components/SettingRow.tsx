import type { ReactNode } from 'react';

export interface SettingRowProps {
  label: string;
  children: ReactNode;
}

/** One read-only setting in a `<dl>`: its name, then its value (prototype `.uk-set`). */
export function SettingRow({ label, children }: SettingRowProps) {
  return (
    <div className="flex flex-wrap items-center gap-x-3.5 gap-y-1 border-b border-line px-[18px] py-[13px] last:border-b-0">
      <dt className="min-w-[160px] flex-1 text-[13.5px] font-semibold text-ink">{label}</dt>
      <dd className="m-0 flex min-w-0 items-center gap-2 text-[13.5px] break-words text-ink-2">
        {children}
      </dd>
    </div>
  );
}
