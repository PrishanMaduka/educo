import 'package:flutter/material.dart';
import 'package:flutter_svg/flutter_svg.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:quad_parent/core/greeting.dart';
import 'package:quad_parent/theme/theme.dart';
import 'package:quad_parent/theme/tokens.g.dart';
import 'package:quad_parent/ui/greeting_icon.dart';

void main() {
  // Spec 03: amber morning and afternoon, coral evening, lilac night.
  final tints = <GreetingPeriod, Color>{
    GreetingPeriod.morning: QuadColors.light.c4,
    GreetingPeriod.afternoon: QuadColors.light.c4,
    GreetingPeriod.evening: QuadColors.light.c1,
    GreetingPeriod.night: QuadColors.light.c3,
  };

  for (final MapEntry(key: period, value: tint) in tints.entries) {
    testWidgets('${period.name} icon is tinted from the tokens', (
      tester,
    ) async {
      await tester.pumpWidget(
        MaterialApp(
          theme: quadTheme(Brightness.light),
          home: GreetingIcon(period: period),
        ),
      );
      final svg = tester.widget<SvgPicture>(find.byType(SvgPicture));
      expect(svg.colorFilter, ColorFilter.mode(tint, BlendMode.srcIn));
      expect(
        (svg.bytesLoader as SvgAssetLoader).assetName,
        'assets/greeting/icon-${period.name}.svg',
      );
    });
  }

  testWidgets('the icon is hidden from screen readers', (tester) async {
    await tester.pumpWidget(
      MaterialApp(
        theme: quadTheme(Brightness.light),
        home: const GreetingIcon(period: GreetingPeriod.night),
      ),
    );
    expect(
      find.descendant(
        of: find.byType(GreetingIcon),
        matching: find.byType(ExcludeSemantics),
      ),
      findsOneWidget,
    );
  });
}
