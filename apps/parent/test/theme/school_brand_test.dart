import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:quad_api/quad_api.dart';
import 'package:quad_parent/theme/theme.dart';
import 'package:quad_parent/theme/tokens.g.dart';

import '../helpers/sign_in_data.dart';

void main() {
  // As the API computes it for Greenfield green (spec 03 worked example, D56).
  final brand = MeBrand.fromJson(greenBrand);

  test('light mode applies the light tokens the API derived', () {
    final c = withSchoolBrand(QuadColors.light, brand, Brightness.light);

    expect(c.brandRaw, const Color(0xFF1B7F53));
    expect(c.brand, const Color(0xFF1B7F53));
    expect(c.brandFill, const Color(0xFF1B7F53));
    expect(c.brandFillStrong, const Color(0xFF176D47));
    expect(c.brandStrong, c.brandFillStrong);
    expect(c.brandInk, const Color(0xFFFFFFFF));
    expect(c.brandText, const Color(0xFF19764D));
    expect(c.brandSoft, const Color(0xFFDBEBE3));
    expect(c.railActive, const Color(0xFF1B7F53));
    expect(c.railActiveInk, const Color(0xFFFFFFFF));
    // Navy, the side bar, focus and the petals stay Quad's (D34).
    expect(c.rail, QuadColors.light.rail);
    expect(c.focus, QuadColors.light.focus);
    expect(c.pink, QuadColors.light.pink);
    expect(c.canvas, QuadColors.light.canvas);
  });

  test('dark mode applies the dark tokens, including their own ink', () {
    final c = withSchoolBrand(QuadColors.dark, brand, Brightness.dark);

    expect(c.brandText, const Color(0xFF5DA485));
    expect(c.brandSoft, const Color(0xFF183148));
    // White on green, where the default lime takes navy (no Dart derivation).
    expect(c.brandInk, const Color(0xFFFFFFFF));
    expect(QuadColors.dark.brandInk, const Color(0xFF101632));
    expect(c.focus, QuadColors.dark.focus);
  });

  test('the theme carries the brand into its buttons and colour scheme', () {
    final theme = quadTheme(Brightness.light, brand: brand);

    expect(theme.extension<QuadColors>()?.brandFill, const Color(0xFF1B7F53));
    expect(theme.colorScheme.primary, const Color(0xFF1B7F53));
  });

  test("without a school the theme is Quad's own: lime with navy ink", () {
    final c = quadTheme(Brightness.light).extension<QuadColors>()!;
    expect(c.brandFill, const Color(0xFFC8F169));
    expect(c.brandInk, const Color(0xFF101632));
  });

  test('titles speak in Bricolage Grotesque and body text in Figtree', () {
    final text = quadTheme(Brightness.light).textTheme;
    expect(text.headlineSmall?.fontFamily, QuadTokens.fontDisplay);
    expect(QuadTokens.fontDisplay, 'Bricolage Grotesque');
    expect(
      quadTheme(Brightness.light).textTheme.bodyMedium?.fontFamily,
      'Figtree',
    );
  });
}
