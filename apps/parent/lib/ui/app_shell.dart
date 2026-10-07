import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:quad_parent/l10n/app_localizations.dart';
import 'package:quad_parent/theme/theme.dart';
import 'package:quad_parent/ui/quad_tab_bar.dart';

/// The five tabs around the current tab's navigator (spec 09, Navigation).
class AppShell extends StatelessWidget {
  const new({required this.navigationShell, super.key});

  final StatefulNavigationShell navigationShell;

  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context);
    final tabs = <QuadTab>[
      (label: l10n.navParentHome, icon: 'assets/icons/tab-home.svg'),
      (label: l10n.navParentCircle, icon: 'assets/icons/tab-circle.svg'),
      (label: l10n.navParentPayments, icon: 'assets/icons/tab-payments.svg'),
      (label: l10n.navParentMessages, icon: 'assets/icons/tab-messages.svg'),
      (label: l10n.navParentMore, icon: 'assets/icons/tab-more.svg'),
    ];
    return Scaffold(
      backgroundColor: context.colors.canvas,
      body: navigationShell,
      bottomNavigationBar: QuadTabBar(
        tabs: tabs,
        currentIndex: navigationShell.currentIndex,
        semanticLabel: l10n.shellNavLabel,
        // Tapping the open tab again returns it to its first page.
        onSelect: (i) => navigationShell.goBranch(
          i,
          initialLocation: i == navigationShell.currentIndex,
        ),
      ),
    );
  }
}
