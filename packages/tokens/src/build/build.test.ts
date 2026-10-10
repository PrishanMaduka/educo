import { compile } from 'tailwindcss';
import { describe, expect, it } from 'vitest';

import { buildThemeCss, buildTokensCss, buildVariableBlocks } from './css';
import { buildDart } from './dart';

const theme = buildThemeCss();
const tokens = buildTokensCss();

describe('theme.css', () => {
  it('maps colours inside an inline @theme to runtime variables', () => {
    expect(theme).toContain('@theme inline {');
    expect(theme).toContain('--color-canvas: var(--quad-canvas);');
    expect(theme).toContain('--color-ink-2: var(--quad-ink-2);');
    expect(theme).toContain('--radius-card: 20px;');
    expect(theme).toContain('--radius-pill: 999px;');
    expect(theme).toContain('--shadow-card: var(--quad-shadow-card);');
    expect(theme).toContain('--font-display: "Bricolage Grotesque"');
    expect(theme).not.toContain('--font-accent');
    expect(theme).not.toContain('Fraunces');
  });

  it('defines the light theme on :root and on any data-theme="light" container', () => {
    expect(theme).toMatch(/:root,\n\[data-theme="light"\] \{[^}]*--quad-canvas: #F7F5F0;/);
    expect(theme).toMatch(/:root,\n\[data-theme="light"\] \{[^}]*--quad-brand-fill: #C8F169;/);
    expect(theme).toMatch(/:root,\n\[data-theme="light"\] \{[^}]*--quad-focus: #2F6BFF;/);
    expect(theme).toContain('--color-rail-active: var(--quad-rail-active);');
    expect(theme).toContain('--color-nav-violet: var(--quad-nav-violet);');
    expect(theme).toContain('--color-brand-fill-strong: var(--quad-brand-fill-strong);');
  });

  it('defines the dark theme for data-theme and for the system setting', () => {
    expect(theme).toMatch(/\[data-theme="dark"\] \{[^}]*--quad-canvas: #0F1330;/);
    expect(theme).toMatch(
      /\[data-theme="dark"\] \{[^}]*--quad-shadow-card: 0 1px 2px rgba\(0,0,0,.3\)/,
    );
    expect(theme).toMatch(
      /@media \(prefers-color-scheme: dark\) \{\s*:root:not\(\[data-theme="light"\]\) \{[^}]*--quad-canvas: #0F1330;/,
    );
  });

  it('has no console overrides: the console uses the navy bar and the default brand (D34)', () => {
    expect(theme).not.toContain('data-app="console"');
  });

  it('applies a school brand from the shell for both themes', () => {
    expect(theme).toMatch(
      /\[data-school-brand\] \{[^}]*--quad-brand-fill: var\(--school-light-brand-fill\);[^}]*--quad-rail-active-ink: var\(--school-light-rail-active-ink\);/,
    );
    expect(theme).toMatch(
      /\[data-theme="dark"\]\[data-school-brand\],\n\[data-theme="dark"\] \[data-school-brand\] \{[^}]*--quad-brand-text: var\(--school-dark-brand-text\);/,
    );
    expect(theme).toMatch(
      /@media \(prefers-color-scheme: dark\) \{\s*:root:not\(\[data-theme="light"\]\)\[data-school-brand\],[^{]*\{[^}]*--school-dark-brand-fill/,
    );
    expect(theme).not.toMatch(/data-school-brand[^{]*\{[^}]*--quad-rail:/);
  });

  it('declares the public site palette for each theme and the accent for each view', () => {
    expect(theme).toMatch(/:root,\n\[data-theme="light"\] \{[^}]*--quad-site-page-bg: #F7F5F0;/);
    expect(theme).toMatch(/\[data-theme="dark"\] \{[^}]*--quad-site-page-bg: #0F1330;/);
    expect(theme).toContain(':root {\n  --quad-site-accent: var(--quad-site-lime);');
    expect(theme).toContain(
      ':root[data-view="parent"] {\n  --quad-site-accent: var(--quad-site-pink);',
    );
    expect(theme).toContain('--color-site-navy: var(--quad-site-navy);');
    expect(theme).toContain('--color-site-accent: var(--quad-site-accent);');
    expect(theme).not.toContain('--quad-band');
    expect(theme).not.toContain('--quad-wc-');
  });

  it('shares its variable blocks with tokens.css, which has no @theme', () => {
    expect(tokens).not.toContain('@theme');
    expect(tokens).toContain('--quad-canvas: #F7F5F0;');
    expect(tokens).toContain(buildVariableBlocks());
    expect(theme).toContain(buildVariableBlocks());
  });

  it('produces the Tailwind utilities the spec names', async () => {
    const compiler = await compile(`@tailwind utilities;\n${theme}`);
    const css = compiler.build([
      'bg-canvas',
      'bg-surface',
      'text-ink-2',
      'border-line',
      'bg-brand',
      'bg-brand-fill',
      'hover:bg-brand-fill-strong',
      'text-brand-ink',
      'bg-rail-active',
      'text-rail-active-ink',
      'text-brand-text',
      'border-field-line',
      'bg-navy',
      'text-on-navy',
      'bg-lime-soft',
      'text-lime-ink',
      'outline-focus',
      'bg-scrim',
      'shadow-sm',
      'font-display',
      'bg-site-navy',
      'text-site-page-ink-2',
      'fill-site-pink',
      'bg-site-accent',
      'rounded-card',
      'rounded-scene',
      'rounded-input',
      'rounded-pill',
      'shadow-card',
      'shadow-lg',
      'font-sans',
    ]);
    expect(css).toContain('background-color: var(--quad-canvas)');
    expect(css).toContain('color: var(--quad-ink-2)');
    expect(css).toContain('border-color: var(--quad-line)');
    expect(css).toContain('color: var(--quad-brand-ink)');
    expect(css).toContain('background-color: var(--quad-site-navy)');
    expect(css).toContain('color: var(--quad-site-page-ink-2)');
    expect(css).toContain('fill: var(--quad-site-pink)');
    expect(css).toContain('border-radius: 20px');
    expect(css).toContain('outline-color: var(--quad-focus)');
    expect(css).toContain('border-color: var(--quad-field-line)');
    expect(css).toContain('background-color: var(--quad-navy)');
    expect(css).toContain('var(--quad-shadow-card)');
    expect(css).toContain('.font-display');
    expect(css).toContain('.rounded-pill');
    expect(css).toContain('.shadow-card');
    expect(css).toContain('.font-sans');
  });
});

describe('tokens.g.dart', () => {
  const dart = buildDart();

  it('has the generated header and imports only material', () => {
    expect(dart.startsWith('// GENERATED by pnpm tokens:build — do not edit')).toBe(true);
    expect(dart.match(/^import .*$/gm)).toEqual(["import 'package:flutter/material.dart';"]);
  });

  it('declares QuadTokens constants', () => {
    expect(dart).toContain('class QuadTokens {');
    expect(dart).toContain('static const double radiusCard = 20;');
    expect(dart).toContain("static const String fontSans = 'Figtree';");
    expect(dart).toContain("static const String fontDisplay = 'Bricolage Grotesque';");
    expect(dart).toContain('static const List<BoxShadow> shadowCardDark = [');
    expect(dart).not.toContain('Fraunces');
  });

  it('declares the QuadColors theme extension with light and dark', () => {
    expect(dart).toContain('class QuadColors extends ThemeExtension<QuadColors> {');
    expect(dart).toContain('static const light = QuadColors(');
    expect(dart).toContain('static const dark = QuadColors(');
    expect(dart).toContain('canvas: Color(0xFFF7F5F0),');
    expect(dart).toContain('canvas: Color(0xFF0F1330),');
    expect(dart).toContain('brandText: Color(0xFF5E7131),');
    expect(dart).toContain('railActiveInk: Color(0xFF101632),');
    expect(dart).toContain('focus: Color(0xFF7FA6FF),');
    expect(dart).toContain('navyCardRing: Color(0x00000000),');
    expect(dart).toContain('heat0Ink: Color(0x');
    expect(dart).toContain('navViolet: Color(0xFF8C93FF),');
    expect(dart).toContain('QuadColors copyWith({');
    expect(dart).toContain('QuadColors lerp(ThemeExtension<QuadColors>? other, double t) {');
    expect(dart).toContain('Color.lerp(');
    expect(dart).toContain('brandFill: Color(0x');
    expect(dart).toContain('brandFillStrong: Color(0x');
    expect(dart).not.toContain('bandTagTealBg');
    expect(dart).not.toContain('site');
    expect(dart).not.toContain('consoleLight');
  });
});
