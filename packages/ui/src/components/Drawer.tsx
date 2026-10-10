'use client';

import * as Dialog from '@radix-ui/react-dialog';
import { Check, X, type LucideIcon } from 'lucide-react';
import { useEffect, useRef, useState, type ReactNode } from 'react';

import { cn } from '../lib/cn';
import { uiText } from '../lib/defaults';
import { ICON_STROKE, transition } from '../lib/motion';

import { Button } from './Button';
import { IconButton } from './IconButton';

export interface StepperProps {
  steps: readonly string[];
  /** Zero-based index of the current step. */
  current: number;
  /** Accessible name of the step list. */
  label?: string;
}

/** Numbered steps for multi-step forms. The current one carries `aria-current="step"`. */
export function Stepper({ steps, current, label = uiText['ui.drawer.steps'] }: StepperProps) {
  return (
    <ol aria-label={label} className="m-0 flex list-none items-center gap-2 p-0">
      {steps.map((name, i) => {
        const state = i < current ? 'done' : i === current ? 'current' : 'todo';
        return (
          <li
            key={name}
            aria-current={state === 'current' ? 'step' : undefined}
            className="flex min-w-0 items-center gap-2"
          >
            <span
              className={cn(
                'grid size-6 shrink-0 place-items-center rounded-full border text-xs font-bold',
                state === 'current' && 'border-brand-fill bg-brand-fill text-brand-ink',
                state === 'done' && 'border-brand-text bg-brand-soft text-brand-text',
                state === 'todo' && 'border-line-strong bg-surface text-ink-2',
              )}
            >
              {state === 'done' ? (
                <Check aria-hidden="true" strokeWidth={ICON_STROKE} className="size-3.5" />
              ) : (
                i + 1
              )}
            </span>
            <span
              className={cn(
                'truncate text-[13px] font-semibold',
                state === 'current' ? 'text-ink' : 'text-ink-2',
              )}
            >
              {name}
            </span>
            {i < steps.length - 1 ? (
              <span aria-hidden="true" className="h-px w-4 shrink-0 bg-line-strong max-sm:w-2" />
            ) : null}
          </li>
        );
      })}
    </ol>
  );
}

export interface DrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  subtitle?: string;
  /** Small uppercase section name above the title. */
  eyebrow?: string;
  /** Icon in the coloured tile. */
  icon?: LucideIcon;
  /** 520 px by default, 760 px when wide. Full screen under 640 px either way. */
  width?: 'md' | 'wide';
  /** Suspend and delete drawers use the bad accent. */
  tone?: 'default' | 'danger';
  /** Step names for a multi-step form, shown as a numbered stepper in the header. */
  steps?: string[];
  /** Zero-based index of the current step. */
  step?: number;
  /** When true, closing asks "Discard changes?" first. */
  dirty?: boolean;
  /** Usually Cancel and the primary action, right-aligned. */
  footer?: ReactNode;
  children: ReactNode;
  closeLabel?: string;
  stepsLabel?: string;
  discardTitle?: string;
  discardBody?: string;
  keepLabel?: string;
  discardLabel?: string;
}

/**
 * Closes the drawer it sits in the way Escape does, so a dirty drawer asks "Discard changes?"
 * first. Wrap a footer Cancel in it (`asChild`), instead of setting `open` from its click.
 */
export const DrawerClose = Dialog.Close;

