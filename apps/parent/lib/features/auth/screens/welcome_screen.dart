import 'dart:math' as math;

import 'package:flutter/material.dart';
import 'package:flutter_svg/flutter_svg.dart';
import 'package:go_router/go_router.dart';
import 'package:quad_parent/features/auth/widgets/sign_in_frame.dart';
import 'package:quad_parent/l10n/app_localizations.dart';
import 'package:quad_parent/theme/theme.dart';
import 'package:quad_parent/theme/tokens.g.dart';

/// Welcome (spec 09 Start-up 3): Quad-branded and the same for every school
/// (D13). The school's name and colours appear once the parent signs in.
class WelcomeScreen extends StatelessWidget {
  const new({super.key});

  @override
  Widget build(BuildContext context) {
    final c = context.colors;
    final l10n = AppLocalizations.of(context);
    final text = Theme.of(context).textTheme;
    return Scaffold(
      backgroundColor: c.rail,
      body: SafeArea(
        child: CustomScrollView(
          slivers: [
            SliverFillRemaining(
              hasScrollBody: false,
              child: Padding(
                padding: const EdgeInsets.fromLTRB(24, 24, 24, 24),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Semantics(
                      label: l10n.appNameParent,
                      image: true,
                      child: SvgPicture.asset(
                        'assets/brand/quad-logo-white.svg',
                        height: 30,
                      ),
                    ),
                    const SizedBox(height: 18),
                    Semantics(
                      header: true,
                      child: Text(
                        l10n.parentWelcomeTitle,
                        style: text.labelMedium?.copyWith(color: c.railInk2),
                      ),
                    ),
                    const SizedBox(height: 12),
                    const _CircleOfPeople(),
                    const SizedBox(height: 18),
                    const _Headline(),
                    const SizedBox(height: 12),
                    Text(
                      l10n.parentWelcomeSubtitle,
                      style: text.bodyLarge?.copyWith(color: c.railInk2),
                    ),
                    const Spacer(),
                    const SizedBox(height: 24),
                    SignInButton(
                      label: l10n.parentWelcomeSignIn,
                      onPressed: () => context.push('/sign-in/phone'),
                    ),
                    const SizedBox(height: 10),
                    ConstrainedBox(
                      constraints: const BoxConstraints(
                        minHeight: 52,
                        minWidth: double.infinity,
                      ),
                      child: OutlinedButton(
                        onPressed: () => _inviteSoon(context),
                        style: OutlinedButton.styleFrom(
                          foregroundColor: c.railInk,
                          side: BorderSide(color: c.railInk2, width: 1.5),
                          shape: const StadiumBorder(),
                          padding: const EdgeInsets.symmetric(
                            horizontal: 20,
                            vertical: 12,
                          ),
                          textStyle: const TextStyle(
                            fontFamily: QuadTokens.fontSans,
                            fontSize: 15,
                            fontWeight: FontWeight.w700,
                          ),
                        ),
                        child: Text(
                          l10n.parentWelcomeInvite,
                          textAlign: TextAlign.center,
                        ),
                      ),
                    ),
                    const SizedBox(height: 12),
                    Text(
                      l10n.parentWelcomeBrandNote,
                      textAlign: TextAlign.center,
                      style: text.bodyMedium?.copyWith(color: c.railInk2),
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

  /// Invite codes (spec 05) arrive in M6; until then this says so.
  void _inviteSoon(BuildContext context) {
    ScaffoldMessenger.of(context)
      ..hideCurrentSnackBar()
      ..showSnackBar(
        SnackBar(
          content: Text(AppLocalizations.of(context).parentWelcomeInviteSoon),
        ),
      );
  }
}

/// "Hear the good stuff first." with "good" on a pill.
class _Headline extends StatelessWidget {
  const new();

  /// Splits the sentence around its `{good}` placeholder, so translations
  /// can move the word.
  static const _slot = '\u0000';

  @override
  Widget build(BuildContext context) {
    final c = context.colors;
    final l10n = AppLocalizations.of(context);
    final parts = l10n.parentWelcomeHeadline(_slot).split(_slot);
    final style = TextStyle(
      fontFamily: QuadTokens.fontDisplay,
      fontSize: 38,
      height: 1.1,
      fontWeight: FontWeight.w800,
      letterSpacing: -1.2,
      color: c.railInk,
    );
    return Semantics(
      label: l10n.parentWelcomeHeadline(l10n.parentWelcomeHeadlineGood),
      excludeSemantics: true,
      // A 38 px display line is already large: it grows to 1.4× so the
      // sentence stays readable at 390 px with text at 200% (the body text
      // around it scales fully).
      child: MediaQuery.withClampedTextScaling(
        maxScaleFactor: 1.4,
        child: Text.rich(
          TextSpan(
            style: style,
            children: [
              TextSpan(text: parts.first),
              WidgetSpan(
                alignment: PlaceholderAlignment.baseline,
                baseline: TextBaseline.alphabetic,
                child: Transform.rotate(
                  angle: -0.035,
                  child: Container(
                    padding: const EdgeInsets.symmetric(horizontal: 9),
                    decoration: BoxDecoration(
                      // Quad pink before sign-in (D13, D34), not the brand.
                      color: c.pink,
                      borderRadius: BorderRadius.circular(
                        QuadTokens.radiusPill,
                      ),
                    ),
                    child: Text(
                      l10n.parentWelcomeHeadlineGood,
                      softWrap: false,
                      style: style.copyWith(color: c.navy),
                    ),
                  ),
                ),
              ),
              if (parts.length > 1) TextSpan(text: parts.last),
            ],
          ),
        ),
      ),
    );
  }
}

/// The flat circle of people (design/parent.html `.si-circle`), drawn as
/// category-coloured circles on a dashed ring. Decorative only.
class _CircleOfPeople extends StatelessWidget {
  const new();

  @override
  Widget build(BuildContext context) {
    final c = context.colors;
    return ExcludeSemantics(
      child: SizedBox(
        height: 200,
        width: double.infinity,
        child: CustomPaint(
          painter: _CirclePainter(
            ring: c.rail2,
            outline: c.rail,
            people: [c.c1, c.c2, c.c3, c.c4, c.c5, c.lime],
          ),
        ),
      ),
    );
  }
}

class _CirclePainter extends CustomPainter {
  new({required this.ring, required this.outline, required this.people});

  final Color ring;
  final Color outline;
  final List<Color> people;

  /// Each person: centre as a fraction of the box, and diameter in px
  /// (from the prototype's layout).
  static const _places = [
    (0.62, 0.16, 60.0),
    (0.14, 0.42, 54.0),
    (0.86, 0.44, 52.0),
    (0.50, 0.55, 88.0),
    (0.22, 0.86, 48.0),
    (0.80, 0.86, 50.0),
  ];

  @override
  void paint(Canvas canvas, Size size) {
    final centre = size.center(Offset.zero);
    final radius = size.shortestSide * 0.46;
    final dash = Paint()
      ..color = ring
      ..style = PaintingStyle.stroke
      ..strokeWidth = 2;
    const steps = 48;
    for (var i = 0; i < steps; i += 2) {
      canvas.drawArc(
        Rect.fromCircle(center: centre, radius: radius),
        i * 2 * math.pi / steps,
        2 * math.pi / steps,
        false,
        dash,
      );
    }
    for (var i = 0; i < _places.length; i++) {
      final (x, y, d) = _places[i];
      final at = Offset(size.width * x, size.height * y);
      canvas
        ..drawCircle(at, d / 2 + 4, Paint()..color = outline)
        ..drawCircle(at, d / 2, Paint()..color = people[i % people.length]);
    }
  }

  @override
  bool shouldRepaint(_CirclePainter old) =>
      old.ring != ring || old.outline != outline || old.people != people;
}
