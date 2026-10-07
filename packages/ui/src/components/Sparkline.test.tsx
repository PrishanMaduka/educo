import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { Sparkline } from './Sparkline';

describe('Sparkline', () => {
  it('is a labelled 64 by 24 image', () => {
    render(<Sparkline values={[1, 2, 3]} trend="up" label="Attendance rising" />);
    const svg = screen.getByRole('img', { name: 'Attendance rising' });
    expect(svg).toHaveAttribute('viewBox', '0 0 64 24');
    expect(svg).toHaveAttribute('width', '64');
    expect(svg).toHaveAttribute('height', '24');
  });

  it('uses the good colour going up and the bad colour going down', () => {
    const up = render(<Sparkline values={[1, 2]} trend="up" label="a" />);
    expect(screen.getByRole('img')).toHaveClass('text-good');
    up.unmount();
    render(<Sparkline values={[2, 1]} trend="down" label="b" />);
    expect(screen.getByRole('img')).toHaveClass('text-bad');
  });

  it('marks the end point at the last value', () => {
    const { container } = render(<Sparkline values={[0, 10, 5]} trend="up" label="x" />);
    const dot = container.querySelector('circle');
    expect(dot).not.toBeNull();
    expect(Number(dot?.getAttribute('cx'))).toBe(62);
    const points = container.querySelector('polyline')?.getAttribute('points')?.split(' ') ?? [];
    expect(points).toHaveLength(3);
    expect(points[2]).toBe(`${dot?.getAttribute('cx')},${dot?.getAttribute('cy')}`);
  });

  it('puts higher values higher up', () => {
    const { container } = render(<Sparkline values={[0, 10]} trend="up" label="x" />);
    const [a, b] = (container.querySelector('polyline')?.getAttribute('points') ?? '')
      .split(' ')
      .map((p) => Number(p.split(',')[1]));
    expect(b).toBeLessThan(a ?? 0);
  });

  it('copes with a single value and a flat series', () => {
    const one = render(<Sparkline values={[4]} trend="up" label="one" />);
    expect(one.container.querySelector('circle')).not.toBeNull();
    one.unmount();
    const flat = render(<Sparkline values={[3, 3, 3]} trend="down" label="flat" />);
    expect(flat.container.innerHTML).not.toContain('NaN');
    flat.unmount();
    const empty = render(<Sparkline values={[]} trend="up" label="none" />);
    expect(empty.container.querySelector('circle')).toBeNull();
  });
});
