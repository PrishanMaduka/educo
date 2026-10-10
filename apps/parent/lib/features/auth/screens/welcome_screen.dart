import 'package:flutter/material.dart';
import 'package:quad_parent/l10n/app_localizations.dart';

/// Welcome (spec 09 Start-up 3). Task 25 builds the Quad-branded screen with
/// **Sign in** and **I have an invite code**; until then it is the title only.
class WelcomeScreen extends StatelessWidget {
  const new({super.key});

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      body: SafeArea(
        child: Center(
          child: Padding(
            padding: const EdgeInsets.all(24),
            child: Semantics(
              header: true,
              child: Text(
                AppLocalizations.of(context).parentWelcomeTitle,
                textAlign: TextAlign.center,
                style: Theme.of(context).textTheme.headlineSmall,
              ),
            ),
          ),
        ),
      ),
    );
  }
}
