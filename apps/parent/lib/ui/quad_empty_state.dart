import 'package:flutter/material.dart';
import 'package:flutter_svg/flutter_svg.dart';
import 'package:quad_parent/theme/theme.dart';
import 'package:quad_parent/theme/tokens.g.dart';

/// A friendly card for a screen with nothing to show yet.
class QuadEmptyState extends StatelessWidget {
  const QuadEmptyState({required this.message, super.key});

  final String message;

  @override
  Widget build(BuildContext context) {
    final c = context.colors;
    return Container(
      padding: const EdgeInsets.all(20),
      decoration: BoxDecoration(
        color: c.surface,
        borderRadius: BorderRadius.circular(QuadTokens.radiusCard),
        border: Border.all(color: c.line),
        boxShadow: QuadTokens.shadowCard,
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          ExcludeSemantics(
            // The white mark keeps its first tile visible on dark surfaces.
            child: SvgPicture.asset(
              Theme.of(context).brightness == Brightness.dark
                  ? 'assets/brand/quad-mark-white.svg'
                  : 'assets/brand/quad-mark.svg',
              width: 36,
              height: 36,
            ),
          ),
          const SizedBox(height: 14),
          Text(message, style: Theme.of(context).textTheme.bodyLarge),
        ],
      ),
    );
  }
}
