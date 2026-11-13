import 'dart:ui' show FontFeature;

import 'package:flutter/material.dart';

/// Academic typography scale prioritizing readability on narrow Android screens,
/// comfortable long-form textbook reading, and aligned tabular figures for
/// exam clocks, scores, and formulas.
class AppTypography {
  const AppTypography._();

  static const List<FontFeature> tabularFeatures = [
    FontFeature.tabularFigures(),
  ];

  static TextTheme buildTextTheme({
    required Color primaryColor,
    required Color secondaryColor,
    double readingScale = 1.0,
  }) {
    final double clampedScale = readingScale.clamp(0.85, 1.6);

    return TextTheme(
      headlineMedium: TextStyle(
        fontSize: 22,
        height: 1.25,
        fontWeight: FontWeight.w700,
        letterSpacing: -0.25,
        color: primaryColor,
      ),
      headlineSmall: TextStyle(
        fontSize: 19,
        height: 1.3,
        fontWeight: FontWeight.w700,
        letterSpacing: -0.15,
        color: primaryColor,
      ),
      titleLarge: TextStyle(
        fontSize: 17,
        height: 1.35,
        fontWeight: FontWeight.w600,
        letterSpacing: -0.1,
        color: primaryColor,
      ),
      titleMedium: TextStyle(
        fontSize: 15,
        height: 1.38,
        fontWeight: FontWeight.w600,
        color: primaryColor,
      ),
      titleSmall: TextStyle(
        fontSize: 13.5,
        height: 1.35,
        fontWeight: FontWeight.w600,
        color: primaryColor,
      ),
      bodyLarge: TextStyle(
        fontSize: 16 * clampedScale,
        height: 1.6,
        fontWeight: FontWeight.w400,
        color: primaryColor,
      ),
      bodyMedium: TextStyle(
        fontSize: 14 * clampedScale,
        height: 1.55,
        fontWeight: FontWeight.w400,
        color: secondaryColor,
      ),
      bodySmall: TextStyle(
        fontSize: 12.5,
        height: 1.45,
        fontWeight: FontWeight.w400,
        color: secondaryColor,
      ),
      labelLarge: TextStyle(
        fontSize: 14,
        height: 1.25,
        fontWeight: FontWeight.w600,
        color: primaryColor,
      ),
      labelMedium: TextStyle(
        fontSize: 12,
        height: 1.25,
        fontWeight: FontWeight.w500,
        letterSpacing: 0.1,
        color: secondaryColor,
      ),
      labelSmall: TextStyle(
        fontSize: 11,
        height: 1.2,
        fontWeight: FontWeight.w600,
        letterSpacing: 0.3,
        color: secondaryColor,
      ),
    );
  }

  /// Applies aligned tabular numerals for timers, scores, and counts.
  static TextStyle tabular(TextStyle? base, {Color? color}) {
    return (base ?? const TextStyle()).copyWith(
      fontFeatures: tabularFeatures,
      color: color,
    );
  }

  /// Styled monospaced-friendly display for equations, formulas, and SI units.
  static TextStyle formula(BuildContext context, {Color? color}) {
    final theme = Theme.of(context);
    return (theme.textTheme.titleLarge ?? const TextStyle()).copyWith(
      fontWeight: FontWeight.w700,
      fontFeatures: tabularFeatures,
      letterSpacing: 0.15,
      color: color ?? theme.colorScheme.primary,
    );
  }
}
