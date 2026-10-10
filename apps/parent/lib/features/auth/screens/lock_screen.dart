import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_svg/flutter_svg.dart';
import 'package:quad_parent/core/lock/lock_controller.dart';
import 'package:quad_parent/core/me.dart';
import 'package:quad_parent/features/auth/providers/biometrics.dart';
import 'package:quad_parent/features/auth/widgets/school_tile.dart';
import 'package:quad_parent/l10n/app_localizations.dart';
import 'package:quad_parent/theme/theme.dart';
import 'package:quad_parent/theme/tokens.g.dart';

/// The lock screen (spec 09 Start-up 2, Re-lock): "Welcome back", the school,
/// Face ID or fingerprint, and "Use passcode". The system prompt falls back
/// to the device passcode, so both buttons open it. Until `GET /me` answers
/// it shows Quad's mark.
class LockScreen extends ConsumerStatefulWidget {
  const new({super.key});

  @override
  ConsumerState<LockScreen> createState() => _LockScreenState();
}

class _LockScreenState extends ConsumerState<LockScreen> {
  var _asking = false;
  var _failed = false;

  Future<void> _unlock() async {
    final reason = AppLocalizations.of(context).parentLockReason;
    setState(() {
      _asking = true;
      _failed = false;
    });
    final ok = await ref
        .read(lockControllerProvider.notifier)
        .unlock(reason: reason);
    if (!mounted) return;
    setState(() {
      _asking = false;
      _failed = !ok;
    });
  }

  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context);
    final c = context.colors;
    final text = Theme.of(context).textTheme;
    final school = ref.watch(meProvider).value?.school;
    final kind = ref.watch(biometricKindProvider).value;
    final (unlockLabel, tapLabel, icon) = switch (kind) {
      BiometricKind.face => (
        l10n.parentLockUnlockFace,
        l10n.parentLockTapFace,
        Icons.face_outlined,
      ),
      BiometricKind.fingerprint => (
        l10n.parentLockUnlockFingerprint,
        l10n.parentLockTapFingerprint,
        Icons.fingerprint,
      ),
      null => (l10n.parentLockUnlock, l10n.parentLockTap, Icons.lock_open),
    };
    return Scaffold(
      backgroundColor: c.rail,
      body: SafeArea(
        child: CustomScrollView(
          slivers: [
            SliverFillRemaining(
              hasScrollBody: false,
              child: Padding(
                padding: const EdgeInsets.fromLTRB(28, 64, 28, 40),
                child: Column(
                  children: [
                    Text(
                      l10n.parentLockTitle.toUpperCase(),
                      textAlign: TextAlign.center,
                      semanticsLabel: l10n.parentLockTitle,
                      style: text.labelMedium?.copyWith(
                        color: c.railInk2,
                        letterSpacing: 1.2,
                      ),
                    ),
                    const SizedBox(height: 14),
                    _Logo(shortName: school?.shortName),
                    const SizedBox(height: 18),
                    Semantics(
                      header: true,
                      child: Text(
                        school?.name ?? l10n.appNameParent,
                        textAlign: TextAlign.center,
                        style: text.headlineSmall?.copyWith(
                          color: c.railInk,
                          fontSize: 28,
                        ),
                      ),
                    ),
                    if (school != null) ...[
                      const SizedBox(height: 6),
                      Text(
                        l10n.parentLockPoweredBy(school.shortName),
                        textAlign: TextAlign.center,
                        style: text.bodyMedium?.copyWith(color: c.railInk2),
                      ),
                    ],
                    const Spacer(),
                    const SizedBox(height: 32),
                    Semantics(
                      button: true,
                      label: unlockLabel,
                      excludeSemantics: true,
                      child: Material(
                        color: c.rail2,
                        shape: const CircleBorder(),
                        child: InkWell(
                          customBorder: const CircleBorder(),
                          onTap: _asking ? null : _unlock,
                          child: SizedBox.square(
                            dimension: 76,
                            child: Icon(icon, size: 42, color: c.railInk),
                          ),
                        ),
                      ),
                    ),
                    const SizedBox(height: 12),
                    ExcludeSemantics(
                      child: Text(
                        tapLabel,
                        textAlign: TextAlign.center,
                        style: text.bodyMedium?.copyWith(color: c.railInk2),
                      ),
                    ),
                    if (_failed) ...[
                      const SizedBox(height: 10),
                      Semantics(
                        liveRegion: true,
                        child: Text(
                          l10n.parentLockFailed,
                          textAlign: TextAlign.center,
                          style: text.bodyMedium?.copyWith(color: c.railInk),
                        ),
                      ),
                    ],
                    const SizedBox(height: 8),
                    TextButton(
                      onPressed: _asking ? null : _unlock,
                      style: TextButton.styleFrom(
                        foregroundColor: c.railInk,
                        minimumSize: const Size(44, 44),
                        textStyle: const TextStyle(
                          fontFamily: QuadTokens.fontSans,
                          fontSize: 14.5,
                          fontWeight: FontWeight.w700,
                          decoration: TextDecoration.underline,
                        ),
                      ),
                      child: Text(l10n.parentLockUsePasscode),
                    ),
                  ],
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }
}

/// The school's mark on a light disc, or Quad's while the school loads.
class _Logo extends StatelessWidget {
  const new({required this.shortName});

  final String? shortName;

  @override
  Widget build(BuildContext context) {
    final c = context.colors;
    final short = shortName;
    return Container(
      padding: const EdgeInsets.all(6),
      decoration: BoxDecoration(color: c.rail2, shape: BoxShape.circle),
      child: short == null
          ? Container(
              width: 76,
              height: 76,
              alignment: Alignment.center,
              decoration: BoxDecoration(color: c.rail, shape: BoxShape.circle),
              child: ExcludeSemantics(
                child: SvgPicture.asset(
                  'assets/brand/quad-mark-white.svg',
                  width: 38,
                  height: 38,
                ),
              ),
            )
          : SchoolMark(
              shortName: short,
              size: 76,
              background: c.railInk,
              foreground: c.rail,
            ),
    );
  }
}
