import { render, screen } from '@testing-library/react';
import { Users } from 'lucide-react';
import { describe, expect, it } from 'vitest';

import { Kpi } from './Kpi';

describe('Kpi', () => {
  it('pairs the label with its value and comparison as a description list', () => {
    render(<Kpi label="Present today" value="1,204" delta="+2% on last week" icon={Users} />);
    expect(screen.getByRole('term')).toHaveTextContent('Present today');
    expect(screen.getAllByRole('definition').map((item) => item.textContent)).toEqual([
      '1,204',
      '+2% on last week',
    ]);
  });

  it('leaves out the comparison when there is none, and hides the icon from screen readers', () => {
    const { container } = render(<Kpi label="Overdue" value="12" icon={Users} tone="bad" />);
    expect(screen.getAllByRole('definition')).toHaveLength(1);
    expect(container.querySelector('svg')).toHaveAttribute('aria-hidden', 'true');
    expect(container.querySelector('svg')?.parentElement).toHaveClass('bg-bad-soft');
  });
});
