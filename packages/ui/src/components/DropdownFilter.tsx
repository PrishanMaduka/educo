'use client';

import * as Popover from '@radix-ui/react-popover';
import { Check, ChevronDown, Search, X, type LucideIcon } from 'lucide-react';
import { useId, useMemo, useRef, useState, type KeyboardEvent } from 'react';

import { cn } from '../lib/cn';
import { fill, uiText } from '../lib/defaults';
import { focusRing, ICON_STROKE, transition } from '../lib/motion';

export interface DropdownFilterOption {
  value: string;
  label: string;
  /** How many records this choice would show. Zero is shown muted. */
  count?: number;
  group?: string;
}

export interface DropdownFilterProps {
  label: string;
  icon?: LucideIcon;
  /** The chosen option's value, or null when the filter is off. */
  value: string | null;
  options: readonly DropdownFilterOption[];
  searchable?: boolean;
  onChange: (value: string) => void;
  onClear: () => void;
  /** Accessible name of the clear button. Defaults to "Clear {label}". */
  clearLabel?: string;
  /** Accessible name of the search box. Defaults to "Search {label}". */
  searchLabel?: string;
  emptyLabel?: string;
}

interface Section {
  group: string | undefined;
  options: DropdownFilterOption[];
}

function sectionsOf(options: readonly DropdownFilterOption[]): Section[] {
  const sections: Section[] = [];
  for (const option of options) {
    let section = sections.find((s) => s.group === option.group);
    if (!section) {
      section = { group: option.group, options: [] };
      sections.push(section);
    }
    section.options.push(option);
  }
  return sections;
}

