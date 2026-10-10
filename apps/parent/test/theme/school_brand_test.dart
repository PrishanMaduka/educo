import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:quad_api/quad_api.dart';
import 'package:quad_parent/theme/theme.dart';
import 'package:quad_parent/theme/tokens.g.dart';

void main() {
  // As the API computes it for a green school (spec 03, D32).
  final brand = MeSchoolBrand(
    color: '#1B7F53',
    fill: '#1A7A50',
    fillDark: '#3FB884',
    ink: '#FFFFFF',
  );

  test('light mode takes the colour, the fill and its ink', () {
    final c = withSchoolBrand(QuadColors.light, brand, Brightness.light);

    expect(c.brand, const Color(0xFF1B7F53));
    expect(c.brandFill, const Color(0xFF1A7A50));
    expect(c.brandInk, const Color(0xFFFFFFFF));
    expect(c.brandSoft, Color.lerp(QuadColors.light.surface, c.brand, 0.13));
    // Everything else stays Quad's.
    expect(c.rail, QuadColors.light.rail);
    expect(c.canvas, QuadColors.light.canvas);
  });

  test('dark mode takes the dark fill and keeps the brand-ink token', () {
    final c = withSchoolBrand(QuadColors.dark, brand, Brightness.dark);

    expect(c.brand, const Color(0xFF3FB884));
    expect(c.brandFill, const Color(0xFF3FB884));
    expect(c.brandInk, QuadColors.dark.brandInk);
  });

  test('the theme carries the brand into its buttons and colour scheme', () {
    final theme = quadTheme(Brightness.light, brand: brand);

    expect(theme.extension<QuadColors>()?.brandFill, const Color(0xFF1A7A50));
    expect(theme.colorScheme.primary, const Color(0xFF1A7A50));
  });

  test("without a school the theme is Quad's own (D13)", () {
    expect(
      quadTheme(Brightness.light).extension<QuadColors>()?.brandFill,
      QuadColors.light.brandFill,
    );
  });
}
