import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:roshan_study/app/theme/app_tokens.dart';

/// Shows a clean 1-tap WhatsApp Study Card preview sheet allowing students
/// to copy a formatted study summary or score card without extra plugins.
Future<void> showShareStudyCardSheet(
  BuildContext context, {
  required String kicker,
  required String title,
  String? highlightMetric,
  required List<String> lines,
}) async {
  final buffer = StringBuffer()
    ..writeln('*Roshan Study — $kicker*')
    ..writeln('*$title*');
  if (highlightMetric != null && highlightMetric.isNotEmpty) {
    buffer.writeln('Result: $highlightMetric');
  }
  buffer.writeln();
  for (final line in lines) {
    buffer.writeln(line);
  }
  buffer.writeln();
  buffer.write('Free offline KPK BISE Grades 9–12 & MDCAT practice.');

  final formattedText = buffer.toString();

  await showModalBottomSheet<void>(
    context: context,
    showDragHandle: true,
    builder: (sheetCtx) {
      final theme = Theme.of(sheetCtx);
      return SafeArea(
        top: false,
        child: Padding(
          padding: const EdgeInsets.fromLTRB(
            AppSpacing.lg,
            AppSpacing.xxs,
            AppSpacing.lg,
            AppSpacing.xl,
          ),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(
                '1-Tap WhatsApp Study Card',
                style: theme.textTheme.titleMedium,
              ),
              const SizedBox(height: AppSpacing.sm),
              Container(
                width: double.infinity,
                padding: const EdgeInsets.all(AppSpacing.md),
                decoration: BoxDecoration(
                  color: theme.colorScheme.surfaceContainerHighest
                      .withValues(alpha: 0.55),
                  borderRadius: BorderRadius.circular(AppRadius.lg),
                  border: Border.all(color: theme.colorScheme.outline),
                ),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(kicker, style: theme.textTheme.labelMedium),
                    const SizedBox(height: AppSpacing.xxs),
                    Text(title, style: theme.textTheme.titleSmall),
                    if (highlightMetric != null &&
                        highlightMetric.isNotEmpty) ...[
                      const SizedBox(height: AppSpacing.xs),
                      Text(
                        highlightMetric,
                        style: theme.textTheme.titleMedium?.copyWith(
                          color: theme.colorScheme.primary,
                        ),
                      ),
                    ],
                    const SizedBox(height: AppSpacing.xs),
                    for (final line in lines)
                      Padding(
                        padding:
                            const EdgeInsets.only(bottom: AppSpacing.xxs),
                        child: Text(line, style: theme.textTheme.bodySmall),
                      ),
                  ],
                ),
              ),
              const SizedBox(height: AppSpacing.md),
              SizedBox(
                width: double.infinity,
                child: FilledButton.icon(
                  onPressed: () async {
                    await Clipboard.setData(ClipboardData(text: formattedText));
                    if (sheetCtx.mounted) {
                      Navigator.of(sheetCtx).pop();
                    }
                    if (context.mounted) {
                      ScaffoldMessenger.of(context).showSnackBar(
                        const SnackBar(
                          content: Text(
                            'Study Card copied — paste directly into WhatsApp!',
                          ),
                        ),
                      );
                    }
                  },
                  icon: const Icon(Icons.copy_outlined),
                  label: const Text('Copy for WhatsApp'),
                ),
              ),
            ],
          ),
        ),
      );
    },
  );
}
