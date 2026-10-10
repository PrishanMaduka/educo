import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:local_auth/local_auth.dart';
import 'package:quad_parent/core/secure_store.dart';
import 'package:quad_parent/features/auth/screens/lock_screen.dart';
import 'package:quad_parent/features/home/screens/home_screen.dart';
import 'package:quad_parent/l10n/app_localizations.dart';

import '../../helpers/auth_fakes.dart';
import '../../helpers/pump_app.dart';
import '../../helpers/sign_in_data.dart';

final AppLocalizations l10n = lookupAppLocalizations(const Locale('en'));

/// A device signed in earlier with Face ID on: it opens on the lock.
Future<FakeLocalAuth> openLocked(
  WidgetTester tester, {
  FakeRoute? me,
  FakeLocalAuth? localAuth,
}) async {
  final auth = localAuth ?? FakeLocalAuth();
  final store = signedInStore()..values[SecureKey.biometricsOn] = 'true';
  final api = FakeApi({
    'POST /api/v1/auth/refresh': (_) =>
        const FakeReply(200, {'accessToken': 'a1', 'refreshToken': 'r1'}),
    'GET /api/v1/me': me ?? (_) => FakeReply(200, meJson()),
  });
  await tester.pumpWidget(
    appWith(
      clock: FakeClock(mondayMorning),
      store: store,
      api: api,
      localAuth: auth,
    ),
  );
  await tester.pumpAndSettle();
  return auth;
}

void main() {
  testWidgets('says "Welcome back" with the school', (tester) async {
    await openLocked(tester);

    expect(find.byType(LockScreen), findsOneWidget);
    expect(find.bySemanticsLabel(l10n.parentLockTitle), findsOneWidget);
    expect(find.text(greenfield.name), findsOneWidget);
    expect(find.text(l10n.parentLockPoweredBy('GIS')), findsOneWidget);
    expect(find.bySemanticsLabel(l10n.parentLockUnlockFace), findsOneWidget);
    expect(find.text(l10n.parentLockTapFace), findsOneWidget);
  });

  testWidgets('shows Quad until the school has loaded', (tester) async {
    final me = Completer<FakeReply>();
    await openLocked(tester, me: (_) => me.future);

    expect(find.text(l10n.appNameParent), findsOneWidget);
    expect(find.text(greenfield.name), findsNothing);

    me.complete(FakeReply(200, meJson()));
    await tester.pumpAndSettle();
    expect(find.text(greenfield.name), findsOneWidget);
  });

  testWidgets('still unlocks when the school cannot load', (tester) async {
    final auth = await openLocked(tester, me: (_) => const FakeReply(500));

    expect(find.text(l10n.appNameParent), findsOneWidget);
    await tester.tap(find.bySemanticsLabel(l10n.parentLockUnlockFace));
    await tester.pumpAndSettle();

    expect(auth.reasons, [l10n.parentLockReason]);
    expect(find.byType(HomeScreen), findsOneWidget);
  });

  testWidgets('Face ID opens the app', (tester) async {
    final auth = await openLocked(tester);

    await tester.tap(find.bySemanticsLabel(l10n.parentLockUnlockFace));
    await tester.pumpAndSettle();

    expect(auth.reasons, [l10n.parentLockReason]);
    expect(find.byType(HomeScreen), findsOneWidget);
  });

  testWidgets('Use passcode opens the system prompt too', (tester) async {
    final auth = await openLocked(tester);

    await tester.tap(find.text(l10n.parentLockUsePasscode));
    await tester.pumpAndSettle();

    expect(auth.reasons, hasLength(1));
    expect(find.byType(HomeScreen), findsOneWidget);
  });

  testWidgets('a cancelled prompt stays locked and says so', (tester) async {
    await openLocked(tester, localAuth: FakeLocalAuth(result: false));

    await tester.tap(find.bySemanticsLabel(l10n.parentLockUnlockFace));
    await tester.pumpAndSettle();

    expect(find.byType(LockScreen), findsOneWidget);
    expect(find.text(l10n.parentLockFailed), findsOneWidget);
  });

  testWidgets('speaks of the fingerprint on a fingerprint device', (
    tester,
  ) async {
    await openLocked(
      tester,
      localAuth: FakeLocalAuth(biometrics: [BiometricType.fingerprint]),
    );

    expect(
      find.bySemanticsLabel(l10n.parentLockUnlockFingerprint),
      findsOneWidget,
    );
    expect(find.text(l10n.parentLockTapFingerprint), findsOneWidget);
  });

  testWidgets('says "Unlock" when no biometric is enrolled', (tester) async {
    await openLocked(tester, localAuth: FakeLocalAuth(biometrics: []));

    expect(find.bySemanticsLabel(l10n.parentLockUnlock), findsOneWidget);
    expect(find.text(l10n.parentLockTap), findsOneWidget);
  });
}
