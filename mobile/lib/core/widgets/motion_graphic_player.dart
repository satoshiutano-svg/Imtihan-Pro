import 'dart:math' as math;

import 'package:flutter/material.dart';
import 'package:roshan_study/app/theme/app_colors.dart';
import 'package:roshan_study/app/theme/app_tokens.dart';
import 'package:roshan_study/app/theme/app_typography.dart';
import 'package:roshan_study/core/models/curriculum_models.dart';
import 'package:roshan_study/core/widgets/academic_surface.dart';
import 'package:roshan_study/core/widgets/math_text.dart';

/// Offline animated CustomPaint motion graphic player for science and math topics.
class MotionGraphicPlayer extends StatefulWidget {
  const MotionGraphicPlayer({super.key, required this.spec});

  final MotionGraphicSpec spec;

  @override
  State<MotionGraphicPlayer> createState() => _MotionGraphicPlayerState();
}

class _MotionGraphicPlayerState extends State<MotionGraphicPlayer>
    with SingleTickerProviderStateMixin {
  late final AnimationController _controller;
  double _speed = 1.0;

  @override
  void initState() {
    super.initState();
    final ms = (widget.spec.durationSec * 1000).round().clamp(1000, 60000);
    _controller = AnimationController(
      vsync: this,
      duration: Duration(milliseconds: ms),
    )..repeat();
  }

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  void _setSpeed(double nextSpeed) {
    setState(() => _speed = nextSpeed);
    final baseMs = (widget.spec.durationSec * 1000 / nextSpeed)
        .round()
        .clamp(600, 60000);
    final current = _controller.value;
    final running = _controller.isAnimating;
    _controller.duration = Duration(milliseconds: baseMs);
    if (running) {
      _controller.repeat();
    } else {
      _controller.value = current;
    }
  }

  MotionStage? _stageForProgress(double pct) {
    if (widget.spec.stages.isEmpty) return null;
    final sorted = [...widget.spec.stages]
      ..sort((a, b) => a.atPercent.compareTo(b.atPercent));
    MotionStage current = sorted.first;
    for (final s in sorted) {
      if (pct >= s.atPercent) current = s;
    }
    return current;
  }

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final isDark = theme.brightness == Brightness.dark;
    final sortedStages = [...widget.spec.stages]
      ..sort((a, b) => a.atPercent.compareTo(b.atPercent));

    return AcademicSurface(
      backgroundColor: theme.colorScheme.surfaceContainerHighest.withValues(
        alpha: 0.3,
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Row(
            children: [
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(widget.spec.title, style: theme.textTheme.titleSmall),
                    const SizedBox(height: 2),
                    MathText(
                      widget.spec.caption,
                      style: theme.textTheme.bodySmall,
                    ),
                  ],
                ),
              ),
              Text(
                '${widget.spec.durationSec.toStringAsFixed(0)}s Motion',
                style: AppTypography.tabular(
                  theme.textTheme.labelMedium,
                  color: theme.colorScheme.primary,
                ),
              ),
            ],
          ),
          const SizedBox(height: AppSpacing.sm),

          // Interactive Animation Canvas
          Container(
            height: 185,
            decoration: BoxDecoration(
              color: isDark ? AppColors.surfaceDark : AppColors.surfaceLight,
              borderRadius: BorderRadius.circular(AppRadius.md),
              border: Border.all(color: theme.colorScheme.outline),
            ),
            child: AnimatedBuilder(
              animation: _controller,
              builder: (context, _) {
                return CustomPaint(
                  painter: _MotionScenePainter(
                    spec: widget.spec,
                    progress: _controller.value,
                    isDark: isDark,
                    gridColor: theme.colorScheme.outline.withValues(alpha: 0.5),
                    textColor: theme.colorScheme.onSurface,
                  ),
                );
              },
            ),
          ),

          const SizedBox(height: AppSpacing.sm),

          // Playback & Scrubber Controls + Live Formula Readout
          AnimatedBuilder(
            animation: _controller,
            builder: (context, _) {
              final pct = _controller.value * 100;
              final activeStage = _stageForProgress(pct);
              return Column(
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [
                  Row(
                    children: [
                      FilledButton.tonalIcon(
                        onPressed: () {
                          if (_controller.isAnimating) {
                            _controller.stop();
                          } else {
                            _controller.repeat();
                          }
                          setState(() {});
                        },
                        icon: Icon(
                          _controller.isAnimating
                              ? Icons.pause
                              : Icons.play_arrow,
                          size: AppIconSize.sm,
                        ),
                        label: Text(
                          _controller.isAnimating ? 'Pause' : 'Play',
                        ),
                      ),
                      const SizedBox(width: AppSpacing.xs),
                      IconButton(
                        tooltip: 'Reset animation',
                        onPressed: () {
                          _controller.stop();
                          _controller.value = 0.0;
                          setState(() {});
                        },
                        icon: const Icon(Icons.replay, size: AppIconSize.sm),
                      ),
                      const Spacer(),
                      for (final spd in [0.5, 1.0, 1.5])
                        Padding(
                          padding: const EdgeInsets.only(left: 4),
                          child: ChoiceChip(
                            label: Text('${spd == 1.0 ? '1' : spd}x'),
                            selected: _speed == spd,
                            onSelected: (_) => _setSpeed(spd),
                            visualDensity: VisualDensity.compact,
                          ),
                        ),
                    ],
                  ),
                  Slider(
                    value: _controller.value.clamp(0.0, 1.0),
                    onChanged: (v) {
                      _controller.stop();
                      _controller.value = v;
                      setState(() {});
                    },
                  ),
                  if (activeStage != null) ...[
                    Container(
                      padding: const EdgeInsets.all(AppSpacing.sm),
                      decoration: BoxDecoration(
                        color: isDark
                            ? AppColors.surfaceDark
                            : AppColors.surfaceLight,
                        borderRadius: BorderRadius.circular(AppRadius.sm),
                        border: Border.all(color: theme.colorScheme.outline),
                      ),
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(
                            activeStage.label,
                            style: theme.textTheme.labelLarge?.copyWith(
                              color: theme.colorScheme.primary,
                            ),
                          ),
                          if (activeStage.formulaLatex != null) ...[
                            const SizedBox(height: 4),
                            MathText(
                              activeStage.formulaLatex!,
                              style: theme.textTheme.titleSmall,
                            ),
                          ],
                          const SizedBox(height: 4),
                          Text(
                            activeStage.callout,
                            style: theme.textTheme.bodySmall,
                          ),
                        ],
                      ),
                    ),
                    const SizedBox(height: AppSpacing.xs),
                  ],
                  Wrap(
                    spacing: 6,
                    runSpacing: 6,
                    children: [
                      for (final stage in sortedStages)
                        ActionChip(
                          label: Text(stage.label),
                          onPressed: () {
                            _controller.stop();
                            _controller.value =
                                (stage.atPercent / 100).clamp(0.0, 1.0);
                            setState(() {});
                          },
                          visualDensity: VisualDensity.compact,
                        ),
                    ],
                  ),
                ],
              );
            },
          ),
        ],
      ),
    );
  }
}

