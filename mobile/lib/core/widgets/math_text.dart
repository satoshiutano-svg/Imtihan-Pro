import 'package:flutter/material.dart';
import 'package:roshan_study/app/theme/app_typography.dart';

/// Pure-Dart offline math and mixed LaTeX text renderer for Roshan Study.
///
/// Supports inline `$ ... $` and display `$$ ... $$` equations with stacked
/// `\frac{num}{den}`, superscripts (`^2`, `^{n+1}`), subscripts (`_i`, `_{max}`),
/// `\vec{v}`, `\sqrt{...}`, `\text{...}`, and standard board symbols.
class MathText extends StatelessWidget {
  const MathText(
    this.text, {
    super.key,
    this.style,
    this.textDirection,
    this.mathColor,
  });

  final String text;
  final TextStyle? style;
  final TextDirection? textDirection;
  final Color? mathColor;

  @override
  Widget build(BuildContext context) {
    if (!text.contains(r'$')) {
      return Text(
        text,
        style: style,
        textDirection: textDirection,
      );
    }

    final baseStyle = style ?? DefaultTextStyle.of(context).style;
    final resolvedMathStyle = AppTypography.tabular(
      baseStyle,
      color: mathColor ?? baseStyle.color,
    ).copyWith(fontWeight: baseStyle.fontWeight ?? FontWeight.w600);

    final segments = _tokenizeSegments(text);
    final children = <InlineSpan>[];

    for (final seg in segments) {
      if (!seg.isMath) {
        children.add(TextSpan(text: seg.value, style: baseStyle));
      } else if (seg.isDisplay) {
        children.add(
          WidgetSpan(
            alignment: PlaceholderAlignment.middle,
            child: Padding(
              padding: const EdgeInsets.symmetric(vertical: 4),
              child: _buildMathWidget(seg.value, resolvedMathStyle),
            ),
          ),
        );
      } else {
        children.addAll(_buildInlineMathSpans(seg.value, resolvedMathStyle));
      }
    }

    return Text.rich(
      TextSpan(children: children),
      style: baseStyle,
      textDirection: textDirection,
    );
  }

  Widget _buildMathWidget(String latex, TextStyle style) {
    return SingleChildScrollView(
      scrollDirection: Axis.horizontal,
      child: Text.rich(
        TextSpan(children: _buildInlineMathSpans(latex, style)),
        style: style,
      ),
    );
  }

  List<InlineSpan> _buildInlineMathSpans(String raw, TextStyle mathStyle) {
    final cleaned = _replaceSymbols(raw.trim());
    final spans = <InlineSpan>[];
    int i = 0;

    while (i < cleaned.length) {
      // Stacked fraction \frac{num}{den}
      if (cleaned.startsWith(r'\frac', i)) {
        final numRes = _readBracedGroup(cleaned, i + 5);
        final denRes = numRes != null
            ? _readBracedGroup(cleaned, numRes.nextIndex)
            : null;
        if (numRes != null && denRes != null) {
          final smallStyle = mathStyle.copyWith(
            fontSize: (mathStyle.fontSize ?? 14) * 0.85,
          );
          spans.add(
            WidgetSpan(
              alignment: PlaceholderAlignment.middle,
              child: Padding(
                padding: const EdgeInsets.symmetric(horizontal: 2),
                child: IntrinsicWidth(
                  child: Column(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      Text.rich(
                        TextSpan(
                          children: _buildInlineMathSpans(
                            numRes.content,
                            smallStyle,
                          ),
                        ),
                        textAlign: TextAlign.center,
                      ),
                      Container(
                        height: 1.2,
                        color: mathStyle.color ?? Colors.black87,
                        margin: const EdgeInsets.symmetric(vertical: 1.5),
                      ),
                      Text.rich(
                        TextSpan(
                          children: _buildInlineMathSpans(
                            denRes.content,
                            smallStyle,
                          ),
                        ),
                        textAlign: TextAlign.center,
                      ),
                    ],
                  ),
                ),
              ),
            ),
          );
          i = denRes.nextIndex;
          continue;
        }
      }

      // Square root \sqrt{...}
      if (cleaned.startsWith(r'\sqrt', i)) {
        final argRes = _readBracedGroup(cleaned, i + 5);
        if (argRes != null) {
          spans.add(TextSpan(text: '√(${argRes.content})', style: mathStyle));
          i = argRes.nextIndex;
          continue;
        }
      }

      // Vector \vec{v} or \text{...}
      if (cleaned.startsWith(r'\text', i)) {
        final argRes = _readBracedGroup(cleaned, i + 5);
        if (argRes != null) {
          spans.add(
            TextSpan(
              text: argRes.content,
              style: mathStyle.copyWith(fontWeight: FontWeight.normal),
            ),
          );
          i = argRes.nextIndex;
          continue;
        }
      }
      if (cleaned.startsWith(r'\vec', i)) {
        final argRes = _readBracedGroup(cleaned, i + 4);
        if (argRes != null) {
          spans.add(TextSpan(text: '${argRes.content}⃗', style: mathStyle));
          i = argRes.nextIndex;
          continue;
        }
      }

      // Superscript ^
      if (cleaned[i] == '^' && i + 1 < cleaned.length) {
        final supRes = _readScriptArg(cleaned, i + 1);
        spans.add(
          WidgetSpan(
            alignment: PlaceholderAlignment.top,
            child: Transform.translate(
              offset: const Offset(0, -3),
              child: Text(
                supRes.content,
                style: mathStyle.copyWith(
                  fontSize: (mathStyle.fontSize ?? 14) * 0.72,
                ),
              ),
            ),
          ),
        );
        i = supRes.nextIndex;
        continue;
      }

      // Subscript _
      if (cleaned[i] == '_' && i + 1 < cleaned.length) {
        final subRes = _readScriptArg(cleaned, i + 1);
        spans.add(
          WidgetSpan(
            alignment: PlaceholderAlignment.bottom,
            child: Transform.translate(
              offset: const Offset(0, 2),
              child: Text(
                subRes.content,
                style: mathStyle.copyWith(
                  fontSize: (mathStyle.fontSize ?? 14) * 0.72,
                ),
              ),
            ),
          ),
        );
        i = subRes.nextIndex;
        continue;
      }

      // Accumulate plain math characters up to next token
      int next = i + 1;
      while (next < cleaned.length &&
          cleaned[next] != '^' &&
          cleaned[next] != '_' &&
          !cleaned.startsWith(r'\frac', next) &&
          !cleaned.startsWith(r'\sqrt', next) &&
          !cleaned.startsWith(r'\text', next) &&
          !cleaned.startsWith(r'\vec', next)) {
        next++;
      }
      spans.add(TextSpan(text: cleaned.substring(i, next), style: mathStyle));
      i = next;
    }

