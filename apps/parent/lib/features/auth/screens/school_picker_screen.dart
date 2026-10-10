import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:quad_parent/core/api_problem.dart';
import 'package:quad_parent/core/auth/auth_controller.dart';
import 'package:quad_parent/core/auth/auth_state.dart';
import 'package:quad_parent/features/auth/widgets/school_tile.dart';
import 'package:quad_parent/features/auth/widgets/sign_in_frame.dart';
import 'package:quad_parent/l10n/app_localizations.dart';

/// The school picker (spec 09 Start-up 3): the code was right and the parent
/// is in several schools (or one that is paused). They choose within the
/// 5 minutes the `select_school` token lasts.
class SchoolPickerScreen extends ConsumerStatefulWidget {
  const new({super.key});

  @override
  ConsumerState<SchoolPickerScreen> createState() => _SchoolPickerState();
}

class _SchoolPickerState extends ConsumerState<SchoolPickerScreen> {
  String? _opening;
  String? _error;

  /// The choice on screen; kept while the chosen school opens (the state is
  /// then signed in, before the next step shows).
  ChoosingSchool? _choosing;

  Future<void> _open(String tenantId) async {
    final l10n = AppLocalizations.of(context);
    setState(() {
      _opening = tenantId;
      _error = null;
    });
    try {
      await ref.read(authControllerProvider.notifier).chooseSchool(tenantId);
      if (mounted) context.go('/sign-in/found');
    } on Object catch (error) {
      if (!mounted) return;
      setState(() {
        _opening = null;
        // A 401 (the 5 minutes ran out) signs out: the screen says so.
        if (apiProblemOf(error) != ApiProblem.unauthorized) {
          _error = apiProblemOf(error) == ApiProblem.offline
              ? l10n.parentSignInErrorOffline
              : l10n.parentSignInSchoolFailed;
        }
      });
    }
  }

  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context);
    final text = Theme.of(context).textTheme;
    final auth = ref.watch(authControllerProvider);
    if (auth is ChoosingSchool) _choosing = auth;
    final choosing = auth is SignedOut ? null : _choosing;
    final memberships = choosing?.memberships ?? const [];
    final firstName = choosing?.firstName;
    return SignInFrame(
      title: l10n.parentSignInSchoolTitle,
      onBack: _opening != null ? null : () => context.go('/welcome'),
      children: [
        if (choosing == null) ...[
          Text(l10n.parentSignInSchoolExpired, style: text.bodyLarge),
          const SizedBox(height: 18),
          SignInButton(
            label: l10n.parentWelcomeSignIn,
            onPressed: () => context.go('/sign-in/phone'),
          ),
        ] else if (memberships.isEmpty)
          Text(l10n.parentSignInSchoolNone, style: text.bodyLarge)
        else ...[
          Text(
            firstName == null
                ? l10n.parentSignInSchoolIntro
                : l10n.parentSignInSchoolIntroNamed(firstName),
            style: text.bodyLarge,
          ),
          const SizedBox(height: 18),
          for (final school in memberships) ...[
            SchoolTile(
              name: school.name,
              shortName: school.shortName,
              busy: _opening == school.tenantId,
              note: school.suspended
                  ? school.suspendReason ?? l10n.parentSignInSchoolPaused
                  : null,
              onTap: school.suspended || _opening != null
                  ? null
                  : () => _open(school.tenantId),
            ),
            const SizedBox(height: 10),
          ],
          SignInError(message: _error),
        ],
      ],
    );
  }
}
