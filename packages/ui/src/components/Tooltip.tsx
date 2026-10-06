import * as RadixTooltip from '@radix-ui/react-tooltip';

import type { ReactElement, ReactNode } from 'react';

export interface TooltipProps {
  content: ReactNode;
  /** The element that gets the tooltip. It must accept a ref and focus. */
  children: ReactElement;
  side?: 'top' | 'right' | 'bottom' | 'left';
  delayDuration?: number;
}

export function Tooltip({ content, children, side = 'top', delayDuration = 300 }: TooltipProps) {
  return (
    <RadixTooltip.Provider delayDuration={delayDuration}>
      <RadixTooltip.Root>
        <RadixTooltip.Trigger asChild>{children}</RadixTooltip.Trigger>
        <RadixTooltip.Portal>
          <RadixTooltip.Content
            side={side}
            sideOffset={6}
            className="z-[300] max-w-[min(260px,calc(100vw-24px))] rounded-lg bg-ink px-2.5 py-1.5 text-xs font-semibold text-surface shadow-lg"
          >
            {content}
          </RadixTooltip.Content>
        </RadixTooltip.Portal>
      </RadixTooltip.Root>
    </RadixTooltip.Provider>
  );
}
