import 'package:flutter/material.dart';
import 'package:quad_parent/l10n/app_localizations.dart';
import 'package:quad_parent/ui/tab_page.dart';

/// Circle tab (shell): moments, people and learning
/// arrive in M9b.
class CircleScreen extends StatelessWidget {
  const new({super.key});

  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context);
    return PlaceholderTab(
      title: l10n.navParentCircle,
      message: l10n.parentCirclePlaceholder,
    );
  }
}
