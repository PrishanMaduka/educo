import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { Checkbox } from './Checkbox';
import { Switch } from './Switch';

describe('Switch', () => {
  it('toggles and is named by its label', async () => {
    const onCheckedChange = vi.fn();
    render(<Switch label="Send reminders" checked={false} onCheckedChange={onCheckedChange} />);
    const control = screen.getByRole('switch', { name: 'Send reminders' });
    expect(control).not.toBeChecked();
    await userEvent.click(control);
    expect(onCheckedChange).toHaveBeenCalledWith(true);
  });
});

describe('Checkbox', () => {
  it('toggles and is named by its label or aria-label', async () => {
    const onCheckedChange = vi.fn();
    render(
      <Checkbox
        aria-label="Select Amaya Perera"
        checked={false}
        onCheckedChange={onCheckedChange}
      />,
    );
    await userEvent.click(screen.getByRole('checkbox', { name: 'Select Amaya Perera' }));
    expect(onCheckedChange).toHaveBeenCalledWith(true);
  });

  it('shows the mixed state', () => {
    render(<Checkbox label="Select all" checked="indeterminate" onCheckedChange={() => {}} />);
    expect(screen.getByRole('checkbox', { name: 'Select all' })).toBePartiallyChecked();
  });
});

describe('Checkbox and Switch inside a form', () => {
  // Radix adds a hidden, absolutely placed input beside the control inside a <form>. Its box must
  // be positioned, or the input escapes a scrolling table and widens the page (Task 21, 390 px).
  it('keep the hidden form input inside a positioned wrapper', () => {
    const { container } = render(
      <form>
        <Checkbox aria-label="View in Fees" checked={false} onCheckedChange={() => {}} />
        <Switch aria-label="Export data" checked={false} onCheckedChange={() => {}} />
      </form>,
    );
    const hidden = container.querySelectorAll('input[aria-hidden="true"]');
    expect(hidden).toHaveLength(2);
    for (const input of Array.from(hidden)) {
      expect(input.parentElement?.className).toMatch(/(^|\s)relative(\s|$)/);
    }
  });
});
