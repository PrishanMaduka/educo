import { describe, expect, it } from 'vitest';

import { contrastRatio, deriveBrand, mix } from './brand';
import { colors } from './colors';

describe('contrastRatio', () => {
  it('matches known WCAG values', () => {
    expect(contrastRatio('#000000', '#FFFFFF')).toBeCloseTo(21, 5);
    expect(contrastRatio('#FFFFFF', '#FFFFFF')).toBeCloseTo(1, 5);
    expect(contrastRatio('#767676', '#FFFFFF')).toBeCloseTo(4.54, 2);
  });
});

describe('mix', () => {
  it('blends the first colour at the given share', () => {
    expect(mix('#FFFFFF', 0.5, '#000000')).toBe('#808080');
    expect(mix('#DD4A42', 1, '#000000')).toBe('#DD4A42');
  });
});

describe('deriveBrand (light)', () => {
  it('keeps a brand that passes 4.5:1 and derives the tints by the spec rules', () => {
    const d = deriveBrand('#2F4FD0', 'light');
    expect(contrastRatio('#FFFFFF', '#2F4FD0')).toBeGreaterThanOrEqual(4.5);
    expect(d.brand).toBe('#2F4FD0');
    expect(d.brandFill).toBe('#2F4FD0');
    expect(d.brandFillStrong).toBe(mix('#2F4FD0', 0.8, '#000000'));
    expect(d.brandStrong).toBe(mix('#2F4FD0', 0.8, '#000000'));
    expect(d.brandSoft).toBe(mix('#2F4FD0', 0.13, '#FFFFFF'));
    expect(d.rail).toBe(mix('#2F4FD0', 0.06, '#1F2559'));
    expect(d.rail2).toBe(mix('#2F4FD0', 0.1, '#2C3370'));
    expect(d.brandInk).toBe('#FFFFFF');
    expect(d.decoration).toBe('#2F4FD0');
  });

  it('darkens a low contrast brand for buttons until white text passes', () => {
    const d = deriveBrand('#DD4A42', 'light');
    expect(contrastRatio('#FFFFFF', '#DD4A42')).toBeLessThan(4.5);
    expect(contrastRatio('#FFFFFF', d.brandFill)).toBeGreaterThanOrEqual(4.5);
    expect(d.brandFill).not.toBe('#DD4A42');
    expect(d.brand).toBe('#DD4A42');
    expect(d.decoration).toBe('#DD4A42');
  });

  it('darkens a very light brand', () => {
    const d = deriveBrand('#F2A93B', 'light');
    expect(contrastRatio('#FFFFFF', d.brandFill)).toBeGreaterThanOrEqual(4.5);
  });

  it('maps legacy prototype colours to the default brand', () => {
    expect(deriveBrand('#2F6FED', 'light').decoration).toBe('#DD4A42');
    expect(deriveBrand('#a0412d', 'light').decoration).toBe('#DD4A42');
  });

  it('normalises hex input', () => {
    expect(deriveBrand('#2f4fd0', 'light').brand).toBe('#2F4FD0');
    expect(deriveBrand('2F4FD0', 'light').brand).toBe('#2F4FD0');
  });

  it('rejects invalid hex', () => {
    expect(() => deriveBrand('blue', 'light')).toThrow(/hex/i);
  });
});

describe('brand-fill accessibility', () => {
  const samples = ['#DD4A42', '#2BB0A0', '#F2A93B', '#3B4AA8'];
  it.each(samples)('passes 4.5:1 with its ink for %s in both modes', (hex) => {
    for (const mode of ['light', 'dark'] as const) {
      const d = deriveBrand(hex, mode);
      expect(contrastRatio(d.brandFill, d.brandInk)).toBeGreaterThanOrEqual(4.5);
      expect(contrastRatio(d.brandFillStrong, d.brandInk)).toBeGreaterThanOrEqual(4.5);
      expect(d.brand).toBe(hex);
    }
  });

  it('is a static token that passes for the default brand', () => {
    for (const t of ['light', 'dark'] as const) {
      const c = colors[t];
      expect(contrastRatio(c['brand-fill'], c['brand-ink'])).toBeGreaterThanOrEqual(4.5);
      expect(contrastRatio(c['brand-fill-strong'], c['brand-ink'])).toBeGreaterThanOrEqual(4.5);
    }
    expect(colors.light.brand).toBe('#DD4A42');
    expect(colors.light['brand-fill']).toBe(deriveBrand('#DD4A42', 'light').brandFill);
  });

  it('keeps white text readable on the console active nav', () => {
    expect(contrastRatio(colors.console['rail-active'], '#FFFFFF')).toBeGreaterThanOrEqual(4.5);
  });
});

describe('deriveBrand (dark)', () => {
  it('uses dark ink and the dark surface', () => {
    const d = deriveBrand('#FF7A6E', 'dark');
    expect(d.brand).toBe('#FF7A6E');
    expect(d.brandInk).toBe('#1B1D3A');
    expect(d.brandSoft).toBe(mix('#FF7A6E', 0.13, '#1B1D3A'));
    expect(d.rail).toBe(mix('#FF7A6E', 0.06, '#0E0F22'));
  });

  it('lightens a dark brand until the ink passes 4.5:1', () => {
    const d = deriveBrand('#1F2559', 'dark');
    expect(contrastRatio('#1B1D3A', d.brandFill)).toBeGreaterThanOrEqual(4.5);
    expect(contrastRatio('#1B1D3A', d.brandFillStrong)).toBeGreaterThanOrEqual(4.5);
  });
});
