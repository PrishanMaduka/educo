import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:quad_parent/theme/theme.dart';
import 'package:quad_parent/ui/quad_tab_bar.dart';

Widget _bar({required bool reduceMotion, ValueChanged<int>? onSelect}) =>
    MaterialApp(
      theme: quadTheme(Brightness.light),
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
}
