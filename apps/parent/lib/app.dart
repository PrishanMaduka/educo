import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:quad_parent/l10n/app_localizations.dart';
import 'package:quad_parent/router.dart';
import 'package:quad_parent/theme/theme.dart';

/// The Quad parent app: Quad-branded theme, strings and the tab router.
class QuadApp extends ConsumerWidget {
  const QuadApp({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    return MaterialApp.router(
      onGenerateTitle: (context) => AppLocalizations.of(context).appNameParent,
      debugShowCheckedModeBanner: false,
      theme: quadTheme(Brightness.light),
      darkTheme: quadTheme(Brightness.dark),
      localizationsDelegates: AppLocalizations.localizationsDelegates,
      supportedLocales: AppLocalizations.supportedLocales,
      routerConfig: ref.watch(routerProvider),
    );
  }
}
