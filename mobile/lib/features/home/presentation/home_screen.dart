import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:roshan_study/app/theme/app_tokens.dart';
import 'package:roshan_study/app/theme/app_typography.dart';
import 'package:roshan_study/core/models/curriculum_models.dart';
import 'package:roshan_study/core/models/progress_models.dart';
import 'package:roshan_study/core/widgets/academic_surface.dart';
import 'package:roshan_study/core/widgets/motion_system.dart';
import 'package:roshan_study/core/widgets/share_study_card_sheet.dart';
import 'package:roshan_study/data/kpk_subject_catalog.dart';
import 'package:roshan_study/data/repositories/content_repository.dart';
import 'package:roshan_study/data/repositories/profile_repository.dart';
import 'package:roshan_study/data/repositories/progress_repository.dart';

class HomeScreen extends ConsumerWidget {
  const HomeScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final theme = Theme.of(context);
    final profile = ref.watch(studentProfileProvider);
    final contentRepo = ref.watch(contentRepositoryProvider);
    final progressRepo = ref.watch(progressRepositoryProvider);

    final subjects = KpkSubjectCatalog.subjectsForProfile(
      grade: profile.grade,
      group: profile.group,
      selectedElectiveIds: profile.selectedElectiveIds,
    );
    final report = progressRepo.buildReport(programmeId: ProgrammeId.sscHssc);
    final dailyGoal = progressRepo.getDailyGoalProgress();
    final recentReading = contentRepo.getMostRecentReading();
    final recentConcept = recentReading == null
        ? null
        : contentRepo.getConceptById(recentReading.conceptId);
    final daysLeft = profile.daysUntilExam();

    final recommendedPack = contentRepo
        .getPacksForProgramme(ProgrammeId.sscHssc)
        .where((p) => p.grade == profile.grade.number)
        .firstOrNull;

