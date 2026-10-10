import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:quad_api/quad_api.dart';
import 'package:quad_parent/features/auth/widgets/school_tile.dart';
import 'package:quad_parent/features/more/providers/school_switch.dart';
import 'package:quad_parent/l10n/app_localizations.dart';
import 'package:quad_parent/theme/theme.dart';

/// **Switch school**: the parent's other schools as a bottom sheet (the
/// prototype's sheet). A paused school is listed but cannot be opened.
Future<void> showSwitchSchoolSheet(BuildContext context, Me me) =>
    showModalBottomSheet<void>(
      context: context,
      isScrollControlled: true,
      showDragHandle: true,
      backgroundColor: context.colors.canvas,
      builder: (_) => SwitchSchoolSheet(me: me),
    );

class SwitchSchoolSheet extends ConsumerStatefulWidget {
  const new({required this.me, super.key});

  final Me me;

  @override
  ConsumerState<SwitchSchoolSheet> createState() => _SwitchSchoolSheetState();
}

class _SwitchSchoolSheetState extends ConsumerState<SwitchSchoolSheet> {
  String? _opening;

  Future<void> _open(MeMembershipsInner school) async {
    final l10n = AppLocalizations.of(context);
    final messenger = ScaffoldMessenger.of(context);
    final navigator = Navigator.of(context);
    setState(() => _opening = school.tenantId);
    try {
      final me = await ref
          .read(schoolSwitchProvider.notifier)
          .to(school.tenantId);
      navigator.pop();
      messenger.showSnackBar(
        SnackBar(
          content: Text(l10n.parentMoreSwitchSchoolDone(me.school.name)),
        ),
      );
    } on Object {
      if (!mounted) return;
      setState(() => _opening = null);
      messenger.showSnackBar(
        SnackBar(content: Text(l10n.parentMoreSwitchSchoolFailed)),
      );
    }
  }

  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context);
    final text = Theme.of(context).textTheme;
    // Keeps the switch alive while the sheet is open.
    ref.watch(schoolSwitchProvider);
    return SafeArea(
      child: ListView(
        shrinkWrap: true,
        padding: const EdgeInsets.fromLTRB(20, 0, 20, 20),
        children: [
          Semantics(
            header: true,
            child: Text(l10n.parentMoreSwitchSchool, style: text.headlineSmall),
          ),
          const SizedBox(height: 6),
          Text(
            l10n.parentMoreSwitchSchoolIntro(widget.me.school.name),
            style: text.bodyLarge,
          ),
          const SizedBox(height: 16),
          for (final school in widget.me.memberships) ...[
            SchoolTile(
              name: school.name,
              shortName: school.shortName,
              busy: _opening == school.tenantId,
              note: school.suspended ? l10n.parentSignInSchoolPaused : null,
              onTap: school.suspended || _opening != null
                  ? null
                  : () => _open(school),
            ),
            const SizedBox(height: 10),
          ],
        ],
      ),
    );
  }
}
