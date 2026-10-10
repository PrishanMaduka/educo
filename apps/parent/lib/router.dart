import 'package:flutter/widgets.dart';
import 'package:go_router/go_router.dart';
import 'package:quad_parent/core/auth/auth_controller.dart';
import 'package:quad_parent/core/auth/auth_state.dart';
import 'package:quad_parent/core/lock/lock_controller.dart';
import 'package:quad_parent/features/auth/screens/code_screen.dart';
import 'package:quad_parent/features/auth/screens/face_id_offer_screen.dart';
import 'package:quad_parent/features/auth/screens/found_you_screen.dart';
import 'package:quad_parent/features/auth/screens/lock_screen.dart';
import 'package:quad_parent/features/auth/screens/phone_screen.dart';
import 'package:quad_parent/features/auth/screens/school_picker_screen.dart';
import 'package:quad_parent/features/auth/screens/splash_screen.dart';
import 'package:quad_parent/features/auth/screens/welcome_screen.dart';
import 'package:quad_parent/features/circle/screens/circle_screen.dart';
import 'package:quad_parent/features/home/screens/home_screen.dart';
import 'package:quad_parent/features/messages/screens/messages_screen.dart';
import 'package:quad_parent/features/more/screens/more_screen.dart';
import 'package:quad_parent/features/not_found/screens/not_found_screen.dart';
import 'package:quad_parent/features/payments/screens/payments_screen.dart';
import 'package:quad_parent/ui/app_shell.dart';
import 'package:riverpod_annotation/riverpod_annotation.dart';

part 'router.g.dart';

/// Routes and, from M6, deep links (spec 09).
@Riverpod(keepAlive: true)
GoRouter router(Ref ref) {
  // Re-runs the redirect whenever the session or the lock changes.
  final changes = ValueNotifier(0);
  ref
    ..listen(authControllerProvider, (_, _) => changes.value++)
    ..listen(lockControllerProvider, (_, _) => changes.value++);
  final router = GoRouter(
    initialLocation: '/home',
    refreshListenable: changes,
    redirect: (context, state) => authRedirect(
      ref.read(authControllerProvider),
      locked: ref.read(lockControllerProvider).locked,
      location: state.matchedLocation,
    ),
    errorBuilder: (context, state) => const NotFoundScreen(),
    routes: [
      GoRoute(
        path: '/splash',
        builder: (context, state) => const SplashScreen(),
      ),
      GoRoute(
        path: '/welcome',
        builder: (context, state) => const WelcomeScreen(),
      ),
      GoRoute(
        path: '/sign-in/phone',
        builder: (context, state) => const PhoneScreen(),
      ),
      GoRoute(
        path: '/sign-in/code',
        builder: (context, state) => const CodeScreen(),
      ),
      GoRoute(
        path: '/sign-in/school',
        builder: (context, state) => const SchoolPickerScreen(),
      ),
      GoRoute(
        path: '/sign-in/found',
        builder: (context, state) => const FoundYouScreen(),
      ),
      GoRoute(
        path: '/sign-in/face-id',
        builder: (context, state) => const FaceIdOfferScreen(),
      ),
      GoRoute(path: '/lock', builder: (context, state) => const LockScreen()),
      StatefulShellRoute.indexedStack(
        builder: (context, state, shell) => AppShell(navigationShell: shell),
        branches: [
          _tab('/home', const HomeScreen()),
          _tab('/circle', const CircleScreen()),
          _tab('/payments', const PaymentsScreen()),
          _tab('/messages', const MessagesScreen()),
          _tab('/more', const MoreScreen()),
        ],
      ),
    ],
  );
  ref.onDispose(() {
    router.dispose();
    changes.dispose();
  });
  return router;
}

/// Where the parent may be, given the session and the lock:
/// - launch waits on the splash while the session is read;
/// - signed out (or choosing a school) stays in Welcome and `/sign-in/…`;
/// - signed in and locked sees only the lock (spec 09 Re-lock);
/// - signed in leaves the splash, Welcome and the lock for Home, and may
///   finish the sign-in steps (Found you, the Face ID offer).
///
/// Null keeps [location].
String? authRedirect(
  AuthState auth, {
  required bool locked,
  required String location,
}) {
  String? to(String path) => location == path ? null : path;
  final inSignIn = location == '/welcome' || location.startsWith('/sign-in/');
  return switch (auth) {
    AuthRestoring() => to('/splash'),
    SignedOut() || ChoosingSchool() => inSignIn ? null : '/welcome',
    SignedIn() when locked => to('/lock'),
    SignedIn() =>
      const {'/splash', '/welcome', '/lock'}.contains(location)
          ? '/home'
          : null,
  };
}

StatefulShellBranch _tab(String path, Widget screen) => StatefulShellBranch(
  routes: [GoRoute(path: path, builder: (context, state) => screen)],
);
