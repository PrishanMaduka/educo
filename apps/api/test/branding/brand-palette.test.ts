import { MeBrand } from '@quad/contracts';
import { deriveBrand } from '@quad/tokens';
import { describe, expect, it } from 'vitest';

import { brandPalette } from '../../src/common/branding/brand-palette';

describe('brandPalette', () => {
  it.each([
    ['no colour', null, '#C8F169'],
    ['the legacy blue', '#2F6FED', '#C8F169'],
    ['the legacy brown', '#A0412D', '#C8F169'],
    ['an invalid value', 'teal', '#C8F169'],
    ['a saved coral', '#DD4A42', '#DD4A42'],
    ['Greenfield green', '#1B7F53', '#1B7F53'],
  ])('sends %s as %s', (_, saved, colour) => {
    expect(brandPalette(saved).color).toBe(colour);
  });

  it('sends the derived tokens for both themes, in the contract shape', () => {
    const brand = MeBrand.parse(brandPalette('#7A1F3D'));
    for (const mode of ['light', 'dark'] as const) {
      const d = deriveBrand('#7A1F3D', mode);
      expect(brand[mode]).toEqual({
        fill: d.fill,
        fillStrong: d.fillStrong,
        ink: d.ink,
        text: d.text,
        soft: d.soft,
        railActive: d.railActive,
        railActiveInk: d.railActiveInk,
      });
    }
    // Maroon is lifted in dark mode (spec 03 worked example).
    expect(brand.dark.fill).toBe('#9B576E');
  });

  it('gives Quad lime navy ink and deepened brand text in light mode', () => {
    expect(brandPalette(null).light).toMatchObject({
      fill: '#C8F169',
      ink: '#101632',
      text: '#5E7131',
    });
  });
});
