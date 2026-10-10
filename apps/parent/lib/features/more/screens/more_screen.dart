import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:quad_parent/core/auth/auth_controller.dart';
import 'package:quad_parent/core/me.dart';
import 'package:quad_parent/features/more/widgets/switch_school_sheet.dart';
import 'package:quad_parent/l10n/app_localizations.dart';
import 'package:quad_parent/theme/theme.dart';
import 'package:quad_parent/theme/tokens.g.dart';
import 'package:quad_parent/ui/quad_empty_state.dart';
import 'package:quad_parent/ui/tab_page.dart';

/// More tab: profiles, school life and settings arrive in M6 and M8. Today
/// it has the account rows: **Switch school** (only with another school,
/// spec 09 Profile) and **Sign out**.
class MoreScreen extends ConsumerStatefulWidget {
  const new({super.key});

  @override
  ConsumerState<MoreScreen> createState() => _MoreScreenState();
}

class _MoreScreenState extends ConsumerState<MoreScreen> {
  var _signingOut = false;

  Future<void> _signOut() async {
    setState(() => _signingOut = true);
    // The router takes the parent to Welcome once the device is wiped.
    await ref.read(authControllerProvider.notifier).signOut();
  }

  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context);
    final text = Theme.of(context).textTheme;
    final c = context.colors;
    final current = ref.watch(currentMeProvider);
    final me = current.value;
    final others = me?.memberships ?? const [];
    return TabPage(
      header: Semantics(
        header: true,
        child: Text(l10n.navParentMore, style: text.headlineSmall),
      ),
      children: [
        QuadEmptyState(message: l10n.parentMorePlaceholder),
        // After a switch the new school may fail to load: the parent is in
        // it, and can try again.
        if (current.hasError &&
            !current.isLoading &&
            current.error is! NotSignedIn) ...[
          const SizedBox(height: 16),
          Semantics(
            liveRegion: true,
            child: Text(
              l10n.parentSignInFoundLoadFailed,
              style: text.bodyLarge,
            ),
          ),
          Align(
            alignment: Alignment.centerLeft,
            child: TextButton(
              onPressed: () => reloadCurrentMe(ref),
              style: TextButton.styleFrom(minimumSize: const Size(44, 44)),
              child: Text(l10n.parentSignInRetry),
            ),
          ),
        ],
        const SizedBox(height: 20),
        Padding(
          padding: const EdgeInsets.fromLTRB(4, 0, 4, 8),
          child: Semantics(
            header: true,
            child: Text(l10n.parentMoreAccount, style: text.labelMedium),
          ),
        ),
        DecoratedBox(
          decoration: BoxDecoration(
            color: c.surface,
            borderRadius: BorderRadius.circular(QuadTokens.radiusCard),
            border: Border.all(color: c.line),
          ),
          child: Column(
            children: [
              if (me != null && others.isNotEmpty) ...[
                _Row(
                  icon: Icons.swap_horiz,
                  label: l10n.parentMoreSwitchSchool,
                  onTap: () => showSwitchSchoolSheet(context, me),
                ),
                Divider(height: 1, color: c.line),
              ],
              _Row(
                icon: Icons.logout,
                label: l10n.parentMoreSignOut,
                busy: _signingOut,
                onTap: _signingOut ? null : _signOut,
              ),
            ],
          ),
        ),
      ],
    );
  }
}

class _Row extends StatelessWidget {
  const new({
    required this.icon,
    required this.label,
    required this.onTap,
    this.busy = false,
  });

  final IconData icon;
  final String label;
  final VoidCallback? onTap;
  final bool busy;

  @override
  Widget build(BuildContext context) {
    final c = context.colors;
    return Semantics(
      button: true,
      label: label,
      excludeSemantics: true,
      child: InkWell(
        onTap: onTap,
        borderRadius: BorderRadius.circular(QuadTokens.radiusCard),
        child: ConstrainedBox(
          constraints: const BoxConstraints(minHeight: 52),
          child: Padding(
            padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
            child: Row(
              children: [
                Icon(icon, color: c.ink2),
                const SizedBox(width: 14),
                Expanded(
                  child: Text(
                    label,
                    style: Theme.of(context).textTheme.bodyLarge
                        ?.copyWith(color: c.ink, fontWeight: FontWeight.w600),
                  ),
                ),
                if (busy)
                  const SizedBox.square(
                    dimension: 18,
                    child: CircularProgressIndicator(strokeWidth: 2.5),
                  )
                else
                  Icon(Icons.chevron_right, color: c.ink3),
              ],
            ),
          ),
        ),
      ),
    );
  }
}