    return spans;
  }

  static String _replaceSymbols(String s) {
    return s
        .replaceAll(r'\;', ' ')
        .replaceAll(r'\,', ' ')
        .replaceAll(r'\times', '×')
        .replaceAll(r'\cdot', '·')
        .replaceAll(r'\div', '÷')
        .replaceAll(r'\pm', '±')
        .replaceAll(r'\approx', '≈')
        .replaceAll(r'\neq', '≠')
        .replaceAll(r'\le', '≤')
        .replaceAll(r'\ge', '≥')
        .replaceAll(r'\propto', '∝')
        .replaceAll(r'\implies', '⟹')
        .replaceAll(r'\rightleftharpoons', '⇌')
        .replaceAll(r'\rightarrow', '→')
        .replaceAll(r'\leftarrow', '←')
        .replaceAll(r'\uparrow', '↑')
        .replaceAll(r'\downarrow', '↓')
        .replaceAll(r'\Delta', 'Δ')
        .replaceAll(r'\Omega', 'Ω')
        .replaceAll(r'\alpha', 'α')
        .replaceAll(r'\beta', 'β')
        .replaceAll(r'\gamma', 'γ')
        .replaceAll(r'\theta', 'θ')
        .replaceAll(r'\lambda', 'λ')
        .replaceAll(r'\pi', 'π')
        .replaceAll(r'\mu', 'µ')
        .replaceAll(r'\varepsilon', 'ε')
        .replaceAll(r'\infty', '∞');
  }

  static _BracedResult? _readBracedGroup(String input, int start) {
    int idx = start;
    while (idx < input.length && input[idx] == ' ') {
      idx++;
    }
    if (idx >= input.length || input[idx] != '{') return null;
    int depth = 1;
    int cursor = idx + 1;
    while (cursor < input.length && depth > 0) {
      if (input[cursor] == '{') depth++;
      if (input[cursor] == '}') depth--;
      cursor++;
    }
    if (depth != 0) return null;
    return _BracedResult(input.substring(idx + 1, cursor - 1), cursor);
  }

  static _BracedResult _readScriptArg(String input, int start) {
    if (input[start] == '{') {
      final braced = _readBracedGroup(input, start);
      if (braced != null) return braced;
    }
    return _BracedResult(input[start], start + 1);
  }

  static List<_MathSegment> _tokenizeSegments(String input) {
    final segments = <_MathSegment>[];
    int i = 0;

    while (i < input.length) {
      if (i + 1 < input.length && input[i] == r'$' && input[i + 1] == r'$') {
        final end = input.indexOf(r'$$', i + 2);
        if (end != -1) {
          segments.add(
            _MathSegment(
              value: input.substring(i + 2, end),
              isMath: true,
              isDisplay: true,
            ),
          );
          i = end + 2;
          continue;
        }
      }

      if (input[i] == r'$') {
        final end = input.indexOf(r'$', i + 1);
        if (end != -1) {
          segments.add(
            _MathSegment(
              value: input.substring(i + 1, end),
              isMath: true,
              isDisplay: false,
            ),
          );
          i = end + 1;
          continue;
        }
      }

      int next = input.indexOf(r'$', i + 1);
      if (next == -1) next = input.length;
      segments.add(
        _MathSegment(
          value: input.substring(i, next),
          isMath: false,
          isDisplay: false,
        ),
      );
      i = next;
    }

    return segments;
  }
}

class _BracedResult {
  const _BracedResult(this.content, this.nextIndex);
  final String content;
  final int nextIndex;
}

class _MathSegment {
  const _MathSegment({
    required this.value,
    required this.isMath,
    required this.isDisplay,
  });

  final String value;
  final bool isMath;
  final bool isDisplay;
}
