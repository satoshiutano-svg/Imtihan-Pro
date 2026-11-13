import 'package:flutter/widgets.dart';

/// Resolves Unicode RTL/LTR directionality for multilingual content blocks.
///
/// Even while the Phase 1 UI remains English, Urdu language subject content
/// or technical Urdu terms render right-to-left cleanly without distorting
/// surrounding English interface chrome.
class RtlAwareText extends StatelessWidget {
  const RtlAwareText(
    this.data, {
    super.key,
    this.style,
    this.explicitDirection,
    this.textAlign,
    this.maxLines,
    this.overflow,
  });

  final String data;
  final TextStyle? style;
  final TextDirection? explicitDirection;
  final TextAlign? textAlign;
  final int? maxLines;
  final TextOverflow? overflow;

  static final RegExp _rtlScriptRegex = RegExp(
    r'[\u0600-\u06FF\u0750-\u077F\u08A0-\u08FF\uFB50-\uFDFF\uFE70-\uFEFF]',
  );

  static TextDirection resolveDirection(
    String text, {
    TextDirection? explicitDirection,
  }) {
    if (explicitDirection != null) return explicitDirection;
    return _rtlScriptRegex.hasMatch(text)
        ? TextDirection.rtl
        : TextDirection.ltr;
  }

  @override
  Widget build(BuildContext context) {
    final direction = resolveDirection(
      data,
      explicitDirection: explicitDirection,
    );

    return Directionality(
      textDirection: direction,
      child: Text(
        data,
        style: style,
        textAlign: textAlign ??
            (direction == TextDirection.rtl ? TextAlign.right : TextAlign.left),
        maxLines: maxLines,
        overflow: overflow,
      ),
    );
  }
}
