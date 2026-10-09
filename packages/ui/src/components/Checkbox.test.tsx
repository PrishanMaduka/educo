import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { Checkbox } from './Checkbox';

describe('Checkbox', () => {
  it('is named by its visible label, and toggles from the label too', async () => {
    const onCheckedChange = vi.fn();
    render(<Checkbox label="Remember my choice" onCheckedChange={onCheckedChange} />);
    const box = screen.getByRole('checkbox', { name: 'Remember my choice' });
    expect(box).toHaveAttribute('aria-checked', 'false');
    await userEvent.click(screen.getByText('Remember my choice'));
    expect(onCheckedChange).toHaveBeenLastCalledWith(true);
    expect(box).toHaveAttribute('aria-checked', 'true');
  });

  it('shows a mixed state, and takes an aria-label when there is no visible label', () => {
    render(<Checkbox aria-label="Select all rows" checked="indeterminate" />);
    expect(screen.getByRole('checkbox', { name: 'Select all rows' })).toHaveAttribute(
      'aria-checked',
      'mixed',
    );
  });

  it('cannot be ticked when disabled', async () => {
    const onCheckedChange = vi.fn();
    render(<Checkbox label="Locked" disabled onCheckedChange={onCheckedChange} />);
    await userEvent.click(screen.getByRole('checkbox', { name: 'Locked' }));
    expect(onCheckedChange).not.toHaveBeenCalled();
  });
});
