// The parent sign-in journey against the local API and its seed (spec 17).
// Runs on a device or simulator in the nightly `pnpm e2e:mobile`, not in
// `pnpm verify`:
//   flutter test integration_test/sign_in_test.dart --flavor dev \
//     --dart-define-from-file=env/dev.json
// It needs `docker compose up -d`, `pnpm db:reset` and `pnpm --filter
// @quad/api dev`; locally every sign-in code is 000000.
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:integration_test/integration_test.dart';
import 'package:quad_parent/app.dart';
import 'package:quad_parent/core/env.dart';
import 'package:quad_parent/core/secure_store.dart';
import 'package:quad_parent/features/auth/screens/code_screen.dart';
import 'package:quad_parent/features/auth/screens/found_you_screen.dart';
import 'package:quad_parent/features/auth/screens/welcome_screen.dart';
import 'package:quad_parent/features/home/screens/home_screen.dart';
import 'package:quad_parent/l10n/app_localizations.dart';

/// The seeded guardian (packages/db seed): one school, so no picker.
const seededNumber = '77 000 0001';
const seededFirstName = 'Dilhani';
const seededSchool = 'Colombo International School';

void main() {
  IntegrationTestWidgetsFlutterBinding.ensureInitialized();
  final l10n = lookupAppLocalizations(const Locale('en'));

  Future<void> tapText(WidgetTester tester, String text) async {
    await tester.ensureVisible(find.text(text));
    await tester.pumpAndSettle();
    await tester.tap(find.text(text));
    await tester.pumpAndSettle();
  }

  testWidgets('a parent signs in with a code, then signs out', (tester) async {
    // Start from a device with no session.
    await const DeviceSecureStore().wipe();
    await tester.pumpWidget(
      ProviderScope(
        overrides: [envProvider.overrideWithValue(Env.fromDefines())],
        child: const QuadApp(),
      ),
    );
    await tester.pumpAndSettle();
    expect(find.byType(WelcomeScreen), findsOneWidget);

    await tapText(tester, l10n.parentWelcomeSignIn);
    await tester.enterText(find.byType(TextField), seededNumber);
    await tapText(tester, l10n.parentSignInSendCode);
    expect(find.byType(CodeScreen), findsOneWidget);

    await tester.enterText(find.byType(TextField), '000000');
    await tester.pumpAndSettle(const Duration(milliseconds: 200));
    expect(find.byType(FoundYouScreen), findsOneWidget);
    expect(
      find.text(l10n.parentSignInFoundWelcome(seededFirstName)),
      findsOneWidget,
    );
    expect(find.text(seededSchool), findsOneWidget);

    await tapText(tester, l10n.parentSignInFoundContinue);
    // A device with Face ID or a fingerprint is asked first.
    if (find.text(l10n.parentSignInFaceNotNow).evaluate().isNotEmpty) {
      await tapText(tester, l10n.parentSignInFaceNotNow);
    }
    expect(find.byType(HomeScreen), findsOneWidget);

    await tapText(tester, l10n.navParentMore);
    await tapText(tester, l10n.parentMoreSignOut);
    expect(find.byType(WelcomeScreen), findsOneWidget);
    expect(
      await const DeviceSecureStore().read(SecureKey.refreshToken),
      isNull,
    );
  });
}
