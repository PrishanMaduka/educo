import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { Table, type TableColumn } from './Table';

interface Row {
  id: string;
  name: string;
  gpa: number;
  note: string;
}

const rows: Row[] = [
  { id: '1', name: 'Hasini', gpa: 3.2, note: 'a' },
  { id: '2', name: 'Amaya', gpa: 3.9, note: 'b' },
  { id: '3', name: 'Kavindu', gpa: 2.8, note: 'c' },
];

const columns: TableColumn<Row>[] = [
  { key: 'name', header: 'Student', sortable: true },
  { key: 'gpa', header: 'GPA', sortable: true, align: 'right' },
  { key: 'note', header: 'Note', hideBelow: 'md' },
];

function names(): string[] {
  return screen
    .getAllByRole('row')
    .slice(1)
    .map((r) => within(r).getAllByRole('cell')[0]?.textContent ?? '');
}

describe('Table', () => {
  it('sorts by a column when its header button is pressed, then reverses', async () => {
    render(
      <Table
        caption="Students"
        columns={columns}
        rows={rows}
        getRowId={(r) => r.id}
        rowLabel={(r) => r.name}
      />,
    );
    expect(names()).toEqual(['Hasini', 'Amaya', 'Kavindu']);
    const header = screen.getByRole('columnheader', { name: /Student/ });
    expect(header).toHaveAttribute('aria-sort', 'none');
    await userEvent.click(screen.getByRole('button', { name: /Student/ }));
    expect(names()).toEqual(['Amaya', 'Hasini', 'Kavindu']);
    expect(header).toHaveAttribute('aria-sort', 'ascending');
    await userEvent.click(screen.getByRole('button', { name: /Student/ }));
    expect(names()).toEqual(['Kavindu', 'Hasini', 'Amaya']);
    expect(header).toHaveAttribute('aria-sort', 'descending');
  });

  it('sorts numbers numerically', async () => {
    render(
      <Table
        caption="Students"
        columns={columns}
        rows={rows}
        getRowId={(r) => r.id}
        rowLabel={(r) => r.name}
      />,
    );
    await userEvent.click(screen.getByRole('button', { name: /GPA/ }));
    expect(names()).toEqual(['Kavindu', 'Hasini', 'Amaya']);
  });

  it('has no sort button on columns that are not sortable', () => {
    render(
      <Table
        caption="Students"
        columns={columns}
        rows={rows}
        getRowId={(r) => r.id}
        rowLabel={(r) => r.name}
      />,
    );
    expect(screen.queryByRole('button', { name: /Note/ })).not.toBeInTheDocument();
  });

  it('hides columns progressively with breakpoint classes', () => {
    render(
      <Table
        caption="Students"
        columns={columns}
        rows={rows}
        getRowId={(r) => r.id}
        rowLabel={(r) => r.name}
      />,
    );
    expect(screen.getByRole('columnheader', { name: 'Note' })).toHaveClass(
      'hidden',
      'md:table-cell',
    );
  });

  it('selects rows with labelled checkboxes and select all', async () => {
    const onSelectionChange = vi.fn();
    render(
      <Table
        caption="Students"
        columns={columns}
        rows={rows}
        getRowId={(r) => r.id}
        rowLabel={(r) => r.name}
        selectable
        selectedIds={new Set(['2'])}
        onSelectionChange={onSelectionChange}
      />,
    );
    expect(screen.getByRole('checkbox', { name: 'Select Amaya' })).toBeChecked();
    expect(screen.getByRole('checkbox', { name: 'Select all rows' })).toBePartiallyChecked();
    await userEvent.click(screen.getByRole('checkbox', { name: 'Select Hasini' }));
    expect(onSelectionChange).toHaveBeenLastCalledWith(new Set(['2', '1']));
    await userEvent.click(screen.getByRole('checkbox', { name: 'Select all rows' }));
    expect(onSelectionChange).toHaveBeenLastCalledWith(new Set(['1', '2', '3']));
  });

  it('opens a row with click and keyboard, but not when ticking its checkbox', async () => {
    const onRowClick = vi.fn();
    render(
      <Table
        caption="Students"
        columns={columns}
        rows={rows}
        getRowId={(r) => r.id}
        rowLabel={(r) => r.name}
        selectable
        selectedIds={new Set()}
        onSelectionChange={() => {}}
        onRowClick={onRowClick}
      />,
    );
    await userEvent.click(screen.getByRole('checkbox', { name: 'Select Amaya' }));
    expect(onRowClick).not.toHaveBeenCalled();
    await userEvent.click(screen.getByText('Amaya'));
    expect(onRowClick).toHaveBeenLastCalledWith(rows[1]);
    const row = screen.getByRole('row', { name: /Kavindu/ });
    row.focus();
    await userEvent.keyboard('{Enter}');
    expect(onRowClick).toHaveBeenLastCalledWith(rows[2]);
  });

  it('shows the empty slot when there are no rows', () => {
    render(
      <Table
        caption="Students"
        columns={columns}
        rows={[]}
        getRowId={(r) => r.id}
        rowLabel={(r) => r.name}
        empty={<p>No students yet</p>}
      />,
    );
    expect(screen.getByText('No students yet')).toBeInTheDocument();
  });
});
