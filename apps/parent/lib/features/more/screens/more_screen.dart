import 'package:flutter/material.dart';
import 'package:quad_parent/l10n/app_localizations.dart';
import 'package:quad_parent/ui/tab_page.dart';

/// More tab (shell): profiles, school life and settings
/// arrive in M6 and M8.
class MoreScreen extends StatelessWidget {
  const new({super.key});

  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context);
    return PlaceholderTab(
      title: l10n.navParentMore,
      message: l10n.parentMorePlaceholder,
    );
  }
}
