/// Canonical layout, radius, icon, and touch-target design tokens for Roshan Study.
///
/// Using a fixed 4px-base scale prevents ad-hoc spacing across screens and
/// ensures consistent breathing room on narrow 360dp Android displays.
class AppSpacing {
  const AppSpacing._();

  static const double xxs = 4.0;
  static const double xs = 8.0;
  static const double sm = 12.0;
  static const double md = 16.0;
  static const double lg = 20.0;
  static const double xl = 24.0;
  static const double xxl = 32.0;
}

class AppRadius {
  const AppRadius._();

  static const double sm = 8.0;
  static const double md = 10.0;
  static const double lg = 12.0;
}

class AppIconSize {
  const AppIconSize._();

  static const double sm = 18.0;
  static const double md = 20.0;
  static const double nav = 22.0;
  static const double lg = 24.0;
}

class AppTouchTarget {
  const AppTouchTarget._();

  /// Minimum Material interactive tap target height/width (48dp).
  static const double min = 48.0;

  /// Optimal textbook line-width cap on tablets and landscape phones.
  static const double maxContentWidth = 680.0;
}
