'use client';

import { ArrowDown, ArrowUp, ArrowUpDown } from 'lucide-react';
import { useMemo, useState, type KeyboardEvent, type MouseEvent, type ReactNode } from 'react';

import { cn } from '../lib/cn';
import { fill, uiText } from '../lib/defaults';
import { focusRing, ICON_STROKE, transition } from '../lib/motion';

import { Checkbox } from './Checkbox';

export type TableBreakpoint = 'sm' | 'md' | 'lg';

export interface TableColumn<Row> {
  /** Field of the row to show, unless `cell` is given. Also the sort key. */
  key: string;
  header: string;
  /** Custom cell content. */
  cell?: (row: Row) => ReactNode;
  /** Value to sort by when it differs from `row[key]`. */
  sortValue?: (row: Row) => string | number | null | undefined;
  sortable?: boolean;
  align?: 'left' | 'right';
  /** Hide this column below the breakpoint, so phones keep the important columns. */
  hideBelow?: TableBreakpoint;
  className?: string;
}

export interface TableProps<Row> {
  /** Names the table for screen readers. Not shown. */
  caption: string;
  columns: readonly TableColumn<Row>[];
  rows: readonly Row[];
  getRowId: (row: Row) => string;
  /** Short name of a row, used in "Select {label}". */
  rowLabel: (row: Row) => string;
  selectable?: boolean;
  selectedIds?: ReadonlySet<string>;
  onSelectionChange?: (ids: Set<string>) => void;
  onRowClick?: (row: Row) => void;
  /** Shown instead of rows when there are none. */
  empty?: ReactNode;
  /** Shown under the table, for example a count or paging. */
  footer?: ReactNode;
  selectAllLabel?: string;
  selectRowLabel?: (label: string) => string;
  className?: string;
}

type Direction = 'asc' | 'desc';

const hide: Record<TableBreakpoint, string> = {
  sm: 'hidden sm:table-cell',
  md: 'hidden md:table-cell',
  lg: 'hidden lg:table-cell',
};

function compare(
  a: string | number | null | undefined,
  b: string | number | null | undefined,
): number {
  const aMissing = a === null || a === undefined || a === '';
  const bMissing = b === null || b === undefined || b === '';
  if (aMissing || bMissing) return Number(aMissing) - Number(bMissing);
  if (typeof a === 'number' && typeof b === 'number') return a - b;
  return String(a).localeCompare(String(b), undefined, { numeric: true, sensitivity: 'base' });
}

function valueOf<Row>(column: TableColumn<Row>, row: Row): string | number | null | undefined {
  if (column.sortValue) return column.sortValue(row);
  const raw = (row as Record<string, unknown>)[column.key];
  return typeof raw === 'string' || typeof raw === 'number' ? raw : null;
}

const interactive = 'button, a, input, select, textarea, [role="checkbox"], [role="switch"]';

