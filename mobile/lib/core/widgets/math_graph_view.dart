import 'package:flutter/material.dart';
import 'package:roshan_study/app/theme/app_colors.dart';
import 'package:roshan_study/app/theme/app_tokens.dart';
import 'package:roshan_study/app/theme/app_typography.dart';
import 'package:roshan_study/core/models/curriculum_models.dart';
import 'package:roshan_study/core/widgets/academic_surface.dart';
import 'package:roshan_study/core/widgets/math_text.dart';

/// Interactive coordinate graph plotter supporting multi-series curves, area fill,
/// key highlight points, and a touch trace slider for STEM inspection offline.
class MathGraphView extends StatefulWidget {
  const MathGraphView({super.key, required this.spec});

  final GraphSpec spec;

  @override
  State<MathGraphView> createState() => _MathGraphViewState();
}

class _MathGraphViewState extends State<MathGraphView> {
  late double _traceX;

  @override
  void initState() {
    super.initState();
    _traceX = (widget.spec.xMin + widget.spec.xMax) / 2;
  }

  double _interpolateY(List<GraphPoint> points, double targetX) {
    if (points.isEmpty) return 0;
    final sorted = [...points]..sort((a, b) => a.x.compareTo(b.x));
    if (targetX <= sorted.first.x) return sorted.first.y;
    if (targetX >= sorted.last.x) return sorted.last.y;
    for (int i = 0; i < sorted.length - 1; i++) {
      final a = sorted[i];
      final b = sorted[i + 1];
      if (targetX >= a.x && targetX <= b.x) {
        final span = b.x - a.x;
        if (span == 0) return a.y;
        return a.y + (b.y - a.y) * ((targetX - a.x) / span);
      }
    }
    return sorted.first.y;
  }

  Color _colorForToken(VisualColorToken token, bool isDark) {
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
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final isDark = theme.brightness == Brightness.dark;

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
                'Graph',
                style: AppTypography.tabular(
                  theme.textTheme.labelMedium,
                  color: theme.colorScheme.primary,
                ),
              ),
            ],
          ),
          const SizedBox(height: AppSpacing.sm),
          Container(
            height: 195,
            decoration: BoxDecoration(
              color: isDark ? AppColors.surfaceDark : AppColors.surfaceLight,
              borderRadius: BorderRadius.circular(AppRadius.md),
              border: Border.all(color: theme.colorScheme.outline),
            ),
            child: CustomPaint(
              painter: _GraphPlotPainter(
                spec: widget.spec,
                traceX: _traceX,
                isDark: isDark,
                axisColor: theme.colorScheme.onSurfaceVariant,
                gridColor: theme.colorScheme.outline.withValues(alpha: 0.5),
                interpolateY: _interpolateY,
                colorForToken: (t) => _colorForToken(t, isDark),
              ),
            ),
          ),
          const SizedBox(height: AppSpacing.xs),
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Text(
                'Trace ${widget.spec.xLabel}:',
                style: theme.textTheme.bodySmall,
              ),
              Text(
                _traceX.toStringAsFixed(2),
                style: AppTypography.tabular(theme.textTheme.labelLarge),
              ),
            ],
          ),
          Slider(
            value: _traceX.clamp(widget.spec.xMin, widget.spec.xMax),
            min: widget.spec.xMin,
            max: widget.spec.xMax,
            onChanged: (v) => setState(() => _traceX = v),
          ),
          for (final series in widget.spec.series)
            Padding(
              padding: const EdgeInsets.only(bottom: 4),
              child: Row(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: [
                  Row(
                    children: [
                      Container(
                        width: 10,
                        height: 10,
                        decoration: BoxDecoration(
                          color: _colorForToken(series.colorToken, isDark),
                          shape: BoxShape.circle,
                        ),
                      ),
                      const SizedBox(width: 6),
                      Text(series.name, style: theme.textTheme.bodySmall),
                    ],
                  ),
                  Text(
                    _interpolateY(series.points, _traceX).toStringAsFixed(2),
                    style: AppTypography.tabular(theme.textTheme.labelLarge),
                  ),
                ],
              ),
            ),
          if (widget.spec.highlights.isNotEmpty) ...[
            const SizedBox(height: AppSpacing.xs),
            Wrap(
              spacing: 6,
              runSpacing: 6,
              children: [
                for (final hl in widget.spec.highlights)
                  ActionChip(
                    label: Text(hl.label),
                    visualDensity: VisualDensity.compact,
                    onPressed: () => setState(() => _traceX = hl.x),
                  ),
              ],
            ),
          ],
        ],
      ),
    );
  }
}

