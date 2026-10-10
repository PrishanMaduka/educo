import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:quad_parent/app.dart';
import 'package:quad_parent/core/api.dart';
import 'package:quad_parent/core/cache_wipe.dart';
import 'package:quad_parent/core/clock.dart';
import 'package:quad_parent/core/install_marker.dart';
import 'package:quad_parent/core/lock/lock_controller.dart';
import 'package:quad_parent/core/secure_store.dart';
import 'package:quad_parent/features/auth/screens/welcome_screen.dart';
import 'package:quad_parent/features/more/screens/more_screen.dart';
import 'package:quad_parent/l10n/app_localizations.dart';
import 'package:quad_parent/theme/tokens.g.dart';

import '../../helpers/auth_fakes.dart';
import '../../helpers/contrast.dart';
import '../../helpers/pump_app.dart';
import '../../helpers/sign_in_data.dart';

final AppLocalizations l10n = lookupAppLocalizations(const Locale('en'));

/// What happened, in order: each request as `<route> <bearer>`, and `wipe`.
typedef Log = List<String>;

/// A signed-in device in [greenfield] on the More tab.
Future<(FakeApi, MemorySecureStore, Log)> openMore(
  WidgetTester tester, {
  List<School> others = const [],
  bool othersSuspended = false,
  Map<String, FakeRoute> routes = const {},
  FutureOr<FakeReply> Function()? riversideMe,
  Map<String, Object> brand = greenBrand,
}) async {
  final log = <String>[];
  var school = greenfield;
  late final FakeApi api;
  FakeRoute logged(FakeRoute route) => (request) {
    log.add('${request.method} ${request.uri.path} ${bearerOf(request)}');
    return route(request);
  };
  api = FakeApi({
    'POST /api/v1/auth/refresh': logged(
      (_) => const FakeReply(200, {'accessToken': 'a1', 'refreshToken': 'r1'}),
    ),
    'GET /api/v1/me': logged(
      (_) => school == riverside && riversideMe != null
          ? riversideMe()
          : FakeReply(
              200,
              meJson(
                school: school,
                brand: brand,
                others: [
                  for (final other in [greenfield, ...others])
                    if (other != school) other,
                ],
                othersSuspended: othersSuspended,
              ),
            ),
    ),
    'POST /api/v1/auth/select-school': logged((request) {
      school = bodyOf(request)['tenantId'] == riverside.id
          ? riverside
          : greenfield;
      return const FakeReply(200, {'accessToken': 'a-riverside'});
    }),
    'POST /api/v1/auth/sign-out': logged((_) => const FakeReply(204)),
    ...routes,
  });
  final store = signedInStore();
  final container = ProviderContainer(
    overrides: [
      clockProvider.overrideWithValue(() => mondayMorning),
      secureStoreProvider.overrideWithValue(store),
      installMarkerProvider.overrideWithValue(MemoryInstallMarker()),
      localAuthProvider.overrideWithValue(FakeLocalAuth()),
      cacheWipeProvider.overrideWithValue(() async => log.add('wipe')),
    ],
  );
  addTearDown(container.dispose);
  container.read(quadApiProvider).dio.httpClientAdapter = api;
  await tester.pumpWidget(
    UncontrolledProviderScope(container: container, child: const QuadApp()),
  );
  await tester.pumpAndSettle();
  await tester.tap(find.text(l10n.navParentMore));
  await tester.pumpAndSettle();
  return (api, store, log);
}

