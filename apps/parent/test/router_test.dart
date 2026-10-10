import 'package:flutter/widgets.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:quad_api/quad_api.dart';
import 'package:quad_parent/core/api.dart';
import 'package:quad_parent/core/auth/auth_controller.dart';
import 'package:quad_parent/core/auth/auth_state.dart';
import 'package:quad_parent/core/lock/lock_controller.dart';
import 'package:quad_parent/core/secure_store.dart';
import 'package:quad_parent/features/auth/screens/lock_screen.dart';
import 'package:quad_parent/features/auth/screens/welcome_screen.dart';
import 'package:quad_parent/features/home/screens/home_screen.dart';
import 'package:quad_parent/router.dart';

import 'helpers/auth_fakes.dart';
import 'helpers/pump_app.dart';

void main() {
  group('authRedirect', () {
    const restoring = AuthRestoring();
    const signedOut = SignedOut();
    const signedIn = SignedIn();
    const choosing = ChoosingSchool(
      firstName: 'Ruwan',
      memberships: <OtpVerifyResultMembershipsInner>[],
    );

    final cases = <(String, AuthState, bool, String, String?)>[
      ('launch waits on the splash', restoring, false, '/home', '/splash'),
      ('the splash stays while restoring', restoring, false, '/splash', null),
      ('signed out goes to Welcome', signedOut, false, '/home', '/welcome'),
      ('signed out leaves the splash', signedOut, false, '/splash', '/welcome'),
      ('signed out cannot open the lock', signedOut, true, '/lock', '/welcome'),
      ('signed out may sign in', signedOut, false, '/sign-in/phone', null),
      ('signed out stays on Welcome', signedOut, false, '/welcome', null),
      ('choosing stays in sign-in', choosing, false, '/sign-in/school', null),
      ('choosing cannot open tabs', choosing, false, '/payments', '/welcome'),
      ('locked goes to the lock', signedIn, true, '/payments', '/lock'),
      ('locked stays on the lock', signedIn, true, '/lock', null),
      ('locked leaves the splash', signedIn, true, '/splash', '/lock'),
      ('unlocked leaves the lock', signedIn, false, '/lock', '/home'),
      ('signed in leaves the splash', signedIn, false, '/splash', '/home'),
      ('signed in leaves Welcome', signedIn, false, '/welcome', '/home'),
      ('signed in finishes sign-in', signedIn, false, '/sign-in/face-id', null),
      ('signed in opens a tab', signedIn, false, '/payments', null),
    ];

    for (final (name, auth, locked, location, expected) in cases) {
      test(name, () {
        expect(
          authRedirect(auth, locked: locked, location: location),
          expected,
        );
      });
    }
  });

  group('the app', () {
    testWidgets('signed out opens on Welcome', (tester) async {
      await tester.pumpWidget(appAt(mondayMorning, store: MemorySecureStore()));
      await tester.pumpAndSettle();

      expect(find.byType(WelcomeScreen), findsOneWidget);
      expect(find.byType(HomeScreen), findsNothing);
    });

    testWidgets('signed in opens on Home', (tester) async {
      await tester.pumpWidget(appAt(mondayMorning));
      await tester.pumpAndSettle();

      expect(find.byType(HomeScreen), findsOneWidget);
    });

    testWidgets('biometrics on opens on the lock', (tester) async {
      final store = signedInStore()..values[SecureKey.biometricsOn] = 'true';
      await tester.pumpWidget(appAt(mondayMorning, store: store));
      await tester.pumpAndSettle();

      expect(find.byType(LockScreen), findsOneWidget);
      expect(find.byType(HomeScreen), findsNothing);
    });

    testWidgets('locks again after more than 5 minutes in the background', (
      tester,
    ) async {
      final clock = FakeClock(mondayMorning);
      await tester.pumpWidget(appWith(clock: clock, store: signedInStore()));
      await tester.pumpAndSettle();
      // Turned on after sign-in (Task 25's offer): no lock until it comes back.
      await ProviderScope.containerOf(tester.element(find.byType(HomeScreen)))
          .read(lockControllerProvider.notifier)
          .setBiometricsOn(on: true);
      await tester.pumpAndSettle();
      expect(find.byType(HomeScreen), findsOneWidget);

      Future<void> away(Duration duration) async {
        // The platform moves through each state in turn.
        const [
          AppLifecycleState.inactive,
          AppLifecycleState.hidden,
          AppLifecycleState.paused,
        ].forEach(tester.binding.handleAppLifecycleStateChanged);
        clock.advance(duration);
        const [
          AppLifecycleState.hidden,
          AppLifecycleState.inactive,
          AppLifecycleState.resumed,
        ].forEach(tester.binding.handleAppLifecycleStateChanged);
        await tester.pumpAndSettle();
      }

      await away(const Duration(minutes: 4, seconds: 59));
      expect(find.byType(HomeScreen), findsOneWidget);

      await away(const Duration(minutes: 5, seconds: 1));
      expect(find.byType(LockScreen), findsOneWidget);
    });

    testWidgets('a short trip to the app switcher never locks', (tester) async {
      final clock = FakeClock(mondayMorning);
      final store = signedInStore();
      await tester.pumpWidget(appWith(clock: clock, store: store));
      await tester.pumpAndSettle();
      await ProviderScope.containerOf(tester.element(find.byType(HomeScreen)))
          .read(lockControllerProvider.notifier)
          .setBiometricsOn(on: true);

      // inactive (the iOS app switcher) is not the background.
      tester.binding.handleAppLifecycleStateChanged(AppLifecycleState.inactive);
      clock.advance(const Duration(minutes: 10));
      tester.binding.handleAppLifecycleStateChanged(AppLifecycleState.resumed);
      await tester.pumpAndSettle();

      expect(find.byType(HomeScreen), findsOneWidget);
    });

    testWidgets('signing out goes to Welcome', (tester) async {
      await tester.pumpWidget(appAt(mondayMorning));
      await tester.pumpAndSettle();
      final container = ProviderScope.containerOf(
        tester.element(find.byType(HomeScreen)),
      );
      container.read(quadApiProvider).dio.httpClientAdapter = FakeApi(const {});

      // Real time: the HTTP client's timeouts are timers.
      await tester.runAsync(
        () => container.read(authControllerProvider.notifier).signOut(),
      );
      await tester.pumpAndSettle();

      expect(find.byType(WelcomeScreen), findsOneWidget);
    });
  });
}
