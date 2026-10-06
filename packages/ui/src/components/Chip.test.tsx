import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { Chip } from './Chip';
import { Pill } from './Pill';

describe('Chip', () => {
  it('is a toggle button with a count', async () => {
    const onClick = vi.fn();
    render(
      <Chip selected count={12} onClick={onClick}>
        Overdue
      </Chip>,
    );
    const chip = screen.getByRole('button', { name: /Overdue/ });
    expect(chip).toHaveAttribute('aria-pressed', 'true');
    expect(chip).toHaveTextContent('12');
    expect(chip).toHaveClass('bg-brand-fill');
    await userEvent.click(chip);
    expect(onClick).toHaveBeenCalledOnce();
  });
});

describe('Pill', () => {
  it('shows the status text with a tone', () => {
    render(<Pill tone="good">Paid</Pill>);
    expect(screen.getByText('Paid')).toHaveClass('bg-good-soft');
  });
});