void main() {
  testWidgets('has no Switch school with one school', (tester) async {
    await openMore(tester);

    expect(find.text(l10n.parentMoreSignOut), findsOneWidget);
    expect(find.text(l10n.parentMoreSwitchSchool), findsNothing);
  });

  testWidgets('Switch school lists the other schools', (tester) async {
    await openMore(tester, others: [riverside]);

    await tester.tap(find.text(l10n.parentMoreSwitchSchool));
    await tester.pumpAndSettle();

    expect(
      find.text(l10n.parentMoreSwitchSchoolIntro(greenfield.name)),
      findsOneWidget,
    );
    expect(find.text(riverside.name), findsOneWidget);
  });

  testWidgets(
    'Switch school leaves no cached row of the previous school (spec 09)',
    (tester) async {
      final (_, store, log) = await openMore(tester, others: [riverside]);
      log.clear();

      await tester.tap(find.text(l10n.parentMoreSwitchSchool));
      await tester.pumpAndSettle();
      await tester.tap(find.text(riverside.name));
      await tester.pumpAndSettle();

      // The cache is wiped before anything uses the new school's token.
      expect(log, [
        'POST /api/v1/auth/select-school Bearer a1',
        'wipe',
        'GET /api/v1/me Bearer a-riverside',
      ]);
      expect(
        find.text(l10n.parentMoreSwitchSchoolDone(riverside.name)),
        findsOneWidget,
      );
      // The previous school's Me is gone: Switch school now offers it back.
      await tester.tap(find.text(l10n.parentMoreSwitchSchool));
      await tester.pumpAndSettle();
      expect(
        find.text(l10n.parentMoreSwitchSchoolIntro(riverside.name)),
        findsOneWidget,
      );
      expect(find.text(greenfield.name), findsOneWidget);
      // The refresh token stays: the family moves with the parent.
      expect(store.values[SecureKey.refreshToken], 'r1');
    },
  );

  testWidgets('nothing of the previous school shows while the new one loads', (
    tester,
  ) async {
    final riversideMe = Completer<FakeReply>();
    await openMore(
      tester,
      others: [riverside],
      riversideMe: () => riversideMe.future,
    );
    QuadColors colours() =>
        Theme.of(tester.element(find.byType(MoreScreen)))
            .extension<QuadColors>()!;
    expect(colours().brandFill, const Color(0xFF1B7F53));
    await tester.tap(find.text(l10n.parentMoreSwitchSchool));
    await tester.pumpAndSettle();

    await tester.tap(find.text(riverside.name));
    await tester.pump();
    await tester.pump(const Duration(milliseconds: 500));
    // The theme animates for 200 ms, and the sheet closes.
    await tester.pump(const Duration(milliseconds: 500));

    // Quad's own brand, and no school list to switch from, until Riverside
    // answers.
    expect(colours().brandFill, QuadColors.light.brandFill);
    expect(find.text(l10n.parentMoreSwitchSchool), findsNothing);
    expect(find.text(greenfield.name), findsNothing);

    riversideMe.complete(
      FakeReply(200, meJson(school: riverside, others: [greenfield])),
    );
    await tester.pumpAndSettle();
    expect(colours().brandFill, const Color(0xFF1B7F53));
    expect(find.text(l10n.parentMoreSwitchSchool), findsOneWidget);
  });

  testWidgets('a switch whose school then fails to load is still a switch', (
    tester,
  ) async {
    var attempts = 0;
    await openMore(
      tester,
      others: [riverside],
      riversideMe: () => ++attempts == 1
          ? const FakeReply(500)
          : FakeReply(200, meJson(school: riverside, others: [greenfield])),
    );
    await tester.tap(find.text(l10n.parentMoreSwitchSchool));
    await tester.pumpAndSettle();

    await tester.tap(find.text(riverside.name));
    await tester.pumpAndSettle();

    expect(
      find.text(l10n.parentMoreSwitchSchoolDone(riverside.name)),
      findsOneWidget,
    );
    expect(find.text(l10n.parentMoreSwitchSchoolFailed), findsNothing);
    expect(find.text(l10n.parentSignInFoundLoadFailed), findsOneWidget);

    await tester.tap(find.text(l10n.parentSignInRetry));
    await tester.pumpAndSettle();

    expect(find.text(l10n.parentSignInFoundLoadFailed), findsNothing);
    await tester.tap(find.text(l10n.parentMoreSwitchSchool));
    await tester.pumpAndSettle();
    expect(
      find.text(l10n.parentMoreSwitchSchoolIntro(riverside.name)),
      findsOneWidget,
    );
  });

  testWidgets('Retry reads 4.5:1 on the page in a lime school', (tester) async {
    await openMore(
      tester,
      others: [riverside],
      brand: limeBrand,
      riversideMe: () => const FakeReply(500),
    );
    await tester.tap(find.text(l10n.parentMoreSwitchSchool));
    await tester.pumpAndSettle();
    await tester.tap(find.text(riverside.name));
    await tester.pumpAndSettle();

    final retry = tester.widget<RichText>(
      find.descendant(
        of: find.widgetWithText(TextButton, l10n.parentSignInRetry),
        matching: find.byType(RichText),
      ),
    );
    final colour = retry.text.style!.color!;
    expect(
      contrast(colour, QuadColors.light.canvas),
      greaterThanOrEqualTo(4.5),
    );
  });

  testWidgets('a paused school is listed but cannot be opened', (tester) async {
    final (api, _, _) = await openMore(
      tester,
      others: [riverside],
      othersSuspended: true,
    );
    await tester.tap(find.text(l10n.parentMoreSwitchSchool));
    await tester.pumpAndSettle();

    expect(find.text(l10n.parentSignInSchoolPaused), findsOneWidget);
    await tester.tap(find.text(riverside.name));
    await tester.pumpAndSettle();

    expect(api.to('POST /api/v1/auth/select-school'), isEmpty);
  });

  testWidgets('a failed switch stays in the school and says so', (
    tester,
  ) async {
    await openMore(
      tester,
      others: [riverside],
      routes: {'POST /api/v1/auth/select-school': (_) => const FakeReply(500)},
    );
    await tester.tap(find.text(l10n.parentMoreSwitchSchool));
    await tester.pumpAndSettle();

    await tester.tap(find.text(riverside.name));
    await tester.pumpAndSettle();

    expect(find.text(l10n.parentMoreSwitchSchoolFailed), findsOneWidget);
    expect(
      find.text(l10n.parentMoreSwitchSchoolIntro(greenfield.name)),
      findsOneWidget,
    );
  });

  testWidgets('Sign out revokes, wipes the device and opens Welcome', (
    tester,
  ) async {
    final (api, store, log) = await openMore(tester);

    await tester.tap(find.text(l10n.parentMoreSignOut));
    await tester.pumpAndSettle();

    expect(bearerOf(api.to('POST /api/v1/auth/sign-out').single), 'Bearer a1');
    expect(log, contains('wipe'));
    expect(store.values, isEmpty);
    expect(find.byType(WelcomeScreen), findsOneWidget);
  });

  testWidgets('Sign out works offline too', (tester) async {
    final (_, store, _) = await openMore(
      tester,
      routes: {'POST /api/v1/auth/sign-out': (_) => const FakeReply(0)},
    );

    await tester.tap(find.text(l10n.parentMoreSignOut));
    await tester.pumpAndSettle();

    expect(store.values, isEmpty);
    expect(find.byType(WelcomeScreen), findsOneWidget);
  });
}
