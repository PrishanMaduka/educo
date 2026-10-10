import 'package:flutter/material.dart';
import 'package:quad_api/quad_api.dart';
import 'package:quad_parent/theme/tokens.g.dart';

/// The app's ThemeData for [brightness], built only from the generated tokens
/// and, once signed in, the school's [brand] from `GET /me` (D13).
ThemeData quadTheme(Brightness brightness, {MeBrand? brand}) {
  final base = brightness == Brightness.dark
      ? QuadColors.dark
      : QuadColors.light;
  final c = brand == null ? base : withSchoolBrand(base, brand, brightness);
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
    // Control edges meet 3:1 on cards (spec 03 `field-line`).
    outline: c.fieldLine,
    outlineVariant: c.line,
    // Material 3 tints raised surfaces with primary; Quad's cards stay white.
    surfaceTint: Colors.transparent,
  );
  // Material falls back to `primary` (the brand fill) for text and icons on
  // the page. A light school colour, Quad lime included, is about 1.2:1 there,
  // so text and icons take `brandText` (4.5:1 on every surface) and controls
  // take `field-line`, `switch-off` and the blue `focus` (spec 03, D56).
  const selected = WidgetState.selected;
  final fieldBorder = OutlineInputBorder(
    borderRadius: BorderRadius.circular(QuadTokens.radiusInput),
    borderSide: BorderSide(color: c.fieldLine, width: 1.5),
  );
  return ThemeData(
    useMaterial3: true,
    brightness: brightness,
    colorScheme: scheme,
    scaffoldBackgroundColor: c.canvas,
    fontFamily: QuadTokens.fontSans,
    textTheme: _textTheme(c),
    extensions: [c],
    textButtonTheme: TextButtonThemeData(
      style: TextButton.styleFrom(foregroundColor: c.brandText),
    ),
    outlinedButtonTheme: OutlinedButtonThemeData(
      style: OutlinedButton.styleFrom(
        foregroundColor: c.ink,
        side: BorderSide(color: c.lineStrong, width: 1.5),
        shape: const StadiumBorder(),
      ),
    ),
    iconButtonTheme: IconButtonThemeData(
      style: ButtonStyle(
        foregroundColor: WidgetStateProperty.resolveWith(
          (states) => states.contains(selected) ? c.brandText : c.ink2,
        ),
      ),
    ),
    progressIndicatorTheme: ProgressIndicatorThemeData(
      color: c.brandText,
      linearTrackColor: c.surface2,
      circularTrackColor: Colors.transparent,
    ),
    textSelectionTheme: TextSelectionThemeData(
      cursorColor: c.ink,
      selectionColor: c.focus.withValues(alpha: 0.25),
      selectionHandleColor: c.focus,
    ),
    inputDecorationTheme: InputDecorationTheme(
      border: fieldBorder,
      enabledBorder: fieldBorder,
      focusedBorder: fieldBorder.copyWith(
        borderSide: BorderSide(color: c.focus, width: 2),
      ),
      errorBorder: fieldBorder.copyWith(
        borderSide: BorderSide(color: c.bad, width: 1.5),
      ),
      focusedErrorBorder: fieldBorder.copyWith(
        borderSide: BorderSide(color: c.bad, width: 2),
      ),
    ),
    checkboxTheme: CheckboxThemeData(
      side: BorderSide(color: c.fieldLine, width: 1.5),
      fillColor: WidgetStateProperty.resolveWith(
        (states) => states.contains(selected) ? c.brandFill : c.surface,
      ),
      checkColor: WidgetStatePropertyAll(c.brandInk),
    ),
    switchTheme: SwitchThemeData(
      trackColor: WidgetStateProperty.resolveWith(
        (states) => states.contains(selected) ? c.brandFill : c.switchOff,
      ),
      thumbColor: WidgetStateProperty.resolveWith(
        (states) => states.contains(selected) ? c.brandInk : c.surface,
      ),
      trackOutlineColor: const WidgetStatePropertyAll(Colors.transparent),
    ),
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

/// [base] with the school's brand for [brightness], as the staff portal
/// applies it: the API derived every brand token for both themes with
/// `deriveBrand` (spec 03 "School brand colour", D56), so nothing is derived
/// here. Navy, the petals, status colours and focus stay Quad's.
QuadColors withSchoolBrand(
  QuadColors base,
  MeBrand brand,
  Brightness brightness,
) {
  final t = brightness == Brightness.dark ? brand.dark : brand.light;
  final fill = _hex(t.fill);
  final fillStrong = _hex(t.fillStrong);
  return base.copyWith(
    brand: fill,
    brandStrong: fillStrong,
    brandSoft: _hex(t.soft),
    brandInk: _hex(t.ink),
    brandFill: fill,
    brandFillStrong: fillStrong,
    brandText: _hex(t.text),
    brandRaw: _hex(brand.color),
    railActive: _hex(t.railActive),
    railActiveInk: _hex(t.railActiveInk),
  );
}

/// A `#RRGGBB` colour sent by the API (data, never a literal in code).
Color _hex(String value) =>
    Color(0xFF000000 | int.parse(value.substring(1), radix: 16));

/// The parent app's type scale (sizes from design/parent.html): Bricolage
/// Grotesque speaks (titles), Figtree works (everything else), spec 03 "Type".
TextTheme _textTheme(QuadColors c) => TextTheme(
  // Greeting and page titles: 22 px, 800.
  headlineSmall: TextStyle(
    fontFamily: QuadTokens.fontDisplay,
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
  // The date line above the greeting: 12 px, 700; ink-2, as small text
  // needs 4.5:1 (R17).
  labelMedium: TextStyle(
    fontSize: 12,
    height: 1.3,
    fontWeight: FontWeight.w700,
    letterSpacing: 0.12,
    color: c.ink2,
  ),
  // Tab bar labels: 10.5 px, 700; ink-2, as small text needs 4.5:1 (R17).
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
