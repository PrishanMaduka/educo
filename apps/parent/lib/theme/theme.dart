import 'package:flutter/material.dart';
import 'package:quad_parent/theme/tokens.g.dart';

/// The app's ThemeData for [brightness], built only from the generated tokens.
ThemeData quadTheme(Brightness brightness) {
  final c = brightness == Brightness.dark ? QuadColors.dark : QuadColors.light;
  final scheme = ColorScheme(
    brightness: brightness,
    primary: c.brandFill,
    onPrimary: c.brandInk,
    secondary: c.c2,
    onSecondary: c.surface,
    tertiary: c.c3,
    onTertiary: c.surface,
    error: c.bad,
    onError: c.surface,
    surface: c.surface,
    onSurface: c.ink,
    onSurfaceVariant: c.ink2,
    surfaceContainerHighest: c.surface2,
    outline: c.lineStrong,
    outlineVariant: c.line,
  );
  return ThemeData(
    useMaterial3: true,
    brightness: brightness,
    colorScheme: scheme,
    scaffoldBackgroundColor: c.canvas,
    fontFamily: QuadTokens.fontSans,
    textTheme: _textTheme(c),
    extensions: [c],
    filledButtonTheme: FilledButtonThemeData(
      style: FilledButton.styleFrom(
        backgroundColor: c.brandFill,
        foregroundColor: c.brandInk,
        minimumSize: const Size(44, 44),
        shape: const StadiumBorder(),
        textStyle: const TextStyle(
          fontFamily: QuadTokens.fontSans,
          fontSize: 15,
          fontWeight: FontWeight.w700,
        ),
      ),
    ),
  );
}

/// The parent app's type scale (sizes from design/parent.html).
TextTheme _textTheme(QuadColors c) => TextTheme(
  // Greeting and page titles: 22 px, 800.
  headlineSmall: TextStyle(
    fontSize: 22,
    height: 1.2,
    fontWeight: FontWeight.w800,
    letterSpacing: -0.33,
    color: c.ink,
  ),
  bodyLarge: TextStyle(
    fontSize: 15,
    height: 1.45,
    fontWeight: FontWeight.w500,
    color: c.ink2,
  ),
  bodyMedium: TextStyle(fontSize: 14, height: 1.45, color: c.ink2),
  // The date line above the greeting: 12 px, 700.
  labelMedium: TextStyle(
    fontSize: 12,
    height: 1.3,
    fontWeight: FontWeight.w700,
    letterSpacing: 0.12,
    color: c.ink3,
  ),
  // Tab bar labels: 10.5 px, 700; ink-2 because small text needs 4.5:1 (R17).
  labelSmall: TextStyle(
    fontSize: 10.5,
    height: 1.2,
    fontWeight: FontWeight.w700,
    color: c.ink2,
  ),
);

/// Shorthand for the colour tokens of the current theme.
extension QuadThemeContext on BuildContext {
  QuadColors get colors => Theme.of(this).extension<QuadColors>()!;
}
