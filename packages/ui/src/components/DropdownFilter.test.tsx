import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { GraduationCap } from 'lucide-react';
import { describe, expect, it, vi } from 'vitest';

import { DropdownFilter, type DropdownFilterOption } from './DropdownFilter';

const options: DropdownFilterOption[] = [
  { value: 'p1', label: 'Primary 1', count: 24, group: 'Primary' },
  { value: 'p2', label: 'Primary 2', count: 0, group: 'Primary' },
  { value: 's1', label: 'Senior 1', count: 31, group: 'Senior' },
];

function setup(props: Partial<React.ComponentProps<typeof DropdownFilter>> = {}) {
  const onChange = vi.fn();
  const onClear = vi.fn();
  render(
    <DropdownFilter
      label="Year group"
      icon={GraduationCap}
      options={options}
      value={null}
      onChange={onChange}
      onClear={onClear}
      {...props}
    />,
  );
  return { onChange, onClear };
}

describe('DropdownFilter', () => {
  it('is a listbox trigger showing only the label while inactive', () => {
    setup();
    const trigger = screen.getByRole('button', { name: /^Year group/ });
    expect(trigger).toHaveAttribute('aria-haspopup', 'listbox');
    expect(screen.queryByRole('button', { name: 'Clear Year group' })).not.toBeInTheDocument();
  });

  it('shows the active value and a clear button labelled "Clear {label}"', async () => {
    const { onClear } = setup({ value: 's1' });
    expect(screen.getByRole('button', { name: /^Year group/ })).toHaveTextContent('Senior 1');
    await userEvent.click(screen.getByRole('button', { name: 'Clear Year group' }));
    expect(onClear).toHaveBeenCalledOnce();
  });

  it('lists options with counts and groups, marks the selected one and picks on click', async () => {
    const { onChange } = setup({ value: 'p1' });
    await userEvent.click(screen.getByRole('button', { name: /^Year group/ }));
    const listbox = await screen.findByRole('listbox', { name: 'Year group' });
    expect(within(listbox).getByRole('group', { name: 'Primary' })).toBeInTheDocument();
    expect(within(listbox).getByRole('group', { name: 'Senior' })).toBeInTheDocument();
    const selected = within(listbox).getByRole('option', { name: /Primary 1/ });
    expect(selected).toHaveAttribute('aria-selected', 'true');
    expect(selected).toHaveTextContent('24');
    await userEvent.click(within(listbox).getByRole('option', { name: /Senior 1/ }));
    expect(onChange).toHaveBeenCalledWith('s1');
    expect(screen.queryByRole('listbox')).not.toBeInTheDocument();
  });

  it('filters options when searchable and shows an empty message', async () => {
    setup({ searchable: true });
    await userEvent.click(screen.getByRole('button', { name: /^Year group/ }));
    const search = await screen.findByRole('searchbox', { name: 'Search Year group' });
    await userEvent.type(search, 'sen');
    expect(screen.getAllByRole('option')).toHaveLength(1);
    expect(screen.getByRole('option', { name: /Senior 1/ })).toBeInTheDocument();
    expect(screen.queryByRole('group', { name: 'Primary' })).not.toBeInTheDocument();
    await userEvent.clear(search);
    await userEvent.type(search, 'zzz');
    expect(screen.queryAllByRole('option')).toHaveLength(0);
    expect(screen.getByText('No results')).toBeInTheDocument();
  });

  it('supports the keyboard: arrows move, Enter picks', async () => {
    const { onChange } = setup({ searchable: true });
    await userEvent.click(screen.getByRole('button', { name: /^Year group/ }));
    await screen.findByRole('searchbox');
    await userEvent.keyboard('{ArrowDown}');
    expect(screen.getByRole('option', { name: /Primary 1/ })).toHaveFocus();
    await userEvent.keyboard('{ArrowDown}{Enter}');
    expect(onChange).toHaveBeenCalledWith('p2');
  });

  it('takes its text from props', () => {
    setup({ value: 'p1', clearLabel: 'Remove year group filter' });
    expect(screen.getByRole('button', { name: 'Remove year group filter' })).toBeInTheDocument();
  });
});
