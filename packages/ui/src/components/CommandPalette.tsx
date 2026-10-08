'use client';

import * as Dialog from '@radix-ui/react-dialog';
import { Search } from 'lucide-react';
import { useEffect, useId, useMemo, useRef, useState, type KeyboardEvent } from 'react';

import { cn } from '../lib/cn';
import { uiText } from '../lib/defaults';
import { ICON_STROKE } from '../lib/motion';

export interface CommandItem {
  id: string;
  label: string;
  /** Small secondary text on the right, for example a year group or a shortcut. */
  hint?: string;
  onSelect: () => void;
}

export interface CommandGroup {
  label: string;
  items: CommandItem[];
}

export interface CommandPaletteProps {
  /** Leave out to let the palette manage itself, or pass both to control it. */
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  groups: CommandGroup[];
  placeholder?: string;
  /** Accessible name of the palette and its search box. */
  label?: string;
  emptyLabel?: string;
}

function matches(item: CommandItem, query: string): boolean {
  return `${item.label} ${item.hint ?? ''}`.toLocaleLowerCase().includes(query);
}

interface PanelProps {
  groups: CommandGroup[];
  placeholder: string;
  label: string;
  emptyLabel: string;
  close: () => void;
}

/** Mounted only while open, so the search text and highlighted row start fresh each time. */
function Panel({ groups, placeholder, label, emptyLabel, close }: PanelProps) {
  const base = useId();
  const listId = `${base}-list`;
  const [query, setQuery] = useState('');
  const [active, setActive] = useState(0);

  const visible = useMemo(() => {
    const q = query.trim().toLocaleLowerCase();
    return groups
      .map((g) => ({ ...g, items: q ? g.items.filter((i) => matches(i, q)) : g.items }))
      .filter((g) => g.items.length > 0);
  }, [groups, query]);
  const flat = visible.flatMap((g) => g.items);
  const current = Math.min(active, Math.max(flat.length - 1, 0));
  const optionId = (item: CommandItem): string => `${base}-opt-${item.id}`;
  const activeItem = flat[current];

  const choose = (item: CommandItem): void => {
    item.onSelect();
    close();
  };

  const onKeyDown = (event: KeyboardEvent<HTMLInputElement>): void => {
    if (flat.length === 0) return;
    if (event.key === 'ArrowDown') {
      event.preventDefault();
      setActive((current + 1) % flat.length);
    } else if (event.key === 'ArrowUp') {
      event.preventDefault();
      setActive((current - 1 + flat.length) % flat.length);
    } else if (event.key === 'Home') {
      event.preventDefault();
      setActive(0);
    } else if (event.key === 'End') {
      event.preventDefault();
      setActive(flat.length - 1);
    } else if (event.key === 'Enter' && activeItem) {
      event.preventDefault();
      choose(activeItem);
    }
  };

  return (
    <>
      <div className="flex h-12 items-center gap-2.5 border-b border-line px-4 text-ink-3 max-sm:h-14">
        <Search aria-hidden="true" strokeWidth={ICON_STROKE} className="size-[18px] shrink-0" />
        <input
          role="combobox"
          type="text"
          aria-label={label}
          aria-expanded="true"
          aria-controls={listId}
          aria-autocomplete="list"
          aria-activedescendant={activeItem ? optionId(activeItem) : undefined}
          autoComplete="off"
          spellCheck={false}
          placeholder={placeholder}
          value={query}
          onChange={(event) => {
            setQuery(event.target.value);
            setActive(0);
          }}
          onKeyDown={onKeyDown}
          className="min-w-0 flex-1 bg-transparent text-[15px] text-ink outline-none placeholder:text-ink-2"
        />
      </div>
      <div className="max-h-[min(360px,60vh)] overflow-y-auto overscroll-contain p-1.5">
        <div id={listId} role="listbox" aria-label={label}>
          {visible.map((group) => (
            <div key={group.label} role="group" aria-labelledby={`${base}-g-${group.label}`}>
              <div
                id={`${base}-g-${group.label}`}
                className="px-2.5 pt-2 pb-1 text-[11px] font-bold tracking-wide text-ink-2 uppercase"
              >
                {group.label}
              </div>
              {group.items.map((item) => {
                const selected = item === activeItem;
                return (
                  // Keyboard use goes through the combobox input (aria-activedescendant), so options are not tab stops.
                  // eslint-disable-next-line jsx-a11y/click-events-have-key-events
                  <div
                    key={item.id}
                    id={optionId(item)}
                    role="option"
                    tabIndex={-1}
                    aria-selected={selected}
                    onClick={() => {
                      choose(item);
                    }}
                    onMouseMove={() => {
                      setActive(flat.indexOf(item));
                    }}
                    className={cn(
                      'flex min-h-9 cursor-pointer items-center justify-between gap-3 rounded-lg px-2.5 py-1.5 text-[13.5px] text-ink max-sm:min-h-11',
                      selected && 'bg-brand-soft',
                    )}
                  >
                    <span className="min-w-0 truncate font-semibold">{item.label}</span>
                    {item.hint ? (
                      <span className="shrink-0 text-xs text-ink-2">{item.hint}</span>
                    ) : null}
                  </div>
                );
              })}
            </div>
          ))}
        </div>
        {flat.length === 0 ? (
          <p role="status" className="m-0 px-3 py-6 text-center text-[13px] text-ink-2">
            {emptyLabel}
          </p>
        ) : null}
      </div>
    </>
  );
}

