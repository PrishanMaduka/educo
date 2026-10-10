import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:quad_parent/core/secure_store.dart';
import 'package:quad_parent/l10n/app_localizations.dart';

import '../helpers/auth_fakes.dart';
import '../helpers/pump_app.dart';
import '../helpers/sign_in_data.dart';

final AppLocalizations l10n = lookupAppLocalizations(const Locale('en'));

/// How to reach each screen from a fresh launch.
final Map<String, Future<void> Function(WidgetTester)> screens = {
  'welcome': (_) async {},
  'phone': (tester) async {
    await tester.ensureVisible(find.text(l10n.parentWelcomeSignIn));
    await tester.pump();
    await tester.tap(find.text(l10n.parentWelcomeSignIn));
    await tester.pumpAndSettle();
    await tester.enterText(find.byType(TextField), '77 000 0001');
    await tester.pumpAndSettle();
  },
  'code': (tester) async {
    await screens['phone']!(tester);
    await tester.ensureVisible(find.text(l10n.parentSignInSendCode));
    await tester.pump();
    await tester.tap(find.text(l10n.parentSignInSendCode));
    await tester.pumpAndSettle();
  },
  'found_you': (tester) async {
    await screens['code']!(tester);
    await tester.enterText(find.byType(TextField), '000000');
    await tester.pumpAndSettle();
  },
  // Opened signed in with Face ID on (see the store below).
  'lock': (_) async {},
};

void main() {
  for (final MapEntry(key: screen, value: reach) in screens.entries) {
    for (final brightness in Brightness.values) {
      for (final textScale in [1.0, 2.0]) {
        final name =
            'auth_${screen}_${brightness.name}_text${textScale.toInt()}x';

        testWidgets('$screen at 390×844, $name', (tester) async {
          tester.view
            ..physicalSize = const Size(390, 844) * 2
            ..devicePixelRatio = 2;
          tester.platformDispatcher
            ..platformBrightnessTestValue = brightness
            ..textScaleFactorTestValue = textScale;
          addTearDown(tester.view.reset);
          addTearDown(tester.platformDispatcher.clearAllTestValues);

          final store = screen == 'lock'
              ? (signedInStore()..values[SecureKey.biometricsOn] = 'true')
              : MemorySecureStore();
          await tester.pumpWidget(
            appWith(
              clock: FakeClock(mondayMorning),
              store: store,
              api: FakeApi(
                signInRoutes({
                  'POST /api/v1/auth/refresh': (_) => const FakeReply(200, {
                    'accessToken': 'a1',
                    'refreshToken': 'r1',
                  }),
                }),
              ),
            ),
          );
          await tester.pumpAndSettle();
          await reach(tester);

          await expectLater(
            find.byType(MaterialApp),
            matchesGoldenFile('$name.png'),
          );
        });
      }
    }
  }
}
