import 'package:flutter/material.dart';
import 'package:flutter_svg/flutter_svg.dart';
import 'package:quad_parent/l10n/app_localizations.dart';
import 'package:quad_parent/theme/theme.dart';

/// Start-up 1 (spec 09): the Quad mark on Quad navy while launch reads the
/// session. The remembered school's splash arrives with the branding cache.
class SplashScreen extends StatelessWidget {
  const new({super.key});

  @override
  Widget build(BuildContext context) {
    return ColoredBox(
      color: context.colors.rail,
      child: Center(
        child: Semantics(
          label: AppLocalizations.of(context).appNameParent,
          image: true,
          child: SvgPicture.asset(
            'assets/brand/quad-mark-white.svg',
            width: 72,
            height: 72,
          ),
        ),
      ),
    );
  }
}
