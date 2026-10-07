import 'package:flutter/material.dart';
import 'package:quad_parent/l10n/app_localizations.dart';
import 'package:quad_parent/ui/tab_page.dart';

/// Payments tab (shell): invoices and the pay sheet
/// arrive in M7.
class PaymentsScreen extends StatelessWidget {
  const PaymentsScreen({super.key});

  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context);
    return PlaceholderTab(
      title: l10n.navParentPayments,
      message: l10n.parentPaymentsPlaceholder,
    );
  }
}
