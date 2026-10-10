import 'package:flutter/material.dart';
import 'package:flutter_svg/flutter_svg.dart';
import 'package:quad_parent/l10n/app_localizations.dart';
import 'package:quad_parent/theme/theme.dart';
import 'package:quad_parent/theme/tokens.g.dart';

/// A Quad-branded sign-in step (D13): Quad navy behind, a back button, and a
/// sheet with the Quad mark at its top edge (design/parent.html `.si-sheet`).
class SignInFrame extends StatelessWidget {
  const new({
    required this.title,
    required this.children,
    this.onBack,
    super.key,
  });

  final String title;
  final List<Widget> children;
  final VoidCallback? onBack;

  static const _markSize = 64.0;

  @override
  Widget build(BuildContext context) {
    final c = context.colors;
    final back = onBack;
    return Scaffold(
      backgroundColor: c.rail,
      body: SafeArea(
        bottom: false,
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Padding(
              padding: const EdgeInsets.fromLTRB(16, 8, 16, 0),
              child: SizedBox(
                height: 44,
                child: back == null
                    ? null
                    : IconButton(
                        onPressed: back,
                        tooltip: AppLocalizations.of(context).parentSignInBack,
                        style: IconButton.styleFrom(
                          backgroundColor: c.rail2,
                          foregroundColor: c.railInk,
                          minimumSize: const Size(44, 44),
                        ),
                        icon: const Icon(Icons.arrow_back),
                      ),
              ),
            ),
            const SizedBox(height: 8),
            Expanded(
              child: Stack(
                children: [
                  Positioned.fill(
                    top: _markSize / 2,
                    child: DecoratedBox(
                      decoration: BoxDecoration(
                        color: c.canvas,
                        borderRadius: const BorderRadius.vertical(
                          top: Radius.circular(QuadTokens.radiusScene),
                        ),
                      ),
                      child: ListView(
                        padding: EdgeInsets.fromLTRB(
                          22,
                          _markSize / 2 + 18,
                          22,
                          24 + MediaQuery.paddingOf(context).bottom,
                        ),
                        children: [
                          Semantics(
                            header: true,
                            child: Text(
                              title,
                              style: Theme.of(context).textTheme.headlineSmall,
                            ),
                          ),
                          const SizedBox(height: 10),
                          ...children,
                        ],
                      ),
                    ),
                  ),
                  Positioned(
                    top: 0,
                    left: 22,
                    child: ExcludeSemantics(
                      child: Container(
                        width: _markSize,
                        height: _markSize,
                        decoration: BoxDecoration(
                          color: c.rail,
                          shape: BoxShape.circle,
                          border: Border.all(color: c.canvas, width: 4),
                        ),
                        alignment: Alignment.center,
                        child: SvgPicture.asset(
                          'assets/brand/quad-mark-white.svg',
                          width: 30,
                          height: 30,
                        ),
                      ),
                    ),
                  ),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }
}

/// A full-width primary action that shows a spinner while [busy].
class SignInButton extends StatelessWidget {
  const new({
    required this.label,
    required this.onPressed,
    this.busy = false,
    super.key,
  });

  final String label;
  final VoidCallback? onPressed;
  final bool busy;

  @override
  Widget build(BuildContext context) {
    final c = context.colors;
    return ConstrainedBox(
      constraints: const BoxConstraints(
        minHeight: 52,
        minWidth: double.infinity,
      ),
      child: FilledButton(
        onPressed: busy ? null : onPressed,
        // Sign-in is Quad-branded, pink with navy text, in every school and
        // theme (D13, D34); the school colour takes over after sign-in.
        style: FilledButton.styleFrom(
          backgroundColor: c.pink,
          foregroundColor: c.navy,
          disabledBackgroundColor: c.pink,
          disabledForegroundColor: c.navy,
          padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 12),
        ),
        child: busy
            ? SizedBox.square(
                dimension: 22,
                child: CircularProgressIndicator(
                  strokeWidth: 2.5,
                  color: c.navy,
                  semanticsLabel: label,
                ),
              )
            : Text(label, textAlign: TextAlign.center),
      ),
    );
  }
}

/// A plain text action under the main one ("Use email instead").
class SignInLink extends StatelessWidget {
  const new({required this.label, required this.onPressed, super.key});

  final String label;
  final VoidCallback? onPressed;

  @override
  Widget build(BuildContext context) {
    final c = context.colors;
    return TextButton(
      onPressed: onPressed,
      style: TextButton.styleFrom(
        foregroundColor: c.ink,
        minimumSize: const Size(44, 44),
        textStyle: const TextStyle(
          fontFamily: QuadTokens.fontSans,
          fontSize: 14.5,
          fontWeight: FontWeight.w600,
          decoration: TextDecoration.underline,
        ),
      ),
      child: Text(label, textAlign: TextAlign.center),
    );
  }
}

/// A message under a field, read out as soon as it appears.
class SignInError extends StatelessWidget {
  const new({required this.message, super.key});

  final String? message;

  @override
  Widget build(BuildContext context) {
    final text = message;
    if (text == null) return const SizedBox.shrink();
    return Padding(
      padding: const EdgeInsets.only(top: 8),
      child: Semantics(
        liveRegion: true,
        child: Text(
          text,
          style: Theme.of(context).textTheme.bodyMedium
              ?.copyWith(color: context.colors.bad),
        ),
      ),
    );
  }
}

/// A full-screen step on the canvas, centred and scrolling when the text is
/// large (Found you, the Face ID offer; design/parent.html `.si-done`).
class SignInCentered extends StatelessWidget {
  const new({required this.children, super.key});

  final List<Widget> children;

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      body: SafeArea(
        child: CustomScrollView(
          slivers: [
            SliverFillRemaining(
              hasScrollBody: false,
              child: Padding(
                padding: const EdgeInsets.symmetric(
                  horizontal: 28,
                  vertical: 32,
                ),
                child: Column(
                  mainAxisAlignment: MainAxisAlignment.center,
                  crossAxisAlignment: CrossAxisAlignment.stretch,
                  children: children,
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }
}

/// The round badge at the top of a [SignInCentered] step.
class SignInBadge extends StatelessWidget {
  const new({
    required this.icon,
    required this.background,
    required this.foreground,
    super.key,
  });

  final IconData icon;
  final Color background;
  final Color foreground;

  @override
  Widget build(BuildContext context) {
    return ExcludeSemantics(
      child: Center(
        child: Container(
          width: 96,
          height: 96,
          decoration: BoxDecoration(color: background, shape: BoxShape.circle),
          child: Icon(icon, size: 48, color: foreground),
        ),
      ),
    );
  }
}
