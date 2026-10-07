import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { describe, expect, it, vi } from 'vitest';

import { CommandPalette } from './CommandPalette';

const onSelect = vi.fn();
const groups = [
  {
    label: 'Students',
    items: [
      { id: 'a', label: 'Amara Perera', hint: 'Year 7', onSelect },
      { id: 'b', label: 'Ben Silva', onSelect },
    ],
  },
  { label: 'Pages', items: [{ id: 'c', label: 'Timetable', onSelect }] },
];

describe('CommandPalette', () => {
  it('opens on Ctrl K and on Cmd K', async () => {
    const user = userEvent.setup();
    render(<CommandPalette groups={groups} />);
    expect(screen.queryByRole('combobox')).not.toBeInTheDocument();
    await user.keyboard('{Control>}k{/Control}');
    expect(screen.getByRole('combobox')).toHaveFocus();
    await user.keyboard('{Escape}');
    expect(screen.queryByRole('combobox')).not.toBeInTheDocument();
    await user.keyboard('{Meta>}k{/Meta}');
    expect(screen.getByRole('combobox')).toBeInTheDocument();
  });

  it('works controlled and reports open changes', async () => {
    const user = userEvent.setup();
    const onOpenChange = vi.fn();
    render(<CommandPalette open={false} onOpenChange={onOpenChange} groups={groups} />);
    await user.keyboard('{Control>}k{/Control}');
    expect(onOpenChange).toHaveBeenCalledWith(true);
    expect(screen.queryByRole('combobox')).not.toBeInTheDocument();
  });

  it('lists grouped options with combobox and listbox semantics', async () => {
    const user = userEvent.setup();
    render(<CommandPalette groups={groups} placeholder="Find anything" />);
    await user.keyboard('{Control>}k{/Control}');
    const input = screen.getByRole('combobox');
    expect(input).toHaveAttribute('placeholder', 'Find anything');
    expect(input).toHaveAttribute('aria-expanded', 'true');
    const list = screen.getByRole('listbox');
    expect(input).toHaveAttribute('aria-controls', list.id);
    expect(screen.getAllByRole('option')).toHaveLength(3);
    expect(screen.getByRole('group', { name: 'Students' })).toBeInTheDocument();
    expect(screen.getByText('Year 7')).toBeInTheDocument();
    expect(input.getAttribute('aria-activedescendant')).toBe(screen.getAllByRole('option')[0]?.id);
  });

  it('filters as you type and says when nothing matches', async () => {
    const user = userEvent.setup();
    render(<CommandPalette groups={groups} />);
    await user.keyboard('{Control>}k{/Control}');
    await user.keyboard('tim');
    expect(screen.getAllByRole('option')).toHaveLength(1);
    expect(screen.queryByRole('group', { name: 'Students' })).not.toBeInTheDocument();
    await user.clear(screen.getByRole('combobox'));
    await user.keyboard('zzz');
    expect(screen.queryByRole('option')).not.toBeInTheDocument();
    expect(screen.getByText('No results')).toBeInTheDocument();
  });

  it('moves with the arrow keys and selects with Enter, then closes', async () => {
    const user = userEvent.setup();
    onSelect.mockClear();
    const picked = vi.fn();
    const g = [
      {
        label: 'X',
        items: [
          {
            id: '1',
            label: 'One',
            onSelect: () => {
              picked('1');
            },
          },
          {
            id: '2',
            label: 'Two',
            onSelect: () => {
              picked('2');
            },
          },
        ],
      },
    ];
    render(<CommandPalette groups={g} />);
    await user.keyboard('{Control>}k{/Control}');
    await user.keyboard('{ArrowDown}');
    const input = screen.getByRole('combobox');
    expect(screen.getByRole('option', { name: 'Two' })).toHaveAttribute('aria-selected', 'true');
    expect(input.getAttribute('aria-activedescendant')).toBe(
      screen.getByRole('option', { name: 'Two' }).id,
    );
    await user.keyboard('{ArrowDown}');
    expect(screen.getByRole('option', { name: 'One' })).toHaveAttribute('aria-selected', 'true');
    await user.keyboard('{ArrowUp}{Enter}');
    expect(picked).toHaveBeenCalledWith('2');
    expect(screen.queryByRole('combobox')).not.toBeInTheDocument();
  });

  it('selects with a click', async () => {
    const user = userEvent.setup();
    const picked = vi.fn();
    function Wrapper() {
      const [open, setOpen] = useState(true);
      return (
        <CommandPalette
          open={open}
          onOpenChange={setOpen}
          groups={[{ label: 'X', items: [{ id: '1', label: 'One', onSelect: picked }] }]}
        />
      );
    }
    render(<Wrapper />);
    await user.click(screen.getByRole('option', { name: 'One' }));
    expect(picked).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole('combobox')).not.toBeInTheDocument();
  });
});
