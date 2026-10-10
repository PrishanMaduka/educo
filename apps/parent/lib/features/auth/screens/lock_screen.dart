import 'package:flutter/material.dart';
import 'package:quad_parent/l10n/app_localizations.dart';

/// The lock screen (spec 09 Start-up 2). Task 25 adds the school logo, the
/// Face ID or fingerprint prompt and "Use passcode"; until then the title only.
class LockScreen extends StatelessWidget {
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
                AppLocalizations.of(context).parentLockTitle,
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
