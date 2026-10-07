import 'package:flutter/widgets.dart';
import 'package:flutter_svg/flutter_svg.dart';
import 'package:quad_parent/core/greeting.dart';
import 'package:quad_parent/theme/theme.dart';
import 'package:quad_parent/theme/tokens.g.dart';

/// The small time-of-day icon in the Home header, on a soft round tint:
/// amber for morning and afternoon, coral for evening, lilac for night
/// (spec 03).
class GreetingIcon extends StatelessWidget {
  const new({required this.period, this.size = 20, super.key});

  final GreetingPeriod period;

  /// Diameter of the round tint; the icon is three quarters of it.
  final double size;

  static Color tintOf(GreetingPeriod period, QuadColors c) => switch (period) {
    GreetingPeriod.morning || GreetingPeriod.afternoon => c.c4,
    GreetingPeriod.evening => c.c1,
    GreetingPeriod.night => c.c3,
  };

  @override
  Widget build(BuildContext context) {
    final tint = tintOf(period, context.colors);
    return ExcludeSemantics(
      child: Container(
        width: size,
        height: size,
        alignment: Alignment.center,
        decoration: BoxDecoration(
          shape: BoxShape.circle,
          color: tint.withValues(alpha: 0.16),
        ),
        child: SvgPicture.asset(
          'assets/greeting/icon-${period.name}.svg',
          width: size * 0.75,
          height: size * 0.75,
          colorFilter: ColorFilter.mode(tint, BlendMode.srcIn),
        ),
      ),
    );
  }
}
