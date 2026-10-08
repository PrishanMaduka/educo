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