class _MotionScenePainter extends CustomPainter {
  _MotionScenePainter({
    required this.spec,
    required this.progress,
    required this.isDark,
    required this.gridColor,
    required this.textColor,
  });

  final MotionGraphicSpec spec;
  final double progress;
  final bool isDark;
  final Color gridColor;
  final Color textColor;

  Color _strokeForToken(VisualColorToken token) {
    return switch (token) {
      VisualColorToken.primary =>
        isDark ? AppColors.primaryDark : AppColors.primaryLight,
      VisualColorToken.secondary => const Color(0xFF0F766E),
      VisualColorToken.warning => const Color(0xFFB4690E),
      VisualColorToken.danger =>
        isDark ? AppColors.errorDark : AppColors.errorLight,
    };
  }

  @override
  void paint(Canvas canvas, Size size) {
    final gridPaint = Paint()
      ..color = gridColor
      ..strokeWidth = 0.8;

    for (int i = 1; i <= 3; i++) {
      final y = size.height * (i / 4);
      canvas.drawLine(Offset(12, y), Offset(size.width - 12, y), gridPaint);
    }

    if (spec.sceneType == 'kinematics_track') {
      final trackPaint = Paint()
        ..color = textColor.withValues(alpha: 0.35)
        ..strokeWidth = 2;
      canvas.drawLine(
        Offset(16, size.height * 0.68),
        Offset(size.width - 16, size.height * 0.68),
        trackPaint,
      );
    } else if (spec.sceneType == 'wave_oscillation') {
      final wavePaint = Paint()
        ..color = _strokeForToken(VisualColorToken.primary)
        ..style = PaintingStyle.stroke
        ..strokeWidth = 2.4;
      final path = Path();
      for (int i = 0; i <= 48; i++) {
        final x = 16 + (size.width - 32) * (i / 48);
        final y = size.height * 0.5 +
            math.sin(i * 0.35 + progress * math.pi * 2) * (size.height * 0.22);
        if (i == 0) {
          path.moveTo(x, y);
        } else {
          path.lineTo(x, y);
        }
      }
      canvas.drawPath(path, wavePaint);
    }

    final pad = 16.0;
    final drawW = size.width - pad * 2;
    final drawH = size.height - pad * 2;

    for (final actor in spec.actors) {
      final xPct = actor.startX + (actor.endX - actor.startX) * progress;
      final yPct = actor.startY + (actor.endY - actor.startY) * progress;
      final cx = pad + (xPct / 100) * drawW;
      final cy = pad + (yPct / 100) * drawH;
      final strokeColor = _strokeForToken(actor.colorToken);

      final fillPaint = Paint()..color = strokeColor.withValues(alpha: 0.2);
      final strokePaint = Paint()
        ..color = strokeColor
        ..style = PaintingStyle.stroke
        ..strokeWidth = 2;

      final s = actor.size.clamp(10.0, 22.0);
      if (actor.shape == 'box') {
        final rect = RRect.fromRectAndRadius(
          Rect.fromCenter(center: Offset(cx, cy), width: s * 2, height: s * 1.4),
          const Radius.circular(5),
        );
        canvas.drawRRect(rect, fillPaint);
        canvas.drawRRect(rect, strokePaint);
      } else if (actor.shape == 'arrow') {
        canvas.drawLine(
          Offset(cx - s, cy),
          Offset(cx + s, cy),
          strokePaint..strokeWidth = 2.6,
        );
        final arrowHead = Path()
          ..moveTo(cx + s + 5, cy)
          ..lineTo(cx + s - 3, cy - 4)
          ..lineTo(cx + s - 3, cy + 4)
          ..close();
        canvas.drawPath(arrowHead, Paint()..color = strokeColor);
      } else if (actor.shape == 'molecule') {
        canvas.drawCircle(Offset(cx - s * 0.45, cy), s * 0.65, fillPaint);
        canvas.drawCircle(Offset(cx - s * 0.45, cy), s * 0.65, strokePaint);
        canvas.drawCircle(Offset(cx + s * 0.45, cy), s * 0.65, fillPaint);
        canvas.drawCircle(Offset(cx + s * 0.45, cy), s * 0.65, strokePaint);
      } else {
        canvas.drawCircle(Offset(cx, cy), s * 0.7, fillPaint);
        canvas.drawCircle(Offset(cx, cy), s * 0.7, strokePaint);
      }

      final tp = TextPainter(
        text: TextSpan(
          text: actor.label,
          style: TextStyle(
            color: strokeColor,
            fontSize: 10.5,
            fontWeight: FontWeight.w600,
          ),
        ),
        textDirection: TextDirection.ltr,
      )..layout();
      tp.paint(canvas, Offset(cx - tp.width / 2, cy - s - 14));
    }
  }

  @override
  bool shouldRepaint(covariant _MotionScenePainter oldDelegate) {
    return oldDelegate.progress != progress || oldDelegate.spec.id != spec.id;
  }
}
