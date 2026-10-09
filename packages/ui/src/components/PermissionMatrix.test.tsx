import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { PermissionMatrix } from './PermissionMatrix';

const columns = [
  { id: 'view', label: 'View' },
  { id: 'create', label: 'Create' },
];
const rows = [
  { id: 'fees', label: 'Fees & invoicing' },
  { id: 'transport', label: 'Transport', notInPlan: true },
];
const value = {
  fees: { view: true, create: false },
  transport: { view: true, create: true },
};

describe('PermissionMatrix', () => {
  it('shows a named checkbox per module and action, and reports a click', async () => {
    const onToggle = vi.fn();
    render(
      <PermissionMatrix
        caption="What Teacher can do"
        rows={rows}
        columns={columns}
        value={value}
        onToggle={onToggle}
      />,
    );
    expect(screen.getByRole('table', { name: 'What Teacher can do' })).toBeInTheDocument();
    expect(screen.getByRole('checkbox', { name: 'View in Fees & invoicing' })).toBeChecked();
    await userEvent.click(screen.getByRole('checkbox', { name: 'Create in Fees & invoicing' }));
    expect(onToggle).toHaveBeenCalledWith('fees', 'create', true);
  });

  it('shows a module outside the plan as Not in plan, with nothing to tick', () => {
    render(
      <PermissionMatrix
        caption="Matrix"
        rows={rows}
        columns={columns}
        value={value}
        onToggle={vi.fn()}
      />,
    );
    const row = screen.getByRole('row', { name: /Transport/ });
    expect(within(row).getByText('Not in plan')).toBeInTheDocument();
    expect(within(row).queryByRole('checkbox')).toBeNull();
  });

  it('locks every box when read only', async () => {
    const onToggle = vi.fn();
    render(
      <PermissionMatrix
        caption="Matrix"
        rows={rows}
        columns={columns}
        value={value}
        readOnly
        onToggle={onToggle}
      />,
    );
    const box = screen.getByRole('checkbox', { name: 'View in Fees & invoicing' });
    expect(box).toBeDisabled();
    await userEvent.click(box);
    expect(onToggle).not.toHaveBeenCalled();
  });

  it('takes its labels from the caller', () => {
    render(
      <PermissionMatrix
        caption="Matrix"
        rows={rows}
        columns={columns}
        value={value}
        moduleHeader="Bereich"
        notInPlanLabel="Nicht im Plan"
        cellLabel={(action, module) => `${module}: ${action}`}
      />,
    );
    expect(screen.getByRole('columnheader', { name: 'Bereich' })).toBeInTheDocument();
    expect(screen.getByText('Nicht im Plan')).toBeInTheDocument();
    expect(screen.getByRole('checkbox', { name: 'Fees & invoicing: View' })).toBeDisabled();
  });

  it('can be scrolled from the keyboard on a narrow screen, even when every box is locked', () => {
    render(
      <PermissionMatrix caption="Matrix" rows={rows} columns={columns} value={value} readOnly />,
    );
    const scroller = screen.getByRole('group', { name: 'Matrix' });
    expect(scroller).toHaveAttribute('tabindex', '0');
    expect(within(scroller).getByRole('table')).toBeInTheDocument();
  });
});
