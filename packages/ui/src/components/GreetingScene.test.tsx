import { render } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { GreetingScene } from './GreetingScene';

import type { GreetingPeriod } from '@quad/contracts';

const periods: GreetingPeriod[] = ['morning', 'afternoon', 'evening', 'night'];

describe('GreetingScene', () => {
  for (const period of periods) {
    it(`renders the ${period} scene as a hidden decorative svg`, () => {
      const { container } = render(<GreetingScene period={period} className="extra" />);
      const svg = container.querySelector('svg');
      expect(svg).not.toBeNull();
      expect(svg).toHaveClass(`gs-${period}`, 'extra');
      expect(svg).toHaveAttribute('aria-hidden', 'true');
      expect(svg).toHaveAttribute('focusable', 'false');
      expect(svg).toHaveAttribute('preserveAspectRatio', 'xMaxYMax slice');
      expect(svg).toHaveAttribute('viewBox', '0 0 1200 320');
    });
  }

  it('draws stars only at night', () => {
    const night = render(<GreetingScene period="night" />);
    expect(night.container.querySelectorAll('.gs-star')).toHaveLength(12);
    night.unmount();
    const morning = render(<GreetingScene period="morning" />);
    expect(morning.container.querySelectorAll('.gs-star')).toHaveLength(0);
  });

  it('draws the period elements', () => {
    const q = (p: GreetingPeriod, sel: string) =>
      render(<GreetingScene period={p} />).container.querySelectorAll(sel).length;
    expect(q('morning', 'path[d^="M842 92"]')).toBe(1); // birds
    expect(q('afternoon', 'ellipse')).toBe(3); // clouds
    expect(q('afternoon', 'circle[stroke-dasharray]')).toBe(1); // dotted halo
    expect(q('evening', 'clipPath')).toBe(1);
    expect(q('night', 'mask')).toBe(1);
  });

  it('colours from CSS variables, never hex', () => {
    for (const period of periods) {
      const { container, unmount } = render(<GreetingScene period={period} />);
      expect(container.innerHTML).toMatch(/var\(--quad-c[1-5]\)/);
      expect(container.innerHTML).toContain('var(--quad-surface)');
      expect(container.innerHTML).toContain('color-mix(');
      expect(container.innerHTML).not.toMatch(/#[0-9a-fA-F]{3,6}\b/);
      unmount();
    }
  });

  it('gives every instance its own gradient, mask and clip ids', () => {
    const { container } = render(
      <>
        <GreetingScene period="night" />
        <GreetingScene period="night" />
      </>,
    );
    const ids = [...container.querySelectorAll('[id]')].map((el) => el.id);
    expect(ids.length).toBeGreaterThan(0);
    expect(new Set(ids).size).toBe(ids.length);
    for (const id of ids) expect(container.innerHTML).toContain(`#${id})`);
  });
});
