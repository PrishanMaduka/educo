import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:quad_parent/core/lock/lock_controller.dart';
import 'package:quad_parent/features/auth/providers/biometrics.dart';
import 'package:quad_parent/features/auth/widgets/sign_in_frame.dart';
import 'package:quad_parent/l10n/app_localizations.dart';
import 'package:quad_parent/theme/theme.dart';

/// "Unlock with Face ID?" (spec 05 Parent app step 6): **Turn on** or **Not
/// now**; nothing is on until the parent chooses it. "Allow notifications?"
/// follows in M6.
class FaceIdOfferScreen extends ConsumerStatefulWidget {
  const new({super.key});

  @override
  ConsumerState<FaceIdOfferScreen> createState() => _FaceIdOfferState();
}

class _FaceIdOfferState extends ConsumerState<FaceIdOfferScreen> {
  var _saving = false;

  Future<void> _finish({
    required bool turnOn,
    required BiometricKind kind,
  }) async {
    final l10n = AppLocalizations.of(context);
    final messenger = ScaffoldMessenger.of(context);
    if (turnOn) {
      setState(() => _saving = true);
      await ref.read(lockControllerProvider.notifier).setBiometricsOn(on: true);
    }
    if (!mounted) return;
    context.go('/home');
    messenger.showSnackBar(
      SnackBar(
        content: Text(switch ((turnOn, kind)) {
          (false, _) => l10n.parentSignInDone,
          (true, BiometricKind.face) => l10n.parentSignInFaceOn,
          (true, BiometricKind.fingerprint) => l10n.parentSignInFingerprintOn,
        }),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final kind = ref.watch(biometricKindProvider);
    return switch (kind) {
      AsyncData(value: final BiometricKind kind) => _offer(context, kind),
      // No biometric on this device (or it can't be read): nothing to offer.
      AsyncData() || AsyncError() => const _GoHome(),
      _ => const SignInCentered(
        children: [Center(child: CircularProgressIndicator())],
      ),
    };
  }

  Widget _offer(BuildContext context, BiometricKind kind) {
    final l10n = AppLocalizations.of(context);
    final c = context.colors;
    final text = Theme.of(context).textTheme;
    final isFace = kind == BiometricKind.face;
    return SignInCentered(
      children: [
        SignInBadge(
          icon: isFace ? Icons.face_outlined : Icons.fingerprint,
          background: c.brandSoft,
          foreground: c.brandText,
        ),
        const SizedBox(height: 18),
        Semantics(
          header: true,
          child: Text(
            isFace
                ? l10n.parentSignInFaceTitle
                : l10n.parentSignInFingerprintTitle,
            textAlign: TextAlign.center,
            style: text.headlineSmall,
          ),
        ),
        const SizedBox(height: 8),
        Text(
          isFace ? l10n.parentSignInFaceBody : l10n.parentSignInFingerprintBody,
          textAlign: TextAlign.center,
          style: text.bodyLarge,
        ),
        const SizedBox(height: 28),
        SignInButton(
          label: isFace
              ? l10n.parentSignInFaceTurnOn
              : l10n.parentSignInFingerprintTurnOn,
          busy: _saving,
          onPressed: () => _finish(turnOn: true, kind: kind),
        ),
        const SizedBox(height: 6),
        SignInLink(
          label: l10n.parentSignInFaceNotNow,
          onPressed: _saving ? null : () => _finish(turnOn: false, kind: kind),
        ),
      ],
    );
  }
}

/// Goes on to Home after this frame.
class _GoHome extends StatefulWidget {
  const new();

  @override
  State<_GoHome> createState() => _GoHomeState();
}

class _GoHomeState extends State<_GoHome> {
  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (mounted) context.go('/home');
    });
  }

  @override
  Widget build(BuildContext context) => const SizedBox.shrink();
}
