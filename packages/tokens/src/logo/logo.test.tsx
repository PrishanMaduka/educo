// @vitest-environment jsdom
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';

import { QuadLogo, QuadMark } from './index';

afterEach(cleanup);

const fills = (container: HTMLElement) =>
  [...container.querySelectorAll('path')].map((p) => p.getAttribute('fill'));

describe('QuadMark', () => {
  it('is an accessible image named Quad with four petals', () => {
    render(<QuadMark />);
    const svg = screen.getByRole('img', { name: 'Quad' });
    expect(svg.getAttribute('viewBox')).toBe('0 0 30 30');
    expect(svg.querySelectorAll('path')).toHaveLength(4);
  });

  it('paints the petals sky, pink, lime and orange, or white in the mono mark', () => {
    const { container, rerender } = render(<QuadMark />);
    expect(fills(container)).toEqual(['#59C3FF', '#FF6FAE', '#C8F169', '#FF9B45']);
    rerender(<QuadMark variant="mono" />);
    expect(fills(container)).toEqual(['#FFFFFF', '#FFFFFF', '#FFFFFF', '#FFFFFF']);
  });

  it('sizes the mark and accepts a title', () => {
    render(<QuadMark size={40} title="Quad school platform" />);
    const svg = screen.getByRole('img', { name: 'Quad school platform' });
    expect(svg.getAttribute('width')).toBe('40');
    expect(svg.getAttribute('height')).toBe('40');
  });
});

describe('QuadLogo', () => {
  it('draws the mark and the navy wordmark', () => {
    const { container } = render(<QuadLogo />);
    const svg = screen.getByRole('img', { name: 'Quad' });
    expect(svg.getAttribute('viewBox')).toBe('0 0 101 30');
    expect(fills(container)).toEqual(['#59C3FF', '#FF6FAE', '#C8F169', '#FF9B45', '#101632']);
  });

  it('keeps the aspect ratio when sized by height', () => {
    render(<QuadLogo size={26} />);
    const svg = screen.getByRole('img', { name: 'Quad' });
    expect(svg.getAttribute('height')).toBe('26');
    expect(svg.getAttribute('width')).toBe(String(Math.round((26 * 101) / 30)));
  });

  it('has a cream wordmark on dark grounds, and a theme variant that reads the site tokens', () => {
    const { container, rerender } = render(<QuadLogo variant="white" />);
    expect(fills(container).at(-1)).toBe('#F7F5F0');
    rerender(<QuadLogo variant="theme" />);
    expect(fills(container)).toEqual([
      'var(--quad-site-sky)',
      'var(--quad-site-pink)',
      'var(--quad-site-lime)',
      'var(--quad-site-orange)',
      'currentColor',
    ]);
  });
});