/** Ctrl K or Cmd K search box with grouped results. The caller supplies the groups and what each one does. */
export function CommandPalette({
  open: openProp,
  onOpenChange,
  groups,
  placeholder = uiText['search.placeholder'],
  label = uiText['ui.palette.label'],
  emptyLabel = uiText['ui.filter.empty'],
}: CommandPaletteProps) {
  const [inner, setInner] = useState(false);
  const open = openProp ?? inner;
  const setOpen = (next: boolean): void => {
    if (openProp === undefined) setInner(next);
    onOpenChange?.(next);
  };

  // Where focus was when the palette opened (a button, or anywhere for Ctrl K), to return it on close.
  const returnFocus = useRef<HTMLElement | null>(null);

  // Always the latest closure, so the one global listener never goes stale.
  const [request] = useState(() => ({ current: setOpen }));
  request.current = setOpen;

  useEffect(() => {
    const onKey = (event: globalThis.KeyboardEvent): void => {
      if (event.defaultPrevented || event.isComposing) return;
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault();
        request.current(true);
      }
    };
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('keydown', onKey);
    };
  }, [request]);

  return (
    <Dialog.Root open={open} onOpenChange={setOpen}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-[90] bg-ink/40" />
        <Dialog.Content
          aria-describedby={undefined}
          onOpenAutoFocus={() => {
            // Runs before focus moves into the palette, so this is still the element that opened it.
            returnFocus.current =
              document.activeElement instanceof HTMLElement ? document.activeElement : null;
          }}
          onCloseAutoFocus={(event) => {
            // There is no Dialog.Trigger, so Radix would send focus to <body>.
            const target = returnFocus.current;
            returnFocus.current = null;
            if (target?.isConnected) {
              event.preventDefault();
              target.focus();
            }
          }}
          className="fixed top-[12vh] left-1/2 z-[91] w-[min(560px,calc(100vw-24px))] -translate-x-1/2 overflow-hidden rounded-[14px] border border-line bg-surface shadow-lg outline-none max-sm:top-3"
        >
          <Dialog.Title className="sr-only">{label}</Dialog.Title>
          <Panel
            groups={groups}
            placeholder={placeholder}
            label={label}
            emptyLabel={emptyLabel}
            close={() => {
              setOpen(false);
            }}
          />
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
