'use client';

import { cn } from '../lib/cn';
import { fill, uiText } from '../lib/defaults';
import { focusRing } from '../lib/motion';

import { Checkbox } from './Checkbox';
import { Pill } from './Pill';

export interface PermissionMatrixRow {
  /** The module's id, as the caller's matrix keys it. */
  id: string;
  label: string;
  /** The school's plan lacks this module: its row shows "Not in plan" and nothing to tick. */
  notInPlan?: boolean;
}

export interface PermissionMatrixColumn {
  /** The action's id, as each row of the caller's matrix keys it. */
  id: string;
  label: string;
}

/** Ticked cells: `value[module][action]`. A missing row or cell is not ticked. */
export type PermissionMatrixValue = Readonly<
  Record<string, Readonly<Record<string, boolean>> | undefined>
>;

export interface PermissionMatrixProps {
  /** Names the table for screen readers. Not shown. */
  caption: string;
  rows: readonly PermissionMatrixRow[];
  columns: readonly PermissionMatrixColumn[];
  value: PermissionMatrixValue;
  /**
   * One box clicked. The caller applies its own rules (for example "ticking Create ticks View")
   * and passes the new `value` back.
   */
  onToggle?: (module: string, action: string, checked: boolean) => void;
  /** Every box is shown but locked, as for a built-in role. Also locked without `onToggle`. */
  readOnly?: boolean;
  moduleHeader?: string;
  notInPlanLabel?: string;
  /** The accessible name of one box. */
  cellLabel?: (action: string, module: string) => string;
  className?: string;
}

/**
 * The module × action permission matrix (spec 05; spec 07 and 08 role builder), shared by the
 * staff portal and the console. It only shows and reports clicks: no fetching, no rules.
 */
export function PermissionMatrix({
  caption,
  rows,
  columns,
  value,
  onToggle,
  readOnly = false,
  moduleHeader = uiText['ui.matrix.module'],
  notInPlanLabel = uiText['ui.matrix.notInPlan'],
  cellLabel = (action, module) => fill(uiText['ui.matrix.cell'], { action, module }),
  className,
}: PermissionMatrixProps) {
  const locked = readOnly || onToggle === undefined;
  const head =
    'border-b border-line bg-surface-2 px-3.5 py-2.5 text-[11.5px] font-bold tracking-[0.04em] whitespace-nowrap text-ink-2 uppercase';
  return (
    // Focusable, so the table scrolls from the keyboard on a phone even when every box is locked.
    <div
      role="group"
      aria-label={caption}
      // A scrollable region must be reachable from the keyboard (axe scrollable-region-focusable).
      // eslint-disable-next-line jsx-a11y/no-noninteractive-tabindex
      tabIndex={0}
      className={cn(
        'min-w-0 overflow-x-auto',
        focusRing,
        'focus-visible:-outline-offset-2',
        className,
      )}
    >
      <table className="w-full border-collapse text-[13px] text-ink">
        <caption className="sr-only">{caption}</caption>
        <thead>
          <tr>
            <th scope="col" className={cn(head, 'text-left')}>
              {moduleHeader}
            </th>
            {columns.map((column) => (
              <th key={column.id} scope="col" className={cn(head, 'text-center')}>
                {column.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.id}>
              <th
                scope="row"
                className="border-b border-line px-3.5 py-[11px] text-left font-semibold whitespace-nowrap"
              >
                {row.label}
              </th>
              {row.notInPlan ? (
                <td colSpan={columns.length} className="border-b border-line px-3.5 py-[11px]">
                  <Pill tone="neutral" plain>
                    {notInPlanLabel}
                  </Pill>
                </td>
              ) : (
                columns.map((column) => (
                  <td
                    key={column.id}
                    className="border-b border-line px-3.5 py-[11px] text-center max-sm:min-w-11"
                  >
                    <Checkbox
                      aria-label={cellLabel(column.label, row.label)}
                      checked={value[row.id]?.[column.id] === true}
                      disabled={locked}
                      onCheckedChange={(checked) => {
                        if (!locked) onToggle(row.id, column.id, checked === true);
                      }}
                    />
                  </td>
                ))
              )}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
