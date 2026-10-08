import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';

import '../helpers/pump_app.dart';

void main() {
  for (final brightness in Brightness.values) {
    for (final textScale in [1.0, 2.0]) {
      final name = 'home_${brightness.name}_text${textScale.toInt()}x';

      testWidgets('Home at 390×844, $name', (tester) async {
        tester.view
          ..physicalSize = const Size(390, 844) * 2
          ..devicePixelRatio = 2;
        tester.platformDispatcher
          ..platformBrightnessTestValue = brightness
          ..textScaleFactorTestValue = textScale;
        addTearDown(tester.view.reset);
        addTearDown(tester.platformDispatcher.clearAllTestValues);

        await tester.pumpWidget(appAt(mondayMorning));
        await tester.pumpAndSettle();

        await expectLater(
          find.byType(MaterialApp),
          matchesGoldenFile('$name.png'),
        );
      });
    }
  }
}
