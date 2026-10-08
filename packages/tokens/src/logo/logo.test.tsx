// @vitest-environment jsdom
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';

import { QuadLogo, QuadMark } from './index';

afterEach(cleanup);

describe('QuadMark', () => {
  it('is an accessible image named Quad', () => {
    render(<QuadMark />);
    const svg = screen.getByRole('img', { name: 'Quad' });
    expect(svg.getAttribute('viewBox')).toBe('0 0 64 64');
    expect(svg.querySelectorAll('rect')).toHaveLength(4);
  });

  it('uses the colour tiles by default and the white set on request', () => {
    const { container, rerender } = render(<QuadMark />);
    expect(container.innerHTML).toContain('#1F2559');
    expect(container.innerHTML).toContain('#E5534B');
    rerender(<QuadMark variant="white" />);
    expect(container.innerHTML).toContain('#C9C4F5');
    expect(container.innerHTML).toContain('#FF7A6E');
    expect(container.innerHTML).not.toContain('#1F2559');
  });

  it('sizes the mark and accepts a title', () => {
    render(<QuadMark size={40} title="Quad school platform" />);
    const svg = screen.getByRole('img', { name: 'Quad school platform' });
    expect(svg.getAttribute('width')).toBe('40');
    expect(svg.getAttribute('height')).toBe('40');
  });
});

describe('QuadLogo', () => {
  it('draws the mark and the wordmark', () => {
    render(<QuadLogo />);
    const svg = screen.getByRole('img', { name: 'Quad' });
    expect(svg.getAttribute('viewBox')).toBe('-4 -4 292 86');
    expect(svg.querySelectorAll('circle')).toHaveLength(3);
  });

  it('keeps the aspect ratio when sized by height', () => {
    render(<QuadLogo size={43} />);
    const svg = screen.getByRole('img', { name: 'Quad' });
    expect(svg.getAttribute('height')).toBe('43');
    expect(svg.getAttribute('width')).toBe(String(Math.round((43 * 292) / 86)));
  });

  it('has a theme variant that reads the mark tokens and the text colour', () => {
    const { container } = render(<QuadLogo variant="theme" />);
    const fills = [...container.querySelectorAll('rect')].map((r) => r.getAttribute('fill'));
    expect(fills).toEqual([
      'var(--quad-mark-school)',
      'var(--quad-mark-people)',
      'var(--quad-mark-people)',
      'var(--quad-mark-students)',
    ]);
    expect(container.querySelector('g[stroke]')?.getAttribute('stroke')).toBe('currentColor');
  });

  it('has a white variant', () => {
    const { container } = render(<QuadLogo variant="white" />);
    expect(container.innerHTML).toContain('stroke="#FFFFFF"');
    expect(container.innerHTML).not.toContain('#1F2559');
  });
});
