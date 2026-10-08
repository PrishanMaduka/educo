import { cn } from '../lib/cn';
import { ICON_STROKE } from '../lib/motion';

import type { LucideIcon } from 'lucide-react';

export type KpiTone = 'brand' | 'good' | 'warn' | 'bad' | 'info';

export interface KpiProps {
  label: string;
  value: string;
  /** A short comparison such as "+2% on last week". */
  delta?: string;
  icon?: LucideIcon;
  tone?: KpiTone;
  className?: string;
}

const tile: Record<KpiTone, string> = {
  brand: 'bg-brand-soft text-brand-strong',
  good: 'bg-good-soft text-good',
  warn: 'bg-warn-soft text-warn',
  bad: 'bg-bad-soft text-bad',
  info: 'bg-info-soft text-info',
};

export function Kpi({ label, value, delta, icon: Icon, tone = 'brand', className }: KpiProps) {
  return (
    <div
      className={cn(
        'flex min-w-0 items-start gap-3.5 rounded-card border border-line bg-surface px-[18px] py-4 shadow-card',
        className,
      )}
    >
      {Icon ? (
        <span
          className={cn('grid size-[42px] flex-none place-items-center rounded-[10px]', tile[tone])}
        >
          <Icon aria-hidden="true" strokeWidth={ICON_STROKE} className="size-5" />
        </span>
      ) : null}
      <dl className="min-w-0">
        <dt className="text-[12.5px] font-semibold text-ink-2">{label}</dt>
        <dd className="mt-0.5 text-2xl leading-[1.1] font-bold text-ink tabular-nums">{value}</dd>
        {delta ? <dd className="mt-1 text-xs text-ink-2">{delta}</dd> : null}
      </dl>
    </div>
  );
}