export function DropdownFilter({
  label,
  icon: Icon,
  value,
  options,
  searchable = false,
  onChange,
  onClear,
  clearLabel = fill(uiText['ui.filter.clear'], { label }),
  searchLabel = fill(uiText['ui.filter.search'], { label }),
  emptyLabel = uiText['ui.filter.empty'],
}: DropdownFilterProps) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const listRef = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const listId = useId();

  const active = value === null ? undefined : options.find((o) => o.value === value);
  const visible = useMemo(() => {
    const q = query.trim().toLocaleLowerCase();
    return q ? options.filter((o) => o.label.toLocaleLowerCase().includes(q)) : options;
  }, [options, query]);
  const sections = useMemo(() => sectionsOf(visible), [visible]);

  const optionElements = (): HTMLElement[] =>
    Array.from(listRef.current?.querySelectorAll<HTMLElement>('[role="option"]') ?? []);

  const pick = (next: string): void => {
    onChange(next);
    setOpen(false);
  };

  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>): void => {
    const items = optionElements();
    const index = items.indexOf(document.activeElement as HTMLElement);
    let target: HTMLElement | undefined;
    if (event.key === 'ArrowDown') target = items[index + 1] ?? items[0];
    else if (event.key === 'ArrowUp') {
      if (index <= 0 && searchRef.current) {
        event.preventDefault();
        searchRef.current.focus();
        return;
      }
      target = items[index - 1];
    } else if (event.key === 'Home' && index >= 0) target = items[0];
    else if (event.key === 'End' && index >= 0) target = items[items.length - 1];
    if (target) {
      event.preventDefault();
      target.focus();
    }
  };

  return (
    <Popover.Root
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (!next) setQuery('');
      }}
    >
      <div
        className={cn(
          'inline-flex h-[38px] max-w-full max-sm:h-11 items-center gap-1 rounded-[10px] border pr-2 pl-3 text-[13.5px]',
          transition,
          active
            ? 'border-brand-text/45 bg-brand-soft text-ink'
            : 'border-line-strong bg-surface text-ink hover:border-ink-3',
        )}
      >
        <Popover.Trigger
          ref={triggerRef}
          className={cn(
            'inline-flex min-w-0 cursor-pointer items-center gap-2 rounded-lg bg-transparent py-0 max-sm:min-h-11',
            focusRing,
          )}
        >
          {Icon ? (
            <Icon
              aria-hidden="true"
              strokeWidth={ICON_STROKE}
              className="size-4 shrink-0 text-ink-3"
            />
          ) : null}
          <span className="font-medium whitespace-nowrap text-ink-2">{label}</span>
          {active ? <span className="min-w-0 truncate font-bold">{active.label}</span> : null}
          <ChevronDown
            aria-hidden="true"
            strokeWidth={ICON_STROKE}
            className={cn('size-4 shrink-0 text-ink-3', transition, open && 'rotate-180')}
          />
        </Popover.Trigger>
        {active ? (
          <button
            type="button"
            aria-label={clearLabel}
            onClick={() => {
              onClear();
              triggerRef.current?.focus();
            }}
            className={cn(
              'relative -mr-0.5 grid size-5 shrink-0 cursor-pointer place-items-center rounded-full text-ink hover:bg-ink/10 after:absolute after:-inset-3 after:content-[""]',
              focusRing,
            )}
          >
            <X aria-hidden="true" strokeWidth={ICON_STROKE} className="size-3.5" />
          </button>
        ) : null}
      </div>
      <Popover.Portal>
        <Popover.Content
          aria-label={label}
          align="start"
          sideOffset={6}
          collisionPadding={12}
          onOpenAutoFocus={(event) => {
            if (searchable) return;
            event.preventDefault();
            const items = optionElements();
            (items.find((el) => el.getAttribute('aria-selected') === 'true') ?? items[0])?.focus();
          }}
          onKeyDown={onKeyDown}
          className="z-[200] flex max-w-[min(320px,calc(100vw-24px))] min-w-[220px] flex-col rounded-[14px] border border-line bg-surface p-1.5 shadow-lg outline-none"
        >
          {searchable ? (
            <div className="mx-0.5 mt-0.5 mb-1.5 flex h-9 items-center gap-2 rounded-[9px] border border-line px-2.5 text-ink-3">
              <Search aria-hidden="true" strokeWidth={ICON_STROKE} className="size-4 shrink-0" />
              <input
                ref={searchRef}
                type="search"
                aria-label={searchLabel}
                aria-controls={listId}
                value={query}
                onChange={(event) => {
                  setQuery(event.target.value);
                }}
                className={cn('min-w-0 flex-1 rounded-md bg-transparent text-ink', focusRing)}
              />
            </div>
          ) : null}
          <div
            ref={listRef}
            id={listId}
            role="listbox"
            aria-label={label}
            className="flex max-h-[min(340px,55vh)] flex-col gap-px overflow-auto overscroll-contain"
          >
            {sections.map((section) => {
              const items = section.options.map((option) => {
                const selected = option.value === value;
                return (
                  <div
                    key={option.value}
                    role="option"
                    tabIndex={-1}
                    aria-selected={selected}
                    onClick={() => {
                      pick(option.value);
                    }}
                    onKeyDown={(event) => {
                      if (event.key === 'Enter' || event.key === ' ') {
                        event.preventDefault();
                        pick(option.value);
                      }
                    }}
                    className={cn(
                      'flex w-full cursor-pointer items-center gap-2.5 rounded-[9px] px-2.5 py-2 text-[13.5px] text-ink',
                      'hover:bg-surface-2 focus:bg-surface-2 max-sm:min-h-11',
                      focusRing,
                      'focus-visible:-outline-offset-2',
                      selected && 'font-bold',
                      option.count === 0 && !selected && 'text-ink-2',
                    )}
                  >
                    <span className="min-w-0 flex-1">{option.label}</span>
                    {option.count === undefined ? null : (
                      <span
                        className={cn(
                          'rounded-pill px-2 py-px text-[11.5px] font-bold tabular-nums',
                          selected ? 'bg-brand-soft text-ink' : 'bg-surface-2 text-ink-2',
                        )}
                      >
                        {option.count}
                      </span>
                    )}
                    <span className="grid w-4 flex-none text-brand-text">
                      {selected ? (
                        <Check aria-hidden="true" strokeWidth={ICON_STROKE} className="size-4" />
                      ) : null}
                    </span>
                  </div>
                );
              });
              return section.group ? (
                <div
                  key={section.group}
                  role="group"
                  aria-label={section.group}
                  className="flex flex-col gap-px"
                >
                  <div
                    aria-hidden="true"
                    className="px-2.5 pt-2.5 pb-1 text-[10.5px] font-extrabold tracking-[0.08em] text-ink-2 uppercase"
                  >
                    {section.group}
                  </div>
                  {items}
                </div>
              ) : (
                <div key="__ungrouped" role="presentation" className="flex flex-col gap-px">
                  {items}
                </div>
              );
            })}
            {visible.length === 0 ? (
              <p className="p-4 text-center text-[13px] text-ink-2">{emptyLabel}</p>
            ) : null}
          </div>
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
}
