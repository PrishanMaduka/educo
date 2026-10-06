import { cn } from '../lib/cn';
import { ICON_STROKE } from '../lib/motion';

import type { LucideIcon } from 'lucide-react';
import type { ReactNode } from 'react';

export interface EmptyStateProps {
  icon?: LucideIcon;
  /** One plain sentence saying what is missing. */
  title: string;
  /** What to do about it, or what will show up here. */
  description?: string;
  /** The next step, usually a Button. */
  action?: ReactNode;
  className?: string;
}

export function EmptyState({ icon: Icon, title, description, action, className }: EmptyStateProps) {
  return (
    <div className={cn('flex flex-col items-center gap-1.5 p-[30px] text-center', className)}>
      {Icon ? (
        <span className="mb-1 grid size-12 place-items-center rounded-full bg-surface-2 text-ink-2">
          <Icon aria-hidden="true" strokeWidth={ICON_STROKE} className="size-6" />
        </span>
      ) : null}
      <p className="m-0 text-[15px] font-bold text-ink">{title}</p>
      {description ? (
        <p className="m-0 max-w-[40ch] text-[13px] text-ink-2">{description}</p>
      ) : null}
      {action ? <div className="mt-2">{action}</div> : null}
    </div>
  );
}
