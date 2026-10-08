import { describe, expect, it } from 'vitest';

import {
  colors,
  contrastRatio,
  fontFamily,
  publicSite,
  radius,
  shadow,
  spacing,
  type,
} from './index';

describe('colour tokens', () => {
  it('match the spec for the light theme', () => {
    expect(colors.light.brand).toBe('#DD4A42');
    expect(colors.light.canvas).toBe('#FAF8F5');
    expect(colors.light['line-strong']).toBe('#DCD6CF');
    expect(colors.light.rail).toBe('#1F2559');
    expect(colors.light['rail-active']).toBe(colors.light.brand);
    expect(colors.light.c3).toBe('#8B7CF6');
    expect(colors.light['gold-soft']).toBe('#EEEAFE');
  });

  it('match the spec for the dark theme', () => {
    expect(colors.dark.canvas).toBe('#13142A');
    expect(colors.dark.brand).toBe('#FF7A6E');
    expect(colors.dark['brand-ink']).toBe('#1B1D3A');
    expect(colors.dark.rail).toBe('#0E0F22');
    expect(colors.dark['rail-active']).toBe(colors.dark.brand);
    expect(colors.dark.c5).toBe('#3CC7B5');
  });

  it('give every theme the same token names', () => {
    expect(Object.keys(colors.dark).sort()).toEqual(Object.keys(colors.light).sort());
  });

  it('override the rail for the console', () => {
    expect(colors.console).toEqual({
      rail: '#15173A',
      'rail-2': '#23265A',
      'rail-active': '#6D5AE6',
    });
    expect(colors.console.rail).toBe('#15173A');
    expect(colors.consoleDark.rail).toBe('#0C0D20');
    expect(colors.consoleDark['rail-2']).toBe('#23265A');
    expect(colors.consoleDark['rail-active']).toBe('#6D5AE6');
  });
});

describe('public site tokens', () => {
  it('use the landing palette: navy, cream, lime, pink, sky blue and orange (spec 19)', () => {
    expect(publicSite.light).toMatchObject({
      navy: '#101632',
      paper: '#F7F5F0',
      lime: '#C8F169',
      pink: '#FF6FAE',
      sky: '#59C3FF',
      orange: '#FF9B45',
    });
    expect(publicSite.dark.lime).toBe(publicSite.light.lime);
  });

  it('switch the page, cards and sheets to the dark navy set in dark mode', () => {
    expect(publicSite.light['page-bg']).toBe('#F7F5F0');
    expect(publicSite.dark['page-bg']).toBe('#0F1330');
    expect(publicSite.dark['hero-bg']).toBe('#0A0D24');
    expect(publicSite.dark['card-bg']).toBe('#171D45');
    expect(Object.keys(publicSite.dark)).toEqual(Object.keys(publicSite.light));
  });

  it('give body text 4.5:1 on its ground in both themes', () => {
    for (const theme of ['light', 'dark'] as const) {
      const set = publicSite[theme];
      for (const ink of ['page-ink', 'page-ink-2', 'page-ink-3'] as const) {
        expect(contrastRatio(set[ink], set['page-bg']), `${theme} ${ink}`).toBeGreaterThanOrEqual(
          4.5,
        );
      }
      expect(contrastRatio(set['sheet-ink-2'], set['sheet-bg'])).toBeGreaterThanOrEqual(4.5);
    }
    for (const ink of ['on-navy', 'on-navy-2', 'on-navy-3'] as const) {
      expect(contrastRatio(publicSite.light[ink], publicSite.light.navy)).toBeGreaterThanOrEqual(
        4.5,
      );
    }
    for (const vivid of ['lime', 'pink', 'sky', 'orange'] as const) {
      expect(
        contrastRatio(publicSite.light['on-vivid'], publicSite.light[vivid]),
      ).toBeGreaterThanOrEqual(4.5);
    }
  });

  it('use lime as the school accent and pink as the parent accent', () => {
    expect(publicSite.accent).toEqual({ school: 'lime', parent: 'pink' });
  });
});

describe('type, shape and space', () => {
  it('define radii, shadows and the spacing scale', () => {
    expect(radius).toEqual({ card: 16, scene: 24, input: 12, pill: 999 });
    expect(shadow.card).toBe('0 1px 2px rgba(28,27,46,.05), 0 8px 24px -12px rgba(28,27,46,.18)');
    expect(shadow.lg).toBe('0 24px 60px -18px rgba(28,27,46,.35)');
    expect(spacing).toEqual([4, 6, 8, 10, 12, 14, 16, 18, 20, 24, 28, 32]);
  });

  it('name the font families', () => {
    expect(fontFamily.sans).toContain('Figtree');
    expect(fontFamily.accent).toContain('Fraunces');
    expect(fontFamily.accent).toContain('Georgia');
    expect(type.weights).toEqual([400, 500, 600, 700, 800]);
  });
});