class _GraphPlotPainter extends CustomPainter {
  _GraphPlotPainter({
    required this.spec,
    required this.traceX,
    required this.isDark,
    required this.axisColor,
    required this.gridColor,
    required this.interpolateY,
    required this.colorForToken,
  });

  final GraphSpec spec;
  final double traceX;
  final bool isDark;
  final Color axisColor;
  final Color gridColor;
  final double Function(List<GraphPoint> pts, double x) interpolateY;
  final Color Function(VisualColorToken token) colorForToken;

  @override
  void paint(Canvas canvas, Size size) {
    const padLeft = 40.0;
    const padRight = 14.0;
    const padTop = 14.0;
    const padBottom = 30.0;

    final plotW = size.width - padLeft - padRight;
    final plotH = size.height - padTop - padBottom;
    final xSpan = (spec.xMax - spec.xMin).abs() < 1e-6 ? 1.0 : spec.xMax - spec.xMin;
    final ySpan = (spec.yMax - spec.yMin).abs() < 1e-6 ? 1.0 : spec.yMax - spec.yMin;

    double toX(double x) => padLeft + ((x - spec.xMin) / xSpan) * plotW;
    double toY(double y) => padTop + plotH - ((y - spec.yMin) / ySpan) * plotH;

    final gridPaint = Paint()
      ..color = gridColor
      ..strokeWidth = 0.8;

    for (final f in [0.0, 0.25, 0.5, 0.75, 1.0]) {
      final gx = padLeft + f * plotW;
      final gy = padTop + f * plotH;
      canvas.drawLine(Offset(padLeft, gy), Offset(padLeft + plotW, gy), gridPaint);
      canvas.drawLine(Offset(gx, padTop), Offset(gx, padTop + plotH), gridPaint);
    }

    final axisPaint = Paint()
      ..color = axisColor
      ..strokeWidth = 1.4;
    canvas.drawLine(
      const Offset(padLeft, padTop),
      Offset(padLeft, padTop + plotH),
      axisPaint,
    );
    canvas.drawLine(
      Offset(padLeft, padTop + plotH),
      Offset(padLeft + plotW, padTop + plotH),
      axisPaint,
    );

    for (final series in spec.series) {
      final color = colorForToken(series.colorToken);
      final sorted = [...series.points]..sort((a, b) => a.x.compareTo(b.x));
      if (sorted.length < 2) continue;

      final linePath = Path();
      for (int i = 0; i < sorted.length; i++) {
        final px = toX(sorted[i].x);
        final py = toY(sorted[i].y);
        if (i == 0) {
          linePath.moveTo(px, py);
        } else {
          linePath.lineTo(px, py);
        }
      }

      if (series.showArea) {
        final areaPath = Path.from(linePath)
          ..lineTo(toX(sorted.last.x), padTop + plotH)
          ..lineTo(toX(sorted.first.x), padTop + plotH)
          ..close();
        canvas.drawPath(
          areaPath,
          Paint()..color = color.withValues(alpha: 0.14),
        );
      }

      canvas.drawPath(
        linePath,
        Paint()
          ..color = color
          ..style = PaintingStyle.stroke
          ..strokeWidth = 2.4
          ..strokeCap = StrokeCap.round,
      );
    }

    final cursorX = toX(traceX);
    canvas.drawLine(
      Offset(cursorX, padTop),
      Offset(cursorX, padTop + plotH),
      Paint()
        ..color = axisColor.withValues(alpha: 0.55)
        ..strokeWidth = 1.2,
    );

    for (final series in spec.series) {
      final color = colorForToken(series.colorToken);
      final cy = toY(interpolateY(series.points, traceX));
      canvas.drawCircle(Offset(cursorX, cy), 4.5, Paint()..color = color);
      canvas.drawCircle(
        Offset(cursorX, cy),
        4.5,
        Paint()
          ..color = Colors.white
          ..style = PaintingStyle.stroke
          ..strokeWidth = 1.5,
      );
    }
  }

  @override
  bool shouldRepaint(covariant _GraphPlotPainter oldDelegate) {
    return oldDelegate.traceX != traceX || oldDelegate.spec.id != spec.id;
  }
}
