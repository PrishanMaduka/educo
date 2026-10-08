'use client';

import { cn } from '@quad/ui';
import { Menu } from 'lucide-react';
import { useEffect, useId, useRef, useState } from 'react';

import { focusRing } from './styles';
import { ThemeSwitch, type ThemeSwitchLabels } from './ThemeSwitch';

import type { ReactNode } from 'react';

/** One row of the menu (prototype `.menu a, .menu button`). */
export const menuItem = cn(
  'cursor-pointer border-0 border-b border-solid border-site-navy-line bg-transparent px-0.5 py-3 text-left text-base font-bold text-site-on-navy no-underline',
  focusRing,
);

/**
 * The section links at 1100 px and below (spec 19 top bar): a Menu button that reports
 * `aria-expanded`; Escape closes it and returns focus to the button. Below 760 px the menu opens
 * in the bar's flow, under the view switch; up to 1100 px it drops below the bar.
 */
export function PublicMenu({
  label,
  links,
  signIn,
  theme,
}: {
  label: string;
  links: readonly { href: string; label: ReactNode; className?: string }[];
  /** The Sign in entry for the menu (it opens its own note). */
  signIn: ReactNode;
  theme: ThemeSwitchLabels;
}) {
  const [isOpen, setOpen] = useState(false);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const id = useId();

  useEffect(() => {
    if (!isOpen) return undefined;
    const onKey = (event: KeyboardEvent) => {
      // A note opened from the menu closes first; its own Escape is not the menu's.
      if (event.key !== 'Escape' || document.querySelector('dialog[open]')) return;
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
          'hidden size-10 flex-none cursor-pointer place-items-center rounded-xl border-0 bg-transparent text-site-on-navy-2 hover:bg-site-navy-2 hover:text-site-on-navy max-[1100px]:grid',
          focusRing,
        )}
      >
        <Menu aria-hidden="true" strokeWidth={2.4} className="size-5" />
      </button>
      <div
        id={id}
        hidden={!isOpen}
        className={cn(
          'flex flex-col min-[1101px]:hidden [&[hidden]]:hidden',
          'min-[761px]:absolute min-[761px]:inset-x-0 min-[761px]:top-full min-[761px]:border-b min-[761px]:border-site-navy-line min-[761px]:bg-site-hero-bg min-[761px]:px-[clamp(16px,4vw,56px)] min-[761px]:pt-2 min-[761px]:pb-4',
          'max-[760px]:order-6 max-[760px]:w-full max-[760px]:border-t max-[760px]:border-site-navy-line max-[760px]:pt-1.5',
        )}
      >
        {links.map((link) => (
          <a
            key={link.href}
            href={link.href}
            className={cn(menuItem, link.className)}
            onClick={() => {
              setOpen(false);
            }}
          >
            {link.label}
          </a>
        ))}
        {signIn}
        <ThemeSwitch variant="menu" labels={theme} className={menuItem} />
      </div>
    </>
  );
}
