import 'dart:math' as math;

import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:quad_parent/theme/theme.dart';
import 'package:quad_parent/theme/tokens.g.dart';

/// WCAG 2.x contrast ratio.
double _contrast(Color a, Color b) {
  final la = a.computeLuminance();
  final lb = b.computeLuminance();
  return (math.max(la, lb) + 0.05) / (math.min(la, lb) + 0.05);
}

/// WCAG large text: at least 24 px, or at least 18.66 px and bold.
bool _isLarge(TextStyle style) {
  final size = style.fontSize ?? 14;
  final bold =
      (style.fontWeight ?? FontWeight.w400).value >= FontWeight.w700.value;
  return size >= 24 || (bold && size >= 18.66);
}

void main() {
  for (final (brightness, c) in [
    (Brightness.light, QuadColors.light),
    (Brightness.dark, QuadColors.dark),
  ]) {
    test('every small text style reads at 4.5:1 on the canvas and surfaces '
        '(${brightness.name})', () {
      final theme = quadTheme(brightness).textTheme;
      final styles = <String, TextStyle?>{
        'displayLarge': theme.displayLarge,
        'displayMedium': theme.displayMedium,
        'displaySmall': theme.displaySmall,
        'headlineLarge': theme.headlineLarge,
        'headlineMedium': theme.headlineMedium,
        'headlineSmall': theme.headlineSmall,
        'titleLarge': theme.titleLarge,
        'titleMedium': theme.titleMedium,
        'titleSmall': theme.titleSmall,
        'bodyLarge': theme.bodyLarge,
        'bodyMedium': theme.bodyMedium,
        'bodySmall': theme.bodySmall,
        'labelLarge': theme.labelLarge,
        'labelMedium': theme.labelMedium,
        'labelSmall': theme.labelSmall,
      };
      for (final MapEntry(key: name, value: style) in styles.entries) {
        final color = style?.color;
        if (style == null || color == null || _isLarge(style)) continue;
        // Ruling R17: ink-3 is for icons and large text only.
        for (final bg in [c.canvas, c.surface, c.surface2]) {
          expect(
            _contrast(color, bg),
            greaterThanOrEqualTo(4.5),
            reason: '$name on $bg',
          );
        }
      }
    });
  }
}