/** Right-side form drawer: Escape closes, focus is trapped and returns to the opener. */
export function Drawer({
  open,
  onOpenChange,
  title,
  subtitle,
  eyebrow,
  icon: Icon,
  width = 'md',
  tone = 'default',
  steps,
  step = 0,
  dirty = false,
  footer,
  children,
  closeLabel = uiText['ui.drawer.close'],
  stepsLabel = uiText['ui.drawer.steps'],
  discardTitle = uiText['ui.drawer.discard.title'],
  discardBody = uiText['ui.drawer.discard.body'],
  keepLabel = uiText['ui.drawer.discard.keep'],
  discardLabel = uiText['ui.drawer.discard.confirm'],
}: DrawerProps) {
  const [confirming, setConfirming] = useState(false);
  const bodyRef = useRef<HTMLDivElement>(null);
  const openerRef = useRef<HTMLElement | null>(null);
  const keepRef = useRef<HTMLButtonElement>(null);
  const danger = tone === 'danger';

  useEffect(() => {
    if (confirming) keepRef.current?.focus();
  }, [confirming]);

  useEffect(() => {
    if (!open) setConfirming(false);
  }, [open]);

  const requestChange = (next: boolean): void => {
    if (next) {
      onOpenChange(true);
    } else if (confirming) {
      setConfirming(false);
    } else if (dirty) {
      setConfirming(true);
    } else {
      onOpenChange(false);
    }
  };

  return (
    <Dialog.Root open={open} onOpenChange={requestChange}>
      <Dialog.Portal>
        <Dialog.Overlay
          className={cn(
            'fixed inset-0 z-[70] bg-ink/40 starting:opacity-0 data-[state=open]:opacity-100',
            transition,
          )}
        />
        <Dialog.Content
          onOpenAutoFocus={(event) => {
            // Radix only restores focus to its own Trigger, and drawers are usually opened by a plain button.
            openerRef.current =
              document.activeElement instanceof HTMLElement ? document.activeElement : null;
            const field = bodyRef.current?.querySelector<HTMLElement>(
              'input:not([type="hidden"]):not(:disabled), select:not(:disabled), textarea:not(:disabled), [data-autofocus]',
            );
            if (field) {
              event.preventDefault();
              field.focus();
            }
          }}
          onCloseAutoFocus={(event) => {
            event.preventDefault();
            if (openerRef.current?.isConnected) openerRef.current.focus();
          }}
          className={cn(
            'fixed inset-y-0 right-0 z-[71] flex w-full flex-col bg-surface shadow-lg outline-none sm:rounded-l-[22px]',
            width === 'wide' ? 'sm:w-[760px]' : 'sm:w-[520px]',
            'starting:translate-x-full data-[state=open]:translate-x-0',
            transition,
          )}
        >
          <header
            className={cn(
              'flex flex-wrap items-start gap-3.5 border-b border-line bg-linear-to-b to-transparent px-5.5 pt-5.5 pb-4.5 max-sm:px-4 max-sm:pt-4.5 max-sm:pb-3.5',
              danger ? 'from-bad-soft' : 'from-brand-soft',
            )}
          >
            {Icon ? (
              <span
                className={cn(
                  'grid size-11 shrink-0 place-items-center rounded-xl max-sm:size-10',
                  danger ? 'bg-bad text-surface' : 'bg-brand-fill text-brand-ink',
                )}
              >
                <Icon aria-hidden="true" strokeWidth={ICON_STROKE} className="size-5" />
              </span>
            ) : null}
            <div className="min-w-0 flex-1">
              {eyebrow ? (
                <p className="m-0 text-[10.5px] font-bold tracking-[0.12em] text-ink-2 uppercase">
                  {eyebrow}
                </p>
              ) : null}
              <Dialog.Title className="m-0 font-display text-[22px] leading-tight font-bold tracking-tight text-ink">
                {title}
              </Dialog.Title>
              {subtitle ? (
                <Dialog.Description className="m-0 mt-0.5 text-[13px] text-ink-2">
                  {subtitle}
                </Dialog.Description>
              ) : (
                <Dialog.Description className="sr-only">{title}</Dialog.Description>
              )}
            </div>
            <IconButton
              icon={X}
              label={closeLabel}
              variant="ghost"
              onClick={() => {
                requestChange(false);
              }}
            />
            {steps && steps.length > 0 ? (
              <div className="basis-full pt-1.5">
                <Stepper steps={steps} current={step} label={stepsLabel} />
              </div>
            ) : null}
          </header>
          <div
            ref={bodyRef}
            className="flex flex-1 flex-col gap-3.5 overflow-y-auto bg-canvas p-5.5 max-sm:p-3.5"
          >
            {children}
          </div>
          {confirming ? (
            <div
              role="alert"
              className="flex flex-wrap items-center justify-between gap-3 border-t border-line bg-bad-soft px-5.5 py-3.5 max-sm:px-4"
            >
              <div className="min-w-0">
                <p className="m-0 text-sm font-bold text-ink">{discardTitle}</p>
                <p className="m-0 text-[13px] text-ink-2">{discardBody}</p>
              </div>
              <div className="flex gap-2.5">
                <Button
                  variant="secondary"
                  ref={keepRef}
                  onClick={() => {
                    setConfirming(false);
                  }}
                >
                  {keepLabel}
                </Button>
                <Button
                  variant="danger"
                  onClick={() => {
                    setConfirming(false);
                    onOpenChange(false);
                  }}
                >
                  {discardLabel}
                </Button>
              </div>
            </div>
          ) : footer ? (
            <footer className="flex flex-wrap justify-end gap-2.5 border-t border-line bg-surface px-5.5 py-3.5 max-sm:px-4">
              {footer}
            </footer>
          ) : null}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
