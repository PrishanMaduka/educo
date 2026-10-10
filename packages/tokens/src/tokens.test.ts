import { describe, expect, it } from 'vitest';

import {
  DEFAULT_BRAND,
  colorNames,
  colors,
  contrastRatio,
  deriveBrand,
  fontFamily,
  fontName,
  publicSite,
  radius,
  shadow,
  spacing,
  type,
} from './index';

describe('colour tokens', () => {
  it('keep the old names with the redesign values (spec 03, D34)', () => {
    expect(colors.light).toMatchObject({
      canvas: '#F7F5F0',
      surface: '#FFFFFF',
      'surface-2': '#F0EEE7',
      line: '#E4E1D8',
      'line-strong': '#CDC8BA',
      ink: '#101632',
      'ink-3': '#5A5F7B',
      rail: '#101632',
      'rail-2': '#1D2550',
      info: '#0B67A8',
      c1: '#E0478A',
      c5: '#4E8A12',
      gold: '#C8F169',
    });
    expect(colors.dark).toMatchObject({
      canvas: '#0F1330',
      surface: '#171D45',
      ink: '#F7F5F0',
      rail: '#0A0D24',
      info: '#7CCBFF',
      c5: '#C8F169',
    });
  });

  it('add the new names from spec 03', () => {
    expect(colors.light).toMatchObject({
      navy: '#101632',
      'on-navy': '#F7F5F0',
      lime: '#C8F169',
      pink: '#FF6FAE',
      sky: '#59C3FF',
      orange: '#FF9B45',
      'field-line': '#8E8A7D',
      'switch-off': '#8E8A7D',
      'heat-0': '#FFD4E7',
      'heat-3': '#C8F169',
      focus: '#2F6BFF',
      'nav-violet': '#8C93FF',
      'nav-mist': '#C9CBE0',
      'navy-card-ring': 'transparent',
    });
    expect(colors.dark).toMatchObject({
      focus: '#7FA6FF',
      'field-line': '#636DAA',
      'navy-card': '#1D2550',
      'navy-card-ring': '#2F3870',
      inverse: '#F7F5F0',
      'heat-0': '#683A6A',
      'nav-lime': '#C8F169',
    });
  });

  it('default the brand to Quad lime, as deriveBrand computes it', () => {
    for (const mode of ['light', 'dark'] as const) {
      const d = deriveBrand(DEFAULT_BRAND, mode);
      expect(colors[mode]).toMatchObject({
        brand: d.fill,
        'brand-fill': d.fill,
        'brand-strong': d.fillStrong,
        'brand-fill-strong': d.fillStrong,
        'brand-ink': d.ink,
        'brand-text': d.text,
        'brand-soft': d.soft,
        'brand-raw': '#C8F169',
        'rail-active': d.railActive,
        'rail-active-ink': d.railActiveInk,
      });
    }
    expect(colors.light['brand-fill']).toBe('#C8F169');
    expect(colors.light['brand-ink']).toBe('#101632');
    expect(colors.light['brand-text']).toBe('#5E7131');
  });

  it('give every theme the same token names, and every name a value', () => {
    expect(Object.keys(colors.dark).sort()).toEqual(Object.keys(colors.light).sort());
    expect(Object.keys(colors.light).sort()).toEqual([...colorNames].sort());
  });

  it('keep the side bar section colours 5.4:1 on rail-2 and navy in both themes (D40)', () => {
    const navs = ['nav-lime', 'nav-orange', 'nav-pink', 'nav-sky', 'nav-violet', 'nav-mist'] as const;
    for (const mode of ['light', 'dark'] as const) {
      for (const nav of navs) {
        for (const bg of [colors[mode]['rail-2'], colors[mode].navy]) {
          // The spec rounds to one decimal: nav-violet on rail-2 is 5.397:1.
          const ratio = Math.round(contrastRatio(colors[mode][nav], bg) * 10) / 10;
          expect(ratio, `${mode} ${nav}`).toBeGreaterThanOrEqual(5.4);
        }
      }
    }
  });

  it('keep status text 4.5:1 on the page surfaces and its own tint, in both themes', () => {
    for (const mode of ['light', 'dark'] as const) {
      const c = colors[mode];
      for (const s of ['good', 'warn', 'bad', 'info'] as const) {
        for (const bg of [c.canvas, c.surface, c['surface-2'], c[`${s}-soft`]]) {
          expect(contrastRatio(c[s], bg), `${mode} ${s}`).toBeGreaterThanOrEqual(4.5);
        }
      }
    }
  });

  it('keep control edges and the focus ring 3:1 on cards, and accent ink 7:1 on its tint', () => {
    for (const mode of ['light', 'dark'] as const) {
      const c = colors[mode];
      expect(contrastRatio(c['field-line'], c.surface)).toBeGreaterThanOrEqual(3);
      expect(contrastRatio(c['switch-off'], c.surface)).toBeGreaterThanOrEqual(3);
      expect(contrastRatio(c.focus, c.surface)).toBeGreaterThanOrEqual(3);
      expect(contrastRatio(c.focus, c.canvas)).toBeGreaterThanOrEqual(3);
      for (const a of ['lime', 'pink', 'sky', 'orange'] as const) {
        expect(contrastRatio(c[`${a}-ink`], c[`${a}-soft`]), `${mode} ${a}`).toBeGreaterThanOrEqual(7);
      }
      for (const step of [0, 1, 2, 3] as const) {
        expect(contrastRatio(c[`heat-${step}-ink`], c[`heat-${step}`])).toBeGreaterThanOrEqual(4.5);
      }
    }
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
    expect(radius).toEqual({ card: 20, scene: 28, input: 12, pill: 999 });
    expect(shadow.light.card).toBe(
      '0 1px 2px rgba(16,22,50,.05), 0 10px 28px -18px rgba(16,22,50,.30)',
    );
    expect(shadow.dark.lg).toBe('0 30px 70px -24px rgba(0,0,0,.8)');
    expect(Object.keys(shadow.dark)).toEqual(Object.keys(shadow.light));
    expect(spacing).toEqual([4, 6, 8, 10, 12, 14, 16, 18, 20, 24, 28, 32]);
  });

  it('name Figtree and Bricolage Grotesque, and retire Fraunces', () => {
    expect(fontFamily.sans).toContain('Figtree');
    expect(fontFamily.display.startsWith('"Bricolage Grotesque"')).toBe(true);
    expect(fontName).toEqual({ sans: 'Figtree', display: 'Bricolage Grotesque' });
    expect(JSON.stringify({ fontFamily, fontName })).not.toContain('Fraunces');
    expect(type.weights).toEqual([400, 500, 600, 700, 800]);
    expect(type.size).toMatchObject({ display: 44, pageTitle: 30, cardTitle: 17 });
  });
});
