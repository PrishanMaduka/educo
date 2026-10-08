import 'package:flutter/widgets.dart';
import 'package:go_router/go_router.dart';
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
  final router = GoRouter(
    initialLocation: '/home',
    errorBuilder: (context, state) => const NotFoundScreen(),
    routes: [
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
  ref.onDispose(router.dispose);
  return router;
}

StatefulShellBranch _tab(String path, Widget screen) => StatefulShellBranch(
  routes: [GoRoute(path: path, builder: (context, state) => screen)],
);
