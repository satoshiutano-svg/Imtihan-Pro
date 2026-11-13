import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:roshan_study/app/theme/app_tokens.dart';
import 'package:roshan_study/app/theme/app_typography.dart';
import 'package:roshan_study/core/models/curriculum_models.dart';
import 'package:roshan_study/core/widgets/academic_surface.dart';
import 'package:roshan_study/data/repositories/progress_repository.dart';

class ProgressScreen extends ConsumerWidget {
  const ProgressScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final theme = Theme.of(context);
    final progressRepo = ref.watch(progressRepositoryProvider);
    final report = progressRepo.buildReport(programmeId: ProgrammeId.sscHssc);

    return StudyPageContainer(
      children: [
        const StudySectionHeader(
          kicker: 'Local Analytics',
          title: 'Verified Board Progress (SSC / HSSC)',
          subtitle:
              'Calculated strictly from your completed local attempts—never estimated or inflated.',
        ),
        const SizedBox(height: AppSpacing.md),

        // Unboxed typographic 2x2 stat grid with tabular figures
        Row(
          children: [
            _MetricCell(
              label: 'Topics Studied',
              value: '${report.topicsStudied}',
            ),
            _MetricCell(
              label: 'Questions Attempted',
              value: '${report.questionsAttempted}',
            ),
          ],
        ),
        const SizedBox(height: AppSpacing.md),
        Row(
          children: [
            _MetricCell(
              label: 'Verified Accuracy',
              value: report.verifiedAccuracy == null
                  ? '—'
                  : '${(report.verifiedAccuracy! * 100).round()}%',
            ),
            _MetricCell(
              label: 'Time Spent',
              value: '${(report.totalTimeSpentSec / 60).ceil()} min',
            ),
          ],
        ),

        const StudyDivider(verticalPadding: AppSpacing.xl),

        const StudySectionHeader(
          title: 'Spaced Revision Queue',
          subtitle: '1d → 3d → 7d retrieval schedule',
        ),
        const SizedBox(height: AppSpacing.sm),
        if (report.dueRevisions.isEmpty)
          StudyEmptyState(
            icon: Icons.replay_outlined,
            title: 'No overdue concepts right now',
            message:
                'Complete practice questions to schedule automatic retrieval reviews.',
            actionLabel: report.questionsAttempted == 0
                ? 'Start First Practice'
                : null,
            onAction: report.questionsAttempted == 0
                ? () => context.go('/practice')
                : null,
          )
        else
          AcademicSurface(
            padding: EdgeInsets.zero,
            child: Column(
              children: [
                for (int i = 0; i < report.dueRevisions.length; i++) ...[
                  if (i > 0) const Divider(height: 1),
                  Builder(
                    builder: (context) {
                      final rev = report.dueRevisions[i];
                      return ListTile(
                        minTileHeight: 60,
                        title: Text(
                          rev.conceptTitle,
                          style: theme.textTheme.titleSmall,
                        ),
                        subtitle: Text(
                          'Interval: ${rev.intervalDays}d • Mistakes recorded: ${rev.mistakeCount}',
                        ),
                        trailing: FilledButton(
                          onPressed: () => context.push(
                            '/practice/session?conceptId=${rev.conceptId}',
                          ),
                          child: const Text('Revise'),
                        ),
                      );
                    },
                  ),
                ],
              ],
            ),
          ),

        const StudyDivider(verticalPadding: AppSpacing.xl),

        const StudySectionHeader(
          title: 'Chapter Mastery Breakdown',
          subtitle: 'Verified accuracy per chapter',
        ),
        const SizedBox(height: AppSpacing.sm),
        AcademicSurface(
          padding: EdgeInsets.zero,
          child: Column(
            children: [
              for (int i = 0; i < report.chapterSummaries.length; i++) ...[
                if (i > 0) const Divider(height: 1),
                Builder(
                  builder: (context) {
                    final ch = report.chapterSummaries[i];
                    return Padding(
                      padding: const EdgeInsets.symmetric(
                        horizontal: AppSpacing.md,
                        vertical: AppSpacing.sm,
                      ),
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Row(
                            mainAxisAlignment: MainAxisAlignment.spaceBetween,
                            children: [
                              Expanded(
                                child: Text(
                                  ch.chapterTitle,
                                  style: theme.textTheme.titleSmall,
                                ),
                              ),
                              Text(
                                ch.verifiedAccuracy == null
                                    ? '—'
                                    : '${(ch.verifiedAccuracy! * 100).round()}%',
                                style: AppTypography.tabular(
                                  theme.textTheme.labelLarge,
                                  color: ch.verifiedAccuracy == null
                                      ? theme.colorScheme.onSurfaceVariant
                                      : theme.colorScheme.primary,
                                ),
                              ),
                            ],
                          ),
                          const SizedBox(height: AppSpacing.xxs),
                          Text(
                            ch.verifiedAccuracy == null
                                ? 'Not attempted yet (${ch.totalQuestionsInChapter} questions)'
                                : '${ch.correctCount}/${ch.attemptedCount} correct',
                            style: theme.textTheme.bodySmall,
                          ),
                          if (ch.verifiedAccuracy != null) ...[
                            const SizedBox(height: AppSpacing.xs),
                            LinearProgressIndicator(value: ch.verifiedAccuracy),
                          ],
                        ],
                      ),
                    );
                  },
                ),
              ],
            ],
          ),
        ),

        if (report.mockScores.isNotEmpty) ...[
          const StudyDivider(verticalPadding: AppSpacing.xl),
          const StudySectionHeader(title: 'Mock Examination History'),
          const SizedBox(height: AppSpacing.sm),
          AcademicSurface(
            padding: EdgeInsets.zero,
            child: Column(
              children: [
                for (int i = 0; i < report.mockScores.length; i++) ...[
                  if (i > 0) const Divider(height: 1),
                  ListTile(
                    minTileHeight: 56,
                    title: Text(report.mockScores[i].title),
                    trailing: Text(
                      '${report.mockScores[i].score} / ${report.mockScores[i].maxScore}',
                      style: AppTypography.tabular(theme.textTheme.titleSmall),
                    ),
                  ),
                ],
              ],
            ),
          ),
        ],
      ],
    );
  }
}

class _MetricCell extends StatelessWidget {
  const _MetricCell({required this.label, required this.value});

  final String label;
  final String value;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    return Expanded(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            value,
            style: AppTypography.tabular(theme.textTheme.headlineMedium),
          ),
          const SizedBox(height: 2),
          Text(label, style: theme.textTheme.bodySmall),
        ],
      ),
    );
  }
}
