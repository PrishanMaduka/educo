import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:quad_api/quad_api.dart';
import 'package:quad_parent/theme/theme.dart';
import 'package:quad_parent/theme/tokens.g.dart';

import '../helpers/contrast.dart';
import '../helpers/sign_in_data.dart';

/// Material widgets fall back to `colorScheme.primary` (the brand fill) for
/// text and icons. With Quad lime, or any light school colour, that is about
/// 1.2:1 on the page, so the theme routes them to `brandText`, `ink` and the
/// blue `focus` instead (spec 03, D56).
void main() {
  final lime = MeBrand.fromJson(limeBrand);

  for (final brightness in Brightness.values) {
    final theme = quadTheme(brightness, brand: lime);
    final c = theme.extension<QuadColors>()!;

    Future<void> pump(WidgetTester tester, Widget child) => tester.pumpWidget(
      MaterialApp(
        theme: theme,
        home: Scaffold(body: Center(child: child)),
      ),
    );

    Color textColour(WidgetTester tester, Finder button, String label) => tester
        .widget<RichText>(
          find.descendant(
            of: find.descendant(of: button, matching: find.text(label)),
            matching: find.byType(RichText),
          ),
        )
        .text
        .style!
        .color!;

    group('with a lime school in ${brightness.name}', () {
      testWidgets('a TextButton reads 4.5:1 on the page and on cards', (
        tester,
      ) async {
        await pump(
          tester,
          TextButton(onPressed: () {}, child: const Text('Retry')),
        );
        final colour = textColour(tester, find.byType(TextButton), 'Retry');
        expect(colour, c.brandText);
        expect(contrast(colour, c.canvas), greaterThanOrEqualTo(4.5));
        expect(contrast(colour, c.surface), greaterThanOrEqualTo(4.5));
      });

      testWidgets('an OutlinedButton reads 4.5:1 on the page', (tester) async {
        await pump(
          tester,
          OutlinedButton(onPressed: () {}, child: const Text('Later')),
        );
        final colour = textColour(tester, find.byType(OutlinedButton), 'Later');
        expect(contrast(colour, c.canvas), greaterThanOrEqualTo(4.5));
      });

      testWidgets('a selected IconButton draws its icon in brand-text', (
        tester,
      ) async {
        await pump(
          tester,
          IconButton(
            isSelected: true,
            onPressed: () {},
            icon: const Icon(Icons.star_border),
            selectedIcon: const Icon(Icons.star),
          ),
        );
        final icon = tester.widget<IconTheme>(
          find
              .ancestor(
                of: find.byIcon(Icons.star),
                matching: find.byType(IconTheme),
              )
              .first,
        );
        expect(icon.data.color, c.brandText);
      });

      testWidgets('a progress indicator stands out 3:1 from the page', (
        tester,
      ) async {
        await pump(tester, const CircularProgressIndicator());
        final colour = theme.progressIndicatorTheme.color!;
        expect(contrast(colour, c.canvas), greaterThanOrEqualTo(3));
      });

      test('text fields focus in blue with a navy or cream caret', () {
        final input = theme.inputDecorationTheme;
        expect(
          (input.focusedBorder! as OutlineInputBorder).borderSide.color,
          c.focus,
        );
        expect(
          (input.enabledBorder! as OutlineInputBorder).borderSide.color,
          c.fieldLine,
        );
        expect(theme.textSelectionTheme.cursorColor, c.ink);
      });

      test('an unchecked checkbox and an off switch meet 3:1 (field-line)', () {
        final off = <WidgetState>{};
        expect(theme.checkboxTheme.side?.color, c.fieldLine);
        expect(theme.switchTheme.trackColor?.resolve(off), c.switchOff);
      });

      test('raised surfaces are not tinted with the brand', () {
        expect(theme.colorScheme.surfaceTint.a, 0);
      });
    });
  }
}
