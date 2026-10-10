import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:quad_parent/core/lock/lock_controller.dart';
import 'package:quad_parent/core/me.dart';
import 'package:quad_parent/l10n/app_localizations.dart';
import 'package:quad_parent/router.dart';
import 'package:quad_parent/theme/theme.dart';

/// The Quad parent app: Quad-branded until signed in, then in the school's
/// brand from `GET /me` (D13); strings and the tab router.
class QuadApp extends ConsumerStatefulWidget {
  const new({super.key});

  @override
  ConsumerState<QuadApp> createState() => _QuadAppState();
}

class _QuadAppState extends ConsumerState<QuadApp> {
  // Re-lock is measured from `paused` (spec 09); `inactive` (the iOS app
  // switcher, a system sheet) does not count.
  late final AppLifecycleListener _lifecycle;

  @override
  void initState() {
    super.initState();
    _lifecycle = AppLifecycleListener(
      onPause: () => ref.read(lockControllerProvider.notifier).paused(),
      onResume: () => ref.read(lockControllerProvider.notifier).resumed(),
    );
  }

  @override
  void dispose() {
    _lifecycle.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final brand = ref.watch(schoolBrandProvider);
    return MaterialApp.router(
      onGenerateTitle: (context) => AppLocalizations.of(context).appNameParent,
      debugShowCheckedModeBanner: false,
      theme: quadTheme(Brightness.light, brand: brand),
      darkTheme: quadTheme(Brightness.dark, brand: brand),
      localizationsDelegates: AppLocalizations.localizationsDelegates,
      supportedLocales: AppLocalizations.supportedLocales,
      routerConfig: ref.watch(routerProvider),
    );
  }
}
