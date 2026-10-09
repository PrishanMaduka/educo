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
    expect(night.container.querySelectorAll('.gs-star')).toHaveLength(7);
    night.unmount();
    const morning = render(<GreetingScene period="morning" />);
    expect(morning.container.querySelectorAll('.gs-star')).toHaveLength(0);
  });

  it('draws the period elements', () => {
    const q = (p: GreetingPeriod, sel: string) =>
      render(<GreetingScene period={p} />).container.querySelectorAll(sel).length;
    expect(q('morning', 'path[d^="M330 120"]')).toBe(1); // birds
    expect(q('morning', 'path[d^="M0 -20L14 0"]')).toBe(1); // kite
    expect(q('afternoon', 'rect[rx="11"]')).toBe(2); // clouds
    expect(q('afternoon', 'circle[stroke-dasharray]')).toBe(1); // dashed ring
    expect(q('evening', 'path[d^="M560 70"]')).toBe(1); // heart
    expect(q('night', 'path.gs-body[d^="M34.71"]')).toBe(1); // crescent
  });

  it('is flat: solid fills, no gradients, masks, clips or opacity layers', () => {
    for (const period of periods) {
      const { container, unmount } = render(<GreetingScene period={period} />);
      expect(
        container.querySelector('linearGradient, radialGradient, mask, clipPath, defs'),
      ).toBeNull();
      expect(container.querySelector('[opacity], [fill-opacity], [stroke-opacity]')).toBeNull();
      expect(container.querySelectorAll('.gs-body')).toHaveLength(1);
      unmount();
    }
  });

  it('colours from CSS variables, never hex', () => {
    for (const period of periods) {
      const { container, unmount } = render(<GreetingScene period={period} />);
      expect(container.innerHTML).toMatch(/var\(--quad-(c[1-5]|rail)\)/);
      expect(container.innerHTML).not.toMatch(/#[0-9a-fA-F]{3,6}\b/);
      expect(container.innerHTML).not.toContain('color-mix(');
      unmount();
    }
  });

  it('leaves the left half of the view box empty, so the card colour shows through', () => {
    const { container } = render(<GreetingScene period="morning" />);
    expect(container.querySelector('svg > g')).toHaveAttribute('transform', 'translate(600 20)');
    expect(container.querySelector('svg > rect')).toBeNull();
  });
});
