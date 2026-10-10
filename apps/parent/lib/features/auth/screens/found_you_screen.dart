import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:quad_api/quad_api.dart';
import 'package:quad_parent/core/me.dart';
import 'package:quad_parent/features/auth/providers/biometrics.dart';
import 'package:quad_parent/features/auth/providers/sign_in_flow.dart';
import 'package:quad_parent/features/auth/widgets/sign_in_frame.dart';
import 'package:quad_parent/l10n/app_localizations.dart';
import 'package:quad_parent/theme/theme.dart';

/// Found you (spec 05 Parent app step 4): "You're signed in. Welcome,
/// {first name}." with the school; from here the app wears the school's
/// brand. The children line arrives with `GET /family/home` (OQ13). The code
/// can also find no school ("We couldn't find you").
class FoundYouScreen extends ConsumerWidget {
  const new({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final l10n = AppLocalizations.of(context);
    final result = ref.watch(signInFlowProvider).result;
    if (result?.status == OtpVerifyResultStatusEnum.notFound) {
      return const _NotFound();
    }
    return switch (ref.watch(meProvider)) {
      AsyncData(:final value) => _SignedIn(me: value),
      AsyncError() => SignInCentered(
        children: [
          Text(
            l10n.parentSignInFoundLoadFailed,
            textAlign: TextAlign.center,
            style: Theme.of(context).textTheme.bodyLarge,
          ),
          const SizedBox(height: 20),
          SignInButton(
            label: l10n.parentSignInRetry,
            onPressed: () => ref.invalidate(meProvider),
          ),
        ],
      ),
      _ => SignInCentered(
        children: [
          const Center(child: CircularProgressIndicator()),
          const SizedBox(height: 16),
          Text(
            l10n.parentSignInFoundLoading,
            textAlign: TextAlign.center,
            style: Theme.of(context).textTheme.bodyLarge,
          ),
        ],
      ),
    };
  }
}

class _SignedIn extends ConsumerStatefulWidget {
  const new({required this.me});

  final Me me;

  @override
  ConsumerState<_SignedIn> createState() => _SignedInState();
}

class _SignedInState extends ConsumerState<_SignedIn> {
  var _continuing = false;

  /// The Face ID offer when the device has a biometric, otherwise Home.
  Future<void> _continue() async {
    setState(() => _continuing = true);
    final l10n = AppLocalizations.of(context);
    final messenger = ScaffoldMessenger.of(context);
    final kind = await ref.read(biometricKindProvider.future);
    if (!mounted) return;
    if (kind != null) {
      context.go('/sign-in/face-id');
      return;
    }
    context.go('/home');
    messenger.showSnackBar(SnackBar(content: Text(l10n.parentSignInDone)));
  }

  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context);
    final c = context.colors;
    final text = Theme.of(context).textTheme;
    return SignInCentered(
      children: [
        SignInBadge(
          icon: Icons.check_rounded,
          background: c.good,
          foreground: c.surface,
        ),
        const SizedBox(height: 18),
        Semantics(
          header: true,
          child: Text(
            l10n.parentSignInFoundTitle,
            textAlign: TextAlign.center,
            style: text.headlineSmall,
          ),
        ),
        const SizedBox(height: 8),
        Text(
          l10n.parentSignInFoundWelcome(widget.me.person.firstName),
          textAlign: TextAlign.center,
          style: text.bodyLarge,
        ),
        const SizedBox(height: 4),
        Text(
          widget.me.school.name,
          textAlign: TextAlign.center,
          style: text.bodyLarge?.copyWith(
            color: c.ink,
            fontWeight: FontWeight.w700,
          ),
        ),
        const SizedBox(height: 28),
        SignInButton(
          label: l10n.parentSignInFoundContinue,
          busy: _continuing,
          onPressed: _continue,
        ),
      ],
    );
  }
}

class _NotFound extends StatelessWidget {
  const new();

  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context);
    final c = context.colors;
    final text = Theme.of(context).textTheme;
    return SignInCentered(
      children: [
        SignInBadge(
          icon: Icons.person_search_outlined,
          background: c.surface2,
          foreground: c.ink2,
        ),
        const SizedBox(height: 18),
        Semantics(
          header: true,
          child: Text(
            l10n.parentSignInNotFoundTitle,
            textAlign: TextAlign.center,
            style: text.headlineSmall,
          ),
        ),
        const SizedBox(height: 8),
        Text(
          l10n.parentSignInNotFoundBody,
          textAlign: TextAlign.center,
          style: text.bodyLarge,
        ),
        const SizedBox(height: 28),
        SignInButton(
          label: l10n.parentSignInNotFoundTryAgain,
          onPressed: () => context.go('/sign-in/phone'),
        ),
      ],
    );
  }
}
