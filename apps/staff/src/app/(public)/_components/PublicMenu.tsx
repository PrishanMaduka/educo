'use client';

import { cn } from '@quad/ui';
import { Menu } from 'lucide-react';
import { useEffect, useId, useRef, useState } from 'react';

import { focusRing } from './styles';
import { ThemeSwitch, type ThemeSwitchLabels } from './ThemeSwitch';

const item = cn(
  'flex cursor-pointer items-center gap-2.5 border-0 border-b border-solid border-line bg-transparent px-1 py-3 text-left text-base font-extrabold text-ink',
  focusRing,
);

/**
 * The section links at 900 px and below (spec 19 top bar): a Menu button that reports
 * `aria-expanded`; Escape closes it and returns focus to the button.
 */
export function PublicMenu({
  label,
  links,
  theme,
}: {
  label: string;
  links: readonly { href: string; label: string }[];
  theme: ThemeSwitchLabels;
}) {
  const [isOpen, setOpen] = useState(false);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const id = useId();

  useEffect(() => {
    if (!isOpen) return undefined;
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      setOpen(false);
      buttonRef.current?.focus();
    };
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('keydown', onKey);
    };
  }, [isOpen]);

  return (
    <>
      <button
        ref={buttonRef}
        type="button"
        aria-label={label}
        aria-expanded={isOpen}
        aria-controls={id}
        onClick={() => {
          setOpen((open) => !open);
        }}
        className={cn(
          'ml-auto hidden size-11 flex-none cursor-pointer place-items-center rounded-full border-0 bg-transparent text-ink-2 hover:bg-surface-2 hover:text-ink max-[900px]:grid',
          focusRing,
        )}
      >
        <Menu aria-hidden="true" strokeWidth={2.4} className="size-5" />
      </button>
      <div
        id={id}
        hidden={!isOpen}
        className="absolute inset-x-0 top-[68px] flex flex-col border-b border-line bg-canvas px-4 pt-2 pb-4 shadow-lg min-[901px]:hidden [&[hidden]]:hidden"
      >
        {links.map((link) => (
          <a
            key={link.href}
            href={link.href}
            className={item}
            onClick={() => {
              setOpen(false);
            }}
          >
            {link.label}
          </a>
        ))}
        <ThemeSwitch variant="menu" labels={theme} className={item} />
      </div>
    </>
  );
}
