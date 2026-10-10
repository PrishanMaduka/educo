'use client';

import * as RadixTabs from '@radix-ui/react-tabs';

import { cn } from '../lib/cn';
import { focusRing, transition } from '../lib/motion';

import type { ReactNode } from 'react';

export interface TabItem {
  value: string;
  label: string;
  count?: number;
  disabled?: boolean;
  panel: ReactNode;
}

export interface TabsProps {
  /** Names the tab list for screen readers. */
  label: string;
  tabs: readonly TabItem[];
  value?: string;
  defaultValue?: string;
  onValueChange?: (value: string) => void;
  className?: string;
}

export function Tabs({ label, tabs, value, defaultValue, onValueChange, className }: TabsProps) {
  return (
    <RadixTabs.Root
      value={value}
      defaultValue={value === undefined ? (defaultValue ?? tabs[0]?.value) : undefined}
      onValueChange={onValueChange}
      className={className}
    >
      <RadixTabs.List
        aria-label={label}
        className="flex gap-0.5 overflow-x-auto border-b border-line [scrollbar-width:none]"
      >
        {tabs.map((tab) => (
          <RadixTabs.Trigger
            key={tab.value}
            value={tab.value}
            disabled={tab.disabled}
            className={cn(
              '-mb-px inline-flex cursor-pointer items-center gap-1.5 border-b-2 border-transparent px-3.5 py-2.5 font-semibold whitespace-nowrap text-ink-2 max-sm:min-h-11',
              'hover:text-ink data-[state=active]:border-brand-text data-[state=active]:text-ink disabled:cursor-not-allowed disabled:opacity-50',
              transition,
              focusRing,
            )}
          >
            {tab.label}
            {tab.count === undefined ? null : (
              <span className="rounded-pill bg-surface-2 px-2 py-px text-[11.5px] font-bold text-ink-2 tabular-nums">
                {tab.count}
              </span>
            )}
          </RadixTabs.Trigger>
        ))}
      </RadixTabs.List>
      {tabs.map((tab) => (
        <RadixTabs.Content key={tab.value} value={tab.value} className={cn('pt-4', focusRing)}>
          {tab.panel}
        </RadixTabs.Content>
      ))}
    </RadixTabs.Root>
  );
}
