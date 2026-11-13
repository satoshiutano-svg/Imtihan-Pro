import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:roshan_study/app/theme/app_tokens.dart';
import 'package:roshan_study/app/theme/app_typography.dart';
import 'package:roshan_study/core/models/curriculum_models.dart';
import 'package:roshan_study/core/widgets/academic_surface.dart';
import 'package:roshan_study/data/kpk_subject_catalog.dart';
import 'package:roshan_study/data/repositories/content_repository.dart';
import 'package:roshan_study/data/repositories/progress_repository.dart';

/// Phase 10: Architecturally isolated admission programmes (MDCAT & ETEA).
///
/// Never mixes entrance questions or scores into ordinary SSC/HSSC progress.
class AdmissionHubScreen extends ConsumerStatefulWidget {
  const AdmissionHubScreen({super.key});

  @override
  ConsumerState<AdmissionHubScreen> createState() => _AdmissionHubScreenState();
}

class _AdmissionHubScreenState extends ConsumerState<AdmissionHubScreen> {
  ProgrammeId _programme = ProgrammeId.mdcat;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final contentRepo = ref.watch(contentRepositoryProvider);
    final progressRepo = ref.watch(progressRepositoryProvider);

    final subjects = KpkSubjectCatalog.subjectsForProgramme(_programme);
    final packs = contentRepo.getPacksForProgramme(_programme);
    final mocks = contentRepo.getMocksForProgramme(_programme);
    final report = progressRepo.buildReport(programmeId: _programme);

    return Scaffold(
      appBar: AppBar(title: const Text('Admission Tests (Isolated)')),
      body: StudyPageContainer(
        children: [
          const StudySectionHeader(
            kicker: 'Isolated Track',
            title: 'Select Entrance Programme',
            subtitle:
                'Syllabus, question banks, timed mocks, and progress tracking are kept strictly separate from Grades 9–12 SSC/HSSC.',
          ),
          const SizedBox(height: AppSpacing.sm),
          SegmentedButton<ProgrammeId>(
            segments: const [
              ButtonSegment(
                value: ProgrammeId.mdcat,
                label: Text('MDCAT'),
              ),
              ButtonSegment(
                value: ProgrammeId.eteaEng,
                label: Text('ETEA Eng.'),
              ),
            ],
            selected: {_programme},
            onSelectionChanged: (s) => setState(() => _programme = s.first),
          ),

          const StudyDivider(verticalPadding: AppSpacing.xl),

          StudySectionHeader(
            title: '${_programme.label} Subjects & Topics',
          ),
          const SizedBox(height: AppSpacing.xxs),
          StudyMetadataLine(
            parts: subjects.map((s) => s.name).toList(),
            style: theme.textTheme.bodyMedium,
          ),
          const SizedBox(height: AppSpacing.sm),
          AcademicSurface(
            padding: EdgeInsets.zero,
            child: Column(
              children: [
                for (int i = 0; i < packs.length; i++) ...[
                  if (i > 0) const Divider(height: 1),
                  ListTile(
                    minTileHeight: 60,
                    title: Text(
                      packs[i].title,
                      style: theme.textTheme.titleSmall,
                    ),
                    subtitle: Text(
                      '${packs[i].questions.length} entrance questions',
                    ),
                    trailing: FilledButton(
                      onPressed: () => context.push(
                        '/practice/session?chapterId=${packs[i].chapterId}&programme=${_programme.id}',
                      ),
                      child: const Text('Practise'),
                    ),
                  ),
                ],
              ],
            ),
          ),

          const StudyDivider(verticalPadding: AppSpacing.xl),

          StudySectionHeader(
            title: 'Isolated Timed Mocks & Progress',
            subtitle:
                'Attempted in ${_programme.label}: ${report.questionsAttempted} • Accuracy: ${report.verifiedAccuracy == null ? '—' : '${(report.verifiedAccuracy! * 100).round()}%'}',
          ),
          const SizedBox(height: AppSpacing.sm),
          AcademicSurface(
            padding: EdgeInsets.zero,
            child: Column(
              children: [
                for (int i = 0; i < mocks.length; i++) ...[
                  if (i > 0) const Divider(height: 1),
                  ListTile(
                    minTileHeight: 64,
                    title: Text(
                      mocks[i].title,
                      style: theme.textTheme.titleSmall,
                    ),
                    subtitle: Text(mocks[i].paperStructureNote),
                    trailing: OutlinedButton(
                      onPressed: () =>
                          context.push('/exams/run/${mocks[i].id}'),
                      child: Text(
                        'Start',
                        style: AppTypography.tabular(theme.textTheme.labelLarge),
                      ),
                    ),
                  ),
                ],
              ],
            ),
          ),
        ],
      ),
    );
  }
}
