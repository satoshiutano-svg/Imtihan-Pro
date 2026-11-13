import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:roshan_study/app/theme/app_tokens.dart';
import 'package:roshan_study/app/theme/app_typography.dart';
import 'package:roshan_study/core/models/curriculum_models.dart';
import 'package:roshan_study/core/widgets/academic_surface.dart';
import 'package:roshan_study/data/repositories/content_repository.dart';
import 'package:roshan_study/data/repositories/profile_repository.dart';
import 'package:roshan_study/data/repositories/progress_repository.dart';

class PracticeScreen extends ConsumerStatefulWidget {
  const PracticeScreen({super.key});

  @override
  ConsumerState<PracticeScreen> createState() => _PracticeScreenState();
}

class _PracticeScreenState extends ConsumerState<PracticeScreen> {
  int _maxDifficulty = 7;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final profile = ref.watch(studentProfileProvider);
    final contentRepo = ref.watch(contentRepositoryProvider);
    final progressRepo = ref.watch(progressRepositoryProvider);

    final report = progressRepo.buildReport(programmeId: ProgrammeId.sscHssc);
    final packs = contentRepo
        .getPacksForProgramme(ProgrammeId.sscHssc)
        .where((p) => p.grade == profile.grade.number)
        .toList(growable: false);

    return StudyPageContainer(
      children: [
        const StudySectionHeader(
          kicker: 'Understand → Recall → Practise',
          title: 'Progressive Practice Engine',
          subtitle:
              'Hints unlock one step at a time before solutions. Wrong answers schedule automatic 1-day spaced revision.',
        ),
        const SizedBox(height: AppSpacing.md),
        Row(
          mainAxisAlignment: MainAxisAlignment.spaceBetween,
          children: [
            Text('Max Difficulty', style: theme.textTheme.titleSmall),
            Text(
              'Level $_maxDifficulty of 7',
              style: AppTypography.tabular(
                theme.textTheme.labelLarge,
                color: theme.colorScheme.primary,
              ),
            ),
          ],
        ),
        Slider(
          value: _maxDifficulty.toDouble(),
          min: 1,
          max: 7,
          divisions: 6,
          label: 'Level $_maxDifficulty',
          onChanged: (v) => setState(() => _maxDifficulty = v.round()),
        ),
        const SizedBox(height: AppSpacing.xs),
        OutlinedButton.icon(
          onPressed: () => context.push('/practice/match'),
          icon: const Icon(Icons.extension_outlined, size: AppIconSize.sm),
          label: const Text('2-Min Formula & Unit Match'),
        ),
        if (report.dueRevisions.isNotEmpty) ...[
          const StudyDivider(verticalPadding: AppSpacing.lg),
          AcademicSurface(
            backgroundColor:
                theme.colorScheme.primaryContainer.withValues(alpha: 0.3),
            borderColor: theme.colorScheme.primary.withValues(alpha: 0.35),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  'Spaced Revision Due (${report.dueRevisions.length})',
                  style: theme.textTheme.titleMedium,
                ),
                const SizedBox(height: AppSpacing.xxs),
                Text(
                  'Strengthen concepts scheduled by your 1d / 3d / 7d retrieval plan.',
                  style: theme.textTheme.bodyMedium,
                ),
                const SizedBox(height: AppSpacing.sm),
                FilledButton.icon(
                  onPressed: () => context.push(
                    '/practice/session?conceptId=${report.dueRevisions.first.conceptId}',
                  ),
                  icon: const Icon(Icons.replay_outlined),
                  label: Text('Revise: ${report.dueRevisions.first.conceptTitle}'),
                ),
              ],
            ),
          ),
        ],
        const StudyDivider(verticalPadding: AppSpacing.xl),
        StudySectionHeader(
          title: 'Chapters for ${profile.grade.label}',
          subtitle: 'Select a chapter to begin timed-free step practice',
        ),
        const SizedBox(height: AppSpacing.sm),
        if (packs.isEmpty)
          StudyEmptyState(
            icon: Icons.edit_note_outlined,
            title: 'No chapters loaded for ${profile.grade.label} yet',
            message:
                'Switch your grade or open Learn to browse available starter chapters.',
            actionLabel: 'Browse Learn Library',
            onAction: () => context.go('/learn'),
          )
        else
          AcademicSurface(
            padding: EdgeInsets.zero,
            child: Column(
              children: [
                for (int i = 0; i < packs.length; i++) ...[
                  if (i > 0) const Divider(height: 1),
                  Builder(
                    builder: (context) {
                      final pack = packs[i];
                      final count = pack.questions
                          .where((q) => q.difficulty <= _maxDifficulty)
                          .length;
                      return ListTile(
                        minTileHeight: 60,
                        title: Text(
                          'Ch ${pack.chapterNumber}: ${pack.title}',
                          style: theme.textTheme.titleSmall,
                        ),
                        subtitle: Text(
                          '$count question${count == 1 ? '' : 's'} up to Level $_maxDifficulty',
                        ),
                        trailing: Icon(
                          Icons.play_circle_outline,
                          color: theme.colorScheme.primary,
                        ),
                        onTap: () => context.push(
                          '/practice/session?chapterId=${pack.chapterId}&maxDifficulty=$_maxDifficulty',
                        ),
                      );
                    },
                  ),
                ],
              ],
            ),
          ),
      ],
    );
  }
}
