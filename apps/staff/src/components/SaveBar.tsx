'use client';

import { Button } from '@quad/ui';

export interface SaveBarProps {
  /** What is unsaved ("Unsaved changes to Year lead"). */
  message: string;
  discardLabel: string;
  saveLabel: string;
  saving: boolean;
  onDiscard: () => void;
  /** Called by Save, unless `form` makes Save submit that form. */
  onSave?: () => void;
  /** The id of the form Save submits. */
  form?: string;
}

/**
 * The sticky bar under a settings form while it has unsaved changes (prototype `.savebar` and
 * `.uk-bar`): what is unsaved, Discard and Save.
 */
export function SaveBar({
  message,
  discardLabel,
  saveLabel,
  saving,
  onDiscard,
  onSave,
  form,
}: SaveBarProps) {
  return (
    <div className="sticky bottom-0 z-10 flex flex-wrap items-center gap-2.5 rounded-b-card border-t border-line bg-surface px-[18px] py-3 shadow-card">
      <p role="status" className="m-0 min-w-0 flex-1 text-[13px] font-semibold text-ink">
        {message}
      </p>
      <Button variant="secondary" size="sm" disabled={saving} onClick={onDiscard}>
        {discardLabel}
      </Button>
      <Button
        size="sm"
        disabled={saving}
        {...(form === undefined ? { onClick: onSave } : { type: 'submit', form })}
      >
        {saveLabel}
      </Button>
    </div>
  );
}