export function Table<Row>({
  caption,
  columns,
  rows,
  getRowId,
  rowLabel,
  selectable = false,
  selectedIds,
  onSelectionChange,
  onRowClick,
  empty,
  footer,
  selectAllLabel = uiText['ui.table.selectAll'],
  selectRowLabel = (label) => fill(uiText['ui.table.selectRow'], { label }),
  className,
}: TableProps<Row>) {
  const [sort, setSort] = useState<{ key: string; dir: Direction } | null>(null);

  const sorted = useMemo(() => {
    const column = sort ? columns.find((c) => c.key === sort.key) : undefined;
    if (!sort || !column) return rows;
    const factor = sort.dir === 'asc' ? 1 : -1;
    return rows
      .map((row, index) => ({ row, index }))
      .sort(
        (a, b) =>
          factor * compare(valueOf(column, a.row), valueOf(column, b.row)) || a.index - b.index,
      )
      .map((entry) => entry.row);
  }, [rows, columns, sort]);

  const toggleSort = (key: string): void => {
    setSort((current) => {
      if (current?.key !== key) return { key, dir: 'asc' };
      return current.dir === 'asc' ? { key, dir: 'desc' } : null;
    });
  };

  const selected = selectedIds ?? new Set<string>();
  const allSelected = rows.length > 0 && rows.every((r) => selected.has(getRowId(r)));
  const someSelected = rows.some((r) => selected.has(getRowId(r)));

  const toggleAll = (): void => {
    onSelectionChange?.(allSelected ? new Set() : new Set(rows.map(getRowId)));
  };
  const toggleRow = (id: string, checked: boolean): void => {
    const next = new Set(selected);
    if (checked) next.add(id);
    else next.delete(id);
    onSelectionChange?.(next);
  };

  const openRow = (event: MouseEvent<HTMLTableRowElement>, row: Row): void => {
    if ((event.target as HTMLElement).closest(interactive)) return;
    onRowClick?.(row);
  };
  const rowKey = (event: KeyboardEvent<HTMLTableRowElement>, row: Row): void => {
    if (event.target !== event.currentTarget) return;
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      onRowClick?.(row);
    }
  };

  const cellBase = 'px-3.5';
  return (
    <div className={cn('min-w-0', className)}>
      <div className="overflow-x-auto">
        <table className="w-full border-collapse text-[13px] text-ink">
          <caption className="sr-only">{caption}</caption>
          <thead>
            <tr className="max-sm:h-11">
              {selectable ? (
                <th
                  scope="col"
                  className={cn(cellBase, 'w-10 border-b border-line bg-surface-2 py-2.5')}
                >
                  <Checkbox
                    aria-label={selectAllLabel}
                    checked={allSelected ? true : someSelected ? 'indeterminate' : false}
                    onCheckedChange={toggleAll}
                  />
                </th>
              ) : null}
              {columns.map((column) => {
                const dir = sort?.key === column.key ? sort.dir : null;
                const SortIcon = dir === 'asc' ? ArrowUp : dir === 'desc' ? ArrowDown : ArrowUpDown;
                return (
                  <th
                    key={column.key}
                    scope="col"
                    aria-sort={
                      column.sortable
                        ? dir === 'asc'
                          ? 'ascending'
                          : dir === 'desc'
                            ? 'descending'
                            : 'none'
                        : undefined
                    }
                    className={cn(
                      cellBase,
                      'border-b border-line bg-surface-2 py-2.5 text-[11.5px] font-bold tracking-[0.04em] whitespace-nowrap text-ink-2 uppercase',
                      column.align === 'right' ? 'text-right' : 'text-left',
                      column.hideBelow && hide[column.hideBelow],
                    )}
                  >
                    {column.sortable ? (
                      <button
                        type="button"
                        onClick={() => {
                          toggleSort(column.key);
                        }}
                        className={cn(
                          '-mx-1 inline-flex cursor-pointer items-center gap-1 rounded-md px-1 font-bold tracking-[0.04em] uppercase hover:text-ink max-sm:min-h-11',
                          transition,
                          focusRing,
                        )}
                      >
                        {column.header}
                        <SortIcon
                          aria-hidden="true"
                          strokeWidth={ICON_STROKE}
                          className={cn('size-3.5', dir ? 'text-ink' : 'text-ink-3')}
                        />
                      </button>
                    ) : (
                      column.header
                    )}
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody>
            {sorted.map((row) => {
              const id = getRowId(row);
              const label = rowLabel(row);
              const isSelected = selected.has(id);
              return (
                // The row is the click target for a mouse. Keyboard users get Enter and Space on the focused row.

                <tr
                  key={id}
                  tabIndex={onRowClick ? 0 : undefined}
                  onClick={
                    onRowClick
                      ? (event) => {
                          openRow(event, row);
                        }
                      : undefined
                  }
                  onKeyDown={
                    onRowClick
                      ? (event) => {
                          rowKey(event, row);
                        }
                      : undefined
                  }
                  className={cn(
                    'group max-sm:h-11',
                    onRowClick && [
                      'cursor-pointer hover:bg-surface-2',
                      focusRing,
                      'focus-visible:-outline-offset-2',
                    ],
                    isSelected && 'bg-brand-soft',
                  )}
                >
                  {selectable ? (
                    <td className={cn(cellBase, 'w-10 border-b border-line py-[11px]')}>
                      <Checkbox
                        aria-label={selectRowLabel(label)}
                        checked={isSelected}
                        onCheckedChange={(checked) => {
                          toggleRow(id, checked === true);
                        }}
                      />
                    </td>
                  ) : null}
                  {columns.map((column) => (
                    <td
                      key={column.key}
                      className={cn(
                        cellBase,
                        'border-b border-line py-[11px] align-middle',
                        column.align === 'right' && 'text-right tabular-nums',
                        column.hideBelow && hide[column.hideBelow],
                        column.className,
                      )}
                    >
                      {column.cell ? column.cell(row) : String(valueOf(column, row) ?? '')}
                    </td>
                  ))}
                </tr>
              );
            })}
            {rows.length === 0 && empty ? (
              <tr>
                <td colSpan={columns.length + (selectable ? 1 : 0)} className="px-3.5 py-6">
                  {empty}
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
      {footer ? (
        <div className="flex items-center gap-2.5 px-[18px] py-2.5 text-[12.5px] text-ink-2">
          {footer}
        </div>
      ) : null}
    </div>
  );
}
