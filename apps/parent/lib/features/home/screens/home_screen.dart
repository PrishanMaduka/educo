import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:quad_parent/core/clock.dart';
import 'package:quad_parent/features/home/widgets/greeting_header.dart';
import 'package:quad_parent/l10n/app_localizations.dart';
import 'package:quad_parent/ui/quad_empty_state.dart';
import 'package:quad_parent/ui/tab_page.dart';

/// Home (shell): the greeting header and what will appear here.
class HomeScreen extends ConsumerWidget {
  const new({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final now = ref.watch(clockProvider)();
    return TabPage(
      header: GreetingHeader(now: now),
      children: [
        QuadEmptyState(
          message: AppLocalizations.of(context).parentHomePlaceholder,
        ),
      ],
    );
  }
}
