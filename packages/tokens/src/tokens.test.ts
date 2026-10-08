import { describe, expect, it } from 'vitest';

import {
  colors,
  contrastRatio,
  fontFamily,
  heatHex,
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
  it('use palette B for the band (spec 19 "Palette B tokens")', () => {
    expect(publicSite.light.band).toBe('#1A2A5E');
    expect(publicSite.dark.band).toBe('#0F0F13');
    expect(publicSite.light['band-2']).toBe('#24387A');
    expect(publicSite.dark['band-2']).toBe('#1D1D23');
    expect(publicSite.light['band-line']).toBe('#34498F');
    expect(publicSite.dark['band-line']).toBe('#33333C');
    expect(publicSite.light['band-ink-2']).toBe('#CDD5F2');
    expect(publicSite.dark['band-ink-2']).toBe('#D0CFCA');
    expect(publicSite.light['band-tag-teal-bg']).toBe('#1D4F4A');
    expect(publicSite.light['band-tag-teal-ink']).toBe('#9BEADF');
    expect(publicSite.dark['band-tag-coral-bg']).toBe('#5A2430');
    expect(publicSite.dark['band-tag-amber-ink']).toBe('#FFDDA1');
    expect(publicSite.light['band-tag-lilac-bg']).toBe('#3A3170');
    expect(publicSite.light['band-tag-lilac-ink']).toBe('#D9D2FF');
  });

  it('replace the page background with Sky blue and Soft charcoal', () => {
    expect(publicSite.palette.light).toEqual({
      canvas: '#EEF5FB',
      surface: '#FFFFFF',
      'surface-2': '#E4EDF7',
      line: '#D2DEEC',
    });
    expect(publicSite.palette.dark).toMatchObject({
      canvas: '#18181D',
      surface: '#222228',
      ink: '#F3F2EE',
      'ink-3': '#9C9A93',
    });
  });

  it('give coral text and the heat numbers 4.5:1 on their backgrounds', () => {
    const { landing, palette } = publicSite;
    expect(contrastRatio(landing.light['coral-ink'], palette.light.canvas)).toBeGreaterThanOrEqual(
      4.5,
    );
    expect(contrastRatio(landing.dark['coral-ink'], palette.dark.canvas)).toBeGreaterThanOrEqual(
      4.5,
    );
    expect(
      contrastRatio(landing.light['coral-fill-ink'], landing.light['coral-fill']),
    ).toBeGreaterThanOrEqual(4.5);
    expect(
      contrastRatio(landing.dark['coral-fill-ink'], landing.dark['coral-fill']),
    ).toBeGreaterThanOrEqual(4.5);
    const darkSurface = { ...colors.dark, surface: palette.dark.surface };
    expect(contrastRatio(landing.dark['heat-ink'], heatHex(darkSurface, 2))).toBeGreaterThanOrEqual(
      4.5,
    );
    expect(
      contrastRatio(landing.light['heat-ink'], heatHex(colors.light, 2)),
    ).toBeGreaterThanOrEqual(4.5);
  });

  it('define every watercolour pigment from spec 19 in both themes', () => {
    expect(publicSite.pigments.light.paper).toBe('#F4F1EA');
    expect(publicSite.pigments.dark.paper).toBe('#1F1F25');
    expect(publicSite.pigments.light.uniform).toBe('#FDFCF8');
    expect(publicSite.pigments.dark.window).toBe('#FFD47C');
    expect(Object.keys(publicSite.pigments.dark)).toEqual(Object.keys(publicSite.pigments.light));
    expect(publicSite.blend).toEqual({ light: 'multiply', dark: 'normal' });
  });

  it('mixes the heat steps on the theme surface', () => {
    expect(publicSite.heat).toEqual([
      { color: 'c1', percent: 30 },
      { color: 'c5', percent: 30 },
      { color: 'c5', percent: 60 },
      { color: 'c5', percent: 100 },
    ]);
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
