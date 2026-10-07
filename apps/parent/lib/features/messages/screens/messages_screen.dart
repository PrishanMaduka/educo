import 'package:flutter/material.dart';
import 'package:quad_parent/l10n/app_localizations.dart';
import 'package:quad_parent/ui/tab_page.dart';

/// Messages tab (shell): threads with teachers and the
/// office arrive in M6.
class MessagesScreen extends StatelessWidget {
  const new({super.key});

  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context);
    return PlaceholderTab(
      title: l10n.navParentMessages,
      message: l10n.parentMessagesPlaceholder,
    );
  }
}
