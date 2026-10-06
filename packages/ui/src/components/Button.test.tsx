import { colors, contrastRatio } from '@quad/tokens';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Plus } from 'lucide-react';
import { describe, expect, it, vi } from 'vitest';

import { Button } from './Button';

describe('Button', () => {
  it('renders the danger variant with the bad background', () => {
    render(<Button variant="danger">Delete invoice</Button>);
    expect(screen.getByRole('button', { name: 'Delete invoice' })).toHaveClass('bg-bad');
  });

  it('uses the AA-safe brand fill for primary, never bg-brand', () => {
    render(<Button>Save plan</Button>);
    const button = screen.getByRole('button', { name: 'Save plan' });
    expect(button).toHaveClass('bg-brand-fill', 'text-brand-ink', 'hover:bg-brand-fill-strong');
    expect(button).not.toHaveClass('bg-brand');
  });

  it('keeps text readable on every filled variant in both themes', () => {
    for (const theme of ['light', 'dark'] as const) {
      const set = colors[theme] as Record<string, string>;
      expect(contrastRatio(set['brand-ink']!, set['brand-fill']!)).toBeGreaterThanOrEqual(4.5);
      expect(contrastRatio(set['brand-ink']!, set['brand-fill-strong']!)).toBeGreaterThanOrEqual(
        4.5,
      );
      expect(contrastRatio(set.surface!, set.bad!)).toBeGreaterThanOrEqual(4.5);
    }
  });

  it('supports sizes, a decorative icon and click handling', async () => {
    const onClick = vi.fn();
    render(
      <Button size="sm" icon={Plus} onClick={onClick}>
        Add student
      </Button>,
    );
    const button = screen.getByRole('button', { name: 'Add student' });
    expect(button).toHaveClass('h-[30px]');
    expect(button.querySelector('svg')).toHaveAttribute('aria-hidden', 'true');
    await userEvent.click(button);
    expect(onClick).toHaveBeenCalledOnce();
  });

  it('is a plain button by default so it never submits a form by accident', () => {
    render(<Button>Cancel</Button>);
    expect(screen.getByRole('button')).toHaveAttribute('type', 'button');
  });
});
