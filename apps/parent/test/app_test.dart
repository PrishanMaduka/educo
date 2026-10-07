import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:go_router/go_router.dart';
import 'package:quad_parent/features/circle/screens/circle_screen.dart';
import 'package:quad_parent/features/home/screens/home_screen.dart';
import 'package:quad_parent/features/messages/screens/messages_screen.dart';
import 'package:quad_parent/features/more/screens/more_screen.dart';
import 'package:quad_parent/features/payments/screens/payments_screen.dart';
import 'package:quad_parent/l10n/app_localizations_en.dart';
import 'package:quad_parent/ui/quad_tab_bar.dart';

import 'helpers/pump_app.dart';

void main() {
  final l10n = AppLocalizationsEn();
  final tabs = <(String, Type, String)>[
    (l10n.navParentHome, HomeScreen, l10n.parentHomePlaceholder),
    (l10n.navParentCircle, CircleScreen, l10n.parentCirclePlaceholder),
    (l10n.navParentPayments, PaymentsScreen, l10n.parentPaymentsPlaceholder),
    (l10n.navParentMessages, MessagesScreen, l10n.parentMessagesPlaceholder),
    (l10n.navParentMore, MoreScreen, l10n.parentMorePlaceholder),
  ];

  Finder tab(String label) =>
      find.descendant(of: find.byType(QuadTabBar), matching: find.text(label));

  testWidgets('shows the five tabs with their labels from the ARB', (
    tester,
  ) async {
    await tester.pumpWidget(appAt(mondayMorning));
    await tester.pumpAndSettle();

    for (final (label, _, _) in tabs) {
      expect(tab(label), findsOneWidget);
    }
  });

  testWidgets('opens on Home with the date and the greeting', (tester) async {
    await tester.pumpWidget(appAt(mondayMorning));
    await tester.pumpAndSettle();

    expect(find.byType(HomeScreen), findsOneWidget);
    expect(find.text('Monday 5 October'), findsOneWidget);
    expect(find.text(l10n.greetingMorning), findsOneWidget);
  });

  testWidgets('greets with Hello after midnight', (tester) async {
    await tester.pumpWidget(appAt(DateTime(2026, 10, 6, 0, 30)));
    await tester.pumpAndSettle();

    expect(find.text(l10n.greetingHello), findsOneWidget);
  });

  testWidgets('tapping Payments shows the Payments screen', (tester) async {
    await tester.pumpWidget(appAt(mondayMorning));
    await tester.pumpAndSettle();

    await tester.tap(tab(l10n.navParentPayments));
    await tester.pumpAndSettle();

    expect(find.byType(PaymentsScreen), findsOneWidget);
    expect(find.byType(HomeScreen), findsNothing);
    expect(find.text(l10n.parentPaymentsPlaceholder), findsOneWidget);
  });

  testWidgets('every tab opens its screen and is marked selected', (
    tester,
  ) async {
    final semantics = tester.ensureSemantics();
    await tester.pumpWidget(appAt(mondayMorning));
    await tester.pumpAndSettle();

    for (final (label, screen, placeholder) in tabs) {
      await tester.tap(tab(label));
      await tester.pumpAndSettle();

      expect(find.byType(screen), findsOneWidget, reason: label);
      expect(find.text(placeholder), findsOneWidget, reason: label);
      expect(
        tester.getSemantics(
          find.ancestor(of: tab(label), matching: find.byType(Semantics)).first,
        ),
        isSemantics(label: label, isSelected: true, isButton: true),
        reason: label,
      );
    }
    semantics.dispose();
  });

  testWidgets('an unknown link shows the not-found page with a way home', (
    tester,
  ) async {
    await tester.pumpWidget(appAt(mondayMorning));
    await tester.pumpAndSettle();

    GoRouter.of(tester.element(find.byType(HomeScreen))).go('/nowhere');
    await tester.pumpAndSettle();

    expect(find.text(l10n.notFoundTitle), findsOneWidget);
    await tester.tap(find.text(l10n.notFoundAction));
    await tester.pumpAndSettle();
    expect(find.byType(HomeScreen), findsOneWidget);
  });
}
