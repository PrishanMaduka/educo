import 'dart:math' as math;

import 'package:flutter/material.dart';
import 'package:flutter_svg/flutter_svg.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:quad_parent/theme/theme.dart';
import 'package:quad_parent/theme/tokens.g.dart';
import 'package:quad_parent/ui/quad_tab_bar.dart';

Widget _bar({
  required bool reduceMotion,
  ValueChanged<int>? onSelect,
  Brightness brightness = Brightness.light,
}) => MaterialApp(
  theme: quadTheme(brightness),
  home: MediaQuery(
    data: MediaQueryData(disableAnimations: reduceMotion),
    child: Scaffold(
      bottomNavigationBar: QuadTabBar(
        tabs: const [
          (label: 'One', icon: 'assets/icons/tab-home.svg'),
          (label: 'Two', icon: 'assets/icons/tab-more.svg'),
        ],
        currentIndex: 0,
        semanticLabel: 'Main',
        onSelect: onSelect ?? (_) {},
      ),
    ),
  ),
);

void main() {
  testWidgets('the active pill eases in over 250 ms', (tester) async {
    await tester.pumpWidget(_bar(reduceMotion: false));
    final pill = tester.widget<AnimatedContainer>(
      find.byType(AnimatedContainer).first,
    );
    expect(pill.duration, const Duration(milliseconds: 250));
  });

  testWidgets('nothing moves with reduced motion', (tester) async {
    await tester.pumpWidget(_bar(reduceMotion: true));
    final pills = tester.widgetList<AnimatedContainer>(
      find.byType(AnimatedContainer),
    );
    expect(pills.map((p) => p.duration), everyElement(Duration.zero));
  });

  testWidgets('tapping a tab reports its index', (tester) async {
    int? selected;
    await tester.pumpWidget(
      _bar(reduceMotion: false, onSelect: (i) => selected = i),
    );
    await tester.tap(find.text('Two'));
    expect(selected, 1);
  });

  testWidgets('each tab is at least 44 px tall', (tester) async {
    await tester.pumpWidget(_bar(reduceMotion: false));
    final size = tester.getSize(
      find.ancestor(
        of: find.text('Two'),
        matching: find.byType(GestureDetector),
      ),
    );
    expect(size.height, greaterThanOrEqualTo(44));
  });

  /// WCAG 2.x contrast ratio.
  double contrast(Color a, Color b) {
    final la = a.computeLuminance();
    final lb = b.computeLuminance();
    return (math.max(la, lb) + 0.05) / (math.min(la, lb) + 0.05);
  }

  for (final (brightness, colors) in [
    (Brightness.light, QuadColors.light),
    (Brightness.dark, QuadColors.dark),
  ]) {
    testWidgets('the active tab is a brand-fill pill with readable text and '
        'icon (${brightness.name})', (tester) async {
      await tester.pumpWidget(_bar(reduceMotion: true, brightness: brightness));
      final pill = tester.widget<AnimatedContainer>(
        find.byType(AnimatedContainer).first,
      );
      final fill = (pill.decoration! as BoxDecoration).color!;
      // Ruling R16: filled brand surfaces use brand-fill, not brand.
      expect(fill, colors.brandFill);

      final icon = tester.widget<SvgPicture>(find.byType(SvgPicture).first);
      expect(
        icon.colorFilter,
        ColorFilter.mode(colors.brandInk, BlendMode.srcIn),
      );
      expect(contrast(colors.brandInk, fill), greaterThanOrEqualTo(4.5));

      final label = tester.widget<Text>(find.text('One')).style!.color!;
      expect(contrast(label, colors.surface), greaterThanOrEqualTo(4.5));
    });
  }

  testWidgets('at text size 2.0 the five labels stay apart', (tester) async {
    tester.view
      ..physicalSize = const Size(390, 844) * 2
      ..devicePixelRatio = 2;
    addTearDown(tester.view.reset);
    const labels = ['Home', 'Circle', 'Payments', 'Messages', 'More'];
    await tester.pumpWidget(
      MaterialApp(
        theme: quadTheme(Brightness.light),
        home: MediaQuery(
          data: const MediaQueryData(
            size: Size(390, 844),
            textScaler: TextScaler.linear(2),
          ),
          child: Scaffold(
            bottomNavigationBar: QuadTabBar(
              tabs: [
                for (final label in labels)
                  (label: label, icon: 'assets/icons/tab-home.svg'),
              ],
              currentIndex: 0,
              semanticLabel: 'Main',
              onSelect: (_) {},
            ),
          ),
        ),
      ),
    );

    // Labels still grow, but no further than 1.3x.
    final scaler = MediaQuery.textScalerOf(
      tester.element(find.text('Payments')),
    );
    expect(scaler.scale(10), closeTo(13, 0.01));

    final rects = [for (final l in labels) tester.getRect(find.text(l))];
    for (var i = 0; i < rects.length - 1; i++) {
      expect(
        rects[i + 1].left - rects[i].right,
        greaterThanOrEqualTo(6),
        reason: '${labels[i]} and ${labels[i + 1]} need a visible gap',
      );
    }
  });
}