    return StudyPageContainer(
      children: [
        // Calm Academic Profile Context Strip (unboxed, breathes naturally)
        Row(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    '${profile.grade.label} • ${profile.group.displayName}',
                    style: theme.textTheme.titleLarge,
                  ),
                  const SizedBox(height: AppSpacing.xxs),
                  StudyMetadataLine(
                    parts: [
                      profile.board.displayName,
                      'English Medium',
                      '${subjects.length} subjects',
                      if (daysLeft != null)
                        daysLeft >= 0
                            ? '$daysLeft day${daysLeft == 1 ? '' : 's'} to exam'
                            : 'Exam date passed',
                    ],
                  ),
                ],
              ),
            ),
            TextButton.icon(
              onPressed: () => context.push('/onboarding'),
              icon: const Icon(Icons.tune_outlined, size: AppIconSize.sm),
              label: const Text('Change'),
            ),
          ],
        ),

        if (!profile.onboardingCompleted) ...[
          const SizedBox(height: AppSpacing.md),
          AcademicSurface(
            backgroundColor:
                theme.colorScheme.primaryContainer.withValues(alpha: 0.35),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  'Set your KPK BISE board & grade',
                  style: theme.textTheme.titleMedium,
                ),
                const SizedBox(height: AppSpacing.xxs),
                Text(
                  'No account required. Choose your grade (9–12), group, and subjects so Roshan Study filters chapters for you.',
                  style: theme.textTheme.bodyMedium,
                ),
                const SizedBox(height: AppSpacing.sm),
                FilledButton(
                  onPressed: () => context.push('/onboarding'),
                  child: const Text('Select Grade & Board'),
                ),
              ],
            ),
          ),
        ],

        const SizedBox(height: AppSpacing.md),

        // Single Dominant Focal Action: Answers "What should I study or practise next?"
        AcademicSurface(
          backgroundColor:
              theme.colorScheme.primaryContainer.withValues(alpha: 0.28),
          borderColor: theme.colorScheme.primary.withValues(alpha: 0.35),
          padding: const EdgeInsets.all(AppSpacing.lg),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(
                'NEXT RECOMMENDED STEP',
                style: theme.textTheme.labelSmall?.copyWith(
                  color: theme.colorScheme.primary,
                ),
              ),
              const SizedBox(height: AppSpacing.xxs),
              Text(
                'What should I study or practise next?',
                style: theme.textTheme.headlineSmall,
              ),
              const SizedBox(height: AppSpacing.xs),
              if (report.dueRevisions.isNotEmpty) ...[
                Text(
                  'Revise "${report.dueRevisions.first.conceptTitle}" — ${report.dueRevisions.length} concept${report.dueRevisions.length == 1 ? '' : 's'} due on your 1d → 3d → 7d schedule.',
                  style: theme.textTheme.bodyMedium,
                ),
                const SizedBox(height: AppSpacing.md),
                SizedBox(
                  width: double.infinity,
                  child: FilledButton.icon(
                    onPressed: () => context.push(
                      '/practice/session?conceptId=${report.dueRevisions.first.conceptId}',
                    ),
                    icon: const Icon(Icons.replay_outlined),
                    label: const Text('Start Revision Practice'),
                  ),
                ),
              ] else if (recentConcept != null) ...[
                Text(
                  'Continue learning: ${recentConcept.title}',
                  style: theme.textTheme.bodyMedium,
                ),
                const SizedBox(height: AppSpacing.md),
                SizedBox(
                  width: double.infinity,
                  child: FilledButton.icon(
                    onPressed: () => context.push(
                      '/learn/chapter/${recentConcept.chapterId}/concept/${recentConcept.id}',
                    ),
                    icon: const Icon(Icons.menu_book_outlined),
                    label: const Text('Continue Reading'),
                  ),
                ),
              ] else if (recommendedPack != null &&
                  recommendedPack.concepts.isNotEmpty) ...[
                Text(
                  'Start with ${recommendedPack.title}: ${recommendedPack.concepts.first.title}',
                  style: theme.textTheme.bodyMedium,
                ),
                const SizedBox(height: AppSpacing.md),
                SizedBox(
                  width: double.infinity,
                  child: FilledButton.icon(
                    onPressed: () => context.push(
                      '/learn/chapter/${recommendedPack.chapterId}/concept/${recommendedPack.concepts.first.id}',
                    ),
                    icon: const Icon(Icons.play_arrow_outlined),
                    label: const Text('Start First Concept'),
                  ),
                ),
              ] else ...[
                Text(
                  'Open your subject library or practise verified board questions.',
                  style: theme.textTheme.bodyMedium,
                ),
                const SizedBox(height: AppSpacing.md),
                SizedBox(
                  width: double.infinity,
                  child: FilledButton.icon(
                    onPressed: () => context.go('/learn'),
                    icon: const Icon(Icons.menu_book_outlined),
                    label: const Text('Open Subject Library'),
                  ),
                ),
              ],
            ],
          ),
        ),

        const StudyDivider(verticalPadding: AppSpacing.xl),

        // 5-Minute Study Goal & Daily Question Target
        StudySectionHeader(
          title: 'Daily 5-Minute Routine',
          subtitle:
              '${dailyGoal.questionsCompleted}/${profile.dailyQuestionTarget} questions today • ${dailyGoal.graceFreezesRemaining} grace freeze${dailyGoal.graceFreezesRemaining == 1 ? '' : 's'} left',
          trailing: Text(
            '${dailyGoal.streakDays}-day streak',
            style: AppTypography.tabular(
              theme.textTheme.labelLarge,
              color: theme.colorScheme.primary,
            ),
          ),
        ),
        const SizedBox(height: AppSpacing.sm),
        AnimatedProgressTrack(
          value: (dailyGoal.questionsCompleted / profile.dailyQuestionTarget)
              .clamp(0.0, 1.0),
        ),
        const SizedBox(height: AppSpacing.md),
        Wrap(
          spacing: AppSpacing.xs,
          runSpacing: AppSpacing.xs,
          children: [
            FilledButton.tonalIcon(
              onPressed: () =>
                  context.push('/practice/session?programme=ssc_hssc'),
              icon: const Icon(Icons.bolt_outlined, size: AppIconSize.sm),
              label: const Text('Daily 10-MCQ Board'),
            ),
            OutlinedButton.icon(
              onPressed: () =>
                  context.push('/practice/session?programme=mdcat'),
              icon: const Icon(
                Icons.medical_services_outlined,
                size: AppIconSize.sm,
              ),
              label: const Text('Daily MDCAT (Isolated)'),
            ),
          ],
        ),

        const StudyDivider(verticalPadding: AppSpacing.xl),

        // Recent Real Progress & Secondary Entrance Hub
        StudySectionHeader(
          title: 'Your Real Progress',
          subtitle: 'Computed strictly from verified local attempts',
          trailing: TextButton.icon(
            onPressed: () => showShareStudyCardSheet(
              context,
              kicker: '${profile.board.displayName} • ${profile.grade.label}',
              title: 'Roshan Study Progress Card',
              highlightMetric: report.verifiedAccuracy == null
                  ? '${dailyGoal.streakDays}-Day Streak'
                  : '${(report.verifiedAccuracy! * 100).round()}% Verified Accuracy',
              lines: [
                'Questions Practised: ${report.questionsAttempted}',
                'Today Goal: ${dailyGoal.questionsCompleted}/${profile.dailyQuestionTarget} Qs',
                'Topics Studied: ${report.topicsStudied}',
              ],
            ),
            icon: const Icon(Icons.share_outlined, size: AppIconSize.sm),
            label: const Text('Share Card'),
          ),
        ),
        const SizedBox(height: AppSpacing.sm),
        if (report.questionsAttempted == 0)
          Text(
            'No practice attempts recorded yet. Your accuracy and chapter mastery will appear once you complete questions.',
            style: theme.textTheme.bodyMedium,
          )
        else
          Row(
            children: [
              _HomeMetricColumn(
                label: 'Attempted',
                value: '${report.questionsAttempted}',
              ),
              _HomeMetricColumn(
                label: 'Accuracy',
                value: '${(report.verifiedAccuracy! * 100).round()}%',
              ),
              _HomeMetricColumn(
                label: 'Topics',
                value: '${report.topicsStudied}',
              ),
              _HomeMetricColumn(
                label: 'Due Review',
                value: '${report.dueRevisions.length}',
              ),
            ],
          ),

        const StudyDivider(verticalPadding: AppSpacing.xl),

        AcademicSurface(
          onTap: () => context.push('/admissions'),
          padding: const EdgeInsets.symmetric(
            horizontal: AppSpacing.md,
            vertical: AppSpacing.sm,
          ),
          child: Row(
            children: [
              Icon(
                Icons.school_outlined,
                color: theme.colorScheme.primary,
                size: AppIconSize.lg,
              ),
              const SizedBox(width: AppSpacing.sm),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      'MDCAT & ETEA Entrance Prep',
                      style: theme.textTheme.titleMedium,
                    ),
                    const SizedBox(height: 2),
                    Text(
                      'Kept strictly separate from Grades 9–12 board scores.',
                      style: theme.textTheme.bodySmall,
                    ),
                  ],
                ),
              ),
              const Icon(Icons.chevron_right),
            ],
          ),
        ),
      ],
    );
  }
}

class _HomeMetricColumn extends StatelessWidget {
  const _HomeMetricColumn({required this.label, required this.value});

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
            style: AppTypography.tabular(theme.textTheme.titleLarge),
          ),
          const SizedBox(height: 2),
          Text(label, style: theme.textTheme.bodySmall),
        ],
      ),
    );
  }
}
