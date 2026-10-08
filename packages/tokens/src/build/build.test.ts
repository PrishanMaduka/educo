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
    expect(theme).toContain('--color-band-tag-teal-bg: var(--quad-band-tag-teal-bg);');
    expect(theme).toContain('--radius-card: 16px;');
    expect(theme).toContain('--radius-pill: 999px;');
    expect(theme).toContain('--shadow-card: 0 1px 2px');
    expect(theme).toContain('--font-accent:');
  });

  it('defines the light theme on :root and on any data-theme="light" container', () => {
    expect(theme).toMatch(/:root,\n\[data-theme="light"\] \{[^}]*--quad-canvas: #FAF8F5;/);
    expect(theme).toMatch(/:root,\n\[data-theme="light"\] \{[^}]*--quad-brand-fill: #[0-9A-F]{6};/);
    expect(theme).toContain('--color-rail-active: var(--quad-rail-active, var(--quad-brand));');
    expect(theme).toContain('--color-brand-fill-strong: var(--quad-brand-fill-strong);');
  });

  it('defines the dark theme for data-theme and for the system setting', () => {
    expect(theme).toMatch(/\[data-theme="dark"\] \{[^}]*--quad-canvas: #13142A;/);
    expect(theme).toMatch(
      /@media \(prefers-color-scheme: dark\) \{\s*:root:not\(\[data-theme="light"\]\) \{[^}]*--quad-canvas: #13142A;/,
    );
  });

  it('overrides the rail for the console', () => {
    expect(theme).toMatch(/\[data-app="console"\] \{[^}]*--quad-rail: #15173A;/);
    expect(theme).toMatch(/--quad-rail: #0C0D20;/);
    expect(theme).toMatch(/--quad-rail-active: #6D5AE6;/);
  });

  it('scopes palette B to the public site, light and dark, with heat mixed on its surface', () => {
    expect(theme).toMatch(
      /\n\[data-site="public"\] \{[^}]*--quad-canvas: #EEF5FB;[^}]*--quad-heat-2: color-mix/,
    );
    expect(theme).toMatch(
      /\[data-theme="dark"\] \[data-site="public"\],\n\[data-site="public"\]\[data-theme="dark"\] \{[^}]*--quad-canvas: #18181D;/,
    );
    expect(theme).toMatch(
      /@media \(prefers-color-scheme: dark\) \{\s*:root:not\(\[data-theme="light"\]\) \[data-site="public"\] \{[^}]*--quad-ink: #F3F2EE;/,
    );
  });

  it('declares the landing colours and watercolour pigments for each theme', () => {
    expect(theme).toMatch(/:root,\n\[data-theme="light"\] \{[^}]*--quad-coral-ink: #C23A33;/);
    expect(theme).toMatch(
      /:root,\n\[data-theme="light"\] \{[^}]*--quad-wc-paper: #F4F1EA;[^}]*--quad-wc-blend: multiply;/,
    );
    expect(theme).toMatch(
      /\[data-theme="dark"\] \{[^}]*--quad-wc-paper: #1F1F25;[^}]*--quad-wc-blend: normal;/,
    );
    expect(theme).toContain('--color-wc-peach: var(--quad-wc-peach);');
    expect(theme).toContain('--color-coral-ink: var(--quad-coral-ink);');
    expect(theme).not.toContain('--color-wc-blend');
  });

  it('mixes heat steps on the surface', () => {
    expect(theme).toContain(
      '--quad-heat-0: color-mix(in srgb, var(--quad-c1) 30%, var(--quad-surface));',
    );
    expect(theme).toContain('--quad-heat-3: var(--quad-c5);');
  });

  it('shares its variable blocks with tokens.css, which has no @theme', () => {
    expect(tokens).not.toContain('@theme');
    expect(tokens).toContain('--quad-canvas: #FAF8F5;');
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
      'bg-band',
      'bg-band-tag-teal-bg',
      'text-band-tag-teal-ink',
      'bg-heat-2',
      'text-coral-ink',
      'bg-wash-1',
      'fill-wc-ochre',
      'rounded-card',
      'rounded-scene',
      'rounded-input',
      'rounded-pill',
      'shadow-card',
      'shadow-lg',
      'font-sans',
      'font-accent',
    ]);
    expect(css).toContain('background-color: var(--quad-canvas)');
    expect(css).toContain('color: var(--quad-ink-2)');
    expect(css).toContain('border-color: var(--quad-line)');
    expect(css).toContain('color: var(--quad-brand-ink)');
    expect(css).toContain('background-color: var(--quad-heat-2)');
    expect(css).toContain('color: var(--quad-coral-ink)');
    expect(css).toContain('fill: var(--quad-wc-ochre)');
    expect(css).toContain('border-radius: 16px');
    expect(css).toContain('.rounded-pill');
    expect(css).toContain('.shadow-card');
    expect(css).toContain('.font-accent');
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
    expect(dart).toContain('static const double radiusCard = 16;');
    expect(dart).toContain("static const String fontSans = 'Figtree';");
  });

  it('declares the QuadColors theme extension with light and dark', () => {
    expect(dart).toContain('class QuadColors extends ThemeExtension<QuadColors> {');
    expect(dart).toContain('static const light = QuadColors(');
    expect(dart).toContain('static const dark = QuadColors(');
    expect(dart).toContain('canvas: Color(0xFFFAF8F5),');
    expect(dart).toContain('canvas: Color(0xFF13142A),');
    expect(dart).toContain('QuadColors copyWith({');
    expect(dart).toContain('QuadColors lerp(ThemeExtension<QuadColors>? other, double t) {');
    expect(dart).toContain('Color.lerp(');
    expect(dart).toContain('brandFill: Color(0x');
    expect(dart).toContain('brandFillStrong: Color(0x');
    expect(dart).toContain('bandTagTealBg:');
    expect(dart).toContain('heat0:');
    expect(dart).toContain('static const consoleLight = QuadColors(');
  });
});
