import 'package:flutter/material.dart';

/// Shared motion tokens and reduced-motion-safe animation primitives.
///
/// Keeps UI feedback crisp, educational, and lightweight on budget devices
/// while automatically respecting system "Remove animations" accessibility settings.
class RoshanMotion {
  const RoshanMotion._();

  static const Duration fastDuration = Duration(milliseconds: 180);
  static const Duration normalDuration = Duration(milliseconds: 260);
  static const Curve standardCurve = Curves.easeOutCubic;

  static bool reduceMotion(BuildContext context) {
    return MediaQuery.maybeDisableAnimationsOf(context) ?? false;
  }

  static Duration resolveDuration(
    BuildContext context, {
    Duration duration = normalDuration,
  }) {
    return reduceMotion(context) ? Duration.zero : duration;
  }
}

/// Subtle fade + small vertical reveal on mount, disabled cleanly under reduced motion.
class MotionEntrance extends StatelessWidget {
  const MotionEntrance({
    super.key,
    required this.child,
    this.duration = RoshanMotion.normalDuration,
    this.offsetY = 8.0,
  });

  final Widget child;
  final Duration duration;
  final double offsetY;

  @override
  Widget build(BuildContext context) {
    final resolved = RoshanMotion.resolveDuration(context, duration: duration);
    if (resolved == Duration.zero) {
      return child;
    }

    return TweenAnimationBuilder<double>(
      tween: Tween<double>(begin: 0.0, end: 1.0),
      duration: resolved,
      curve: RoshanMotion.standardCurve,
      child: child,
      builder: (context, value, child) {
        return Opacity(
          opacity: value,
          child: Transform.translate(
            offset: Offset(0, (1.0 - value) * offsetY),
            child: child,
          ),
        );
      },
    );
  }
}

/// Progressive disclosure container for hints, Urdu glossary meanings, and solutions.
class MotionExpandable extends StatelessWidget {
  const MotionExpandable({
    super.key,
    required this.expanded,
    required this.child,
    this.duration = RoshanMotion.fastDuration,
  });

  final bool expanded;
  final Widget child;
  final Duration duration;

  @override
  Widget build(BuildContext context) {
    final resolved = RoshanMotion.resolveDuration(context, duration: duration);
    return AnimatedCrossFade(
      firstChild: const SizedBox.shrink(),
      secondChild: child,
      crossFadeState:
          expanded ? CrossFadeState.showSecond : CrossFadeState.showFirst,
      duration: resolved,
      sizeCurve: RoshanMotion.standardCurve,
    );
  }
}

/// Smooth animated progress indicator for micro-lessons, practice, and daily goals.
class AnimatedProgressTrack extends StatelessWidget {
  const AnimatedProgressTrack({
    super.key,
    required this.value,
    this.duration = RoshanMotion.normalDuration,
    this.minHeight,
  });

  final double value;
  final Duration duration;
  final double? minHeight;

  @override
  Widget build(BuildContext context) {
    final clamped = value.clamp(0.0, 1.0);
    final resolved = RoshanMotion.resolveDuration(context, duration: duration);
    if (resolved == Duration.zero) {
      return LinearProgressIndicator(value: clamped, minHeight: minHeight);
    }

    return TweenAnimationBuilder<double>(
      tween: Tween<double>(end: clamped),
      duration: resolved,
      curve: RoshanMotion.standardCurve,
      builder: (context, animatedValue, _) {
        return LinearProgressIndicator(
          value: animatedValue,
          minHeight: minHeight,
        );
      },
    );
  }
}
