import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:quad_parent/l10n/app_localizations.dart';
import 'package:quad_parent/theme/theme.dart';

/// Shown for a link the app does not know, with a way back to Home.
class NotFoundScreen extends StatelessWidget {
  const new({super.key});

  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context);
    final text = Theme.of(context).textTheme;
    return Scaffold(
      backgroundColor: context.colors.canvas,
      body: SafeArea(
        child: ListView(
          padding: const EdgeInsets.fromLTRB(18, 32, 18, 24),
          children: [
            Semantics(
              header: true,
              child: Text(l10n.notFoundTitle, style: text.headlineSmall),
            ),
            const SizedBox(height: 8),
            Text(l10n.notFoundBody, style: text.bodyLarge),
            const SizedBox(height: 20),
            Align(
              alignment: Alignment.centerLeft,
              child: FilledButton(
                onPressed: () => context.go('/home'),
                child: Text(l10n.notFoundAction),
              ),
            ),
          ],
        ),
      ),
    );
  }
}
