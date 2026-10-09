import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { Pill } from './Pill';

describe('Pill', () => {
  it('shows its text in ink on the tone’s soft colour, with a decorative status dot', () => {
    const { container } = render(<Pill tone="good">Paid</Pill>);
    const pill = screen.getByText('Paid');
    expect(pill).toHaveClass('bg-good-soft', 'text-ink');
    const dot = container.querySelector('[aria-hidden="true"]');
    expect(dot).toHaveClass('bg-good');
  });

  it('is neutral by default and drops the dot when plain', () => {
    const { container } = render(<Pill plain>Draft</Pill>);
    expect(screen.getByText('Draft')).toHaveClass('bg-surface-2');
    expect(container.querySelector('[aria-hidden="true"]')).toBeNull();
  });
});
