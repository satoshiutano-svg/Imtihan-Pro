import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:roshan_study/app/theme/app_tokens.dart';
import 'package:roshan_study/core/constants/app_constants.dart';
import 'package:roshan_study/core/models/curriculum_models.dart';
import 'package:roshan_study/core/widgets/academic_surface.dart';
import 'package:roshan_study/core/widgets/share_study_card_sheet.dart';
import 'package:roshan_study/data/repositories/content_repository.dart';
import 'package:roshan_study/data/repositories/profile_repository.dart';

class ExamsScreen extends ConsumerStatefulWidget {
  const ExamsScreen({super.key});

  @override
  ConsumerState<ExamsScreen> createState() => _ExamsScreenState();
}

class _ExamsScreenState extends ConsumerState<ExamsScreen> {
  StudyGrade? _selectedGrade;
  QuestionType? _selectedType;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final profile = ref.watch(studentProfileProvider);
    final activeGrade = _selectedGrade ?? profile.grade;
    final contentRepo = ref.watch(contentRepositoryProvider);
    final mocks = contentRepo
        .getMocksForProgramme(ProgrammeId.sscHssc)
        .where((m) => m.grade == activeGrade.number)
        .toList(growable: false);

    final packs = contentRepo
        .getPacksForProgramme(ProgrammeId.sscHssc)
        .where((p) => p.grade == activeGrade.number)
        .toList(growable: false);

    final chapterQuestions = packs
        .expand((p) => p.questions)
        .where((q) {
          if (_selectedType == null) return true;
          if (_selectedType == QuestionType.shortAnswer) {
            return q.type == QuestionType.shortAnswer ||
                q.type == QuestionType.longAnswer;
          }
          return q.type == _selectedType;
        })
        .toList(growable: false);

    return StudyPageContainer(
      children: [
        StudySectionHeader(
          kicker: profile.board.displayName,
          title: 'KPK Board Exam Preparation',
          subtitle:
              'Official past-paper labels are shown only when verified; no question is guaranteed to appear.',
        ),
        const SizedBox(height: AppSpacing.sm),
        SegmentedButton<StudyGrade>(
          segments: StudyGrade.values
              .map(
                (g) => ButtonSegment(
                  value: g,
                  label: Text('G${g.number} ${g.isSsc ? "SSC" : "HSSC"}'),
                ),
              )
              .toList(growable: false),
          selected: {activeGrade},
          onSelectionChanged: (s) => setState(() => _selectedGrade = s.first),
        ),
        const StudyDivider(verticalPadding: AppSpacing.xl),
        StudySectionHeader(
          title: 'Chapter Tests & Timed Mocks',
          subtitle: 'Simulates real BISE pacing offline',
        ),
        const SizedBox(height: AppSpacing.sm),
        if (mocks.isEmpty)
          StudyEmptyState(
            icon: Icons.assignment_outlined,
            title: 'No timed mocks for ${activeGrade.label} yet',
            message:
                'Sample timed tests appear as chapters are published. Switch to Grade 9 or 10 above to try a timed paper right now.',
          )
        else
          AcademicSurface(
            padding: EdgeInsets.zero,
            child: Column(
              children: [
                for (int i = 0; i < mocks.length; i++) ...[
                  if (i > 0) const Divider(height: 1),
                  ListTile(
                    minTileHeight: 68,
                    title: Text(
                      mocks[i].title,
                      style: theme.textTheme.titleSmall,
                    ),
                    subtitle: Text(
                      '${mocks[i].durationMinutes} min • ${mocks[i].totalMarks} marks • ${mocks[i].sourceType.label}\n${mocks[i].paperStructureNote}',
                    ),
                    isThreeLine: true,
                    trailing: FilledButton(
                      onPressed: () =>
                          context.push('/exams/run/${mocks[i].id}'),
                      child: const Text('Start'),
                    ),
                  ),
                ],
              ],
            ),
          ),
        const StudyDivider(verticalPadding: AppSpacing.xl),
        StudySectionHeader(
          title: 'Chapter-Wise Solved Past Paper Browser',
          subtitle:
              'Filter solved board-pattern questions for ${activeGrade.label} across ${profile.board.displayName}.',
        ),
        const SizedBox(height: AppSpacing.sm),
        Wrap(
          spacing: AppSpacing.xs,
          runSpacing: AppSpacing.xs,
          children: [
            _FilterToggleButton(
              label: 'All Types',
              selected: _selectedType == null,
              onPressed: () => setState(() => _selectedType = null),
            ),
            _FilterToggleButton(
              label: 'MCQs',
              selected: _selectedType == QuestionType.mcq,
              onPressed: () =>
                  setState(() => _selectedType = QuestionType.mcq),
            ),
            _FilterToggleButton(
              label: '6-Step Numericals',
              selected: _selectedType == QuestionType.numerical,
              onPressed: () =>
                  setState(() => _selectedType = QuestionType.numerical),
            ),
            _FilterToggleButton(
              label: 'Short / Long',
              selected: _selectedType == QuestionType.shortAnswer,
              onPressed: () =>
                  setState(() => _selectedType = QuestionType.shortAnswer),
            ),
          ],
        ),
        const SizedBox(height: AppSpacing.sm),
        if (chapterQuestions.isEmpty)
          const StudyEmptyState(
            icon: Icons.filter_alt_off_outlined,
            title: 'No matching solved questions',
            message: 'Try clearing your question-type filter or choosing another grade.',
          )
        else
          AcademicSurface(
            padding: EdgeInsets.zero,
            child: Column(
              children: [
                for (int i = 0; i < chapterQuestions.take(12).length; i++) ...[
                  if (i > 0) const Divider(height: 1),
                  Builder(
                    builder: (context) {
                      final q = chapterQuestions[i];
                      return ExpansionTile(
                        tilePadding: const EdgeInsets.symmetric(
                          horizontal: AppSpacing.md,
                          vertical: AppSpacing.xxs,
                        ),
                        childrenPadding: const EdgeInsets.fromLTRB(
                          AppSpacing.md,
                          0,
                          AppSpacing.md,
                          AppSpacing.md,
                        ),
                        title: Text(q.statement, style: theme.textTheme.bodyLarge),
                        subtitle: StudyMetadataLine(
                          parts: [
                            q.type.label,
                            '${q.marks} mark${q.marks == 1 ? '' : 's'}',
                            q.sourceType.label,
                          ],
                        ),
                        children: [
                          Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              Text(
                                'Model Answer: ${q.correctAnswer}',
                                style: theme.textTheme.titleSmall,
                              ),
                              const SizedBox(height: AppSpacing.xxs),
                              Text(q.explanation, style: theme.textTheme.bodyMedium),
                              if (q.numericalSteps != null) ...[
                                const SizedBox(height: AppSpacing.xs),
                                Text('Given: ${q.numericalSteps!.given.join(", ")}'),
                                Text('Required: ${q.numericalSteps!.required}'),
                                Text('Formula: ${q.numericalSteps!.formula}'),
                                Text('Substitution: ${q.numericalSteps!.substitution}'),
                                Text('Calculation: ${q.numericalSteps!.calculation}'),
                                Text(
                                  'Answer: ${q.numericalSteps!.answerWithUnit}',
                                  style: theme.textTheme.labelLarge,
                                ),
                              ],
                              if (q.markingPoints.isNotEmpty) ...[
                                const SizedBox(height: AppSpacing.xs),
                                for (final pt in q.markingPoints) Text('• $pt'),
                              ],
                              const SizedBox(height: AppSpacing.sm),
                              OutlinedButton.icon(
                                onPressed: () => showShareStudyCardSheet(
                                  context,
                                  kicker:
                                      '${profile.board.displayName} • ${activeGrade.label}',
                                  title: q.statement,
                                  highlightMetric: 'Answer: ${q.correctAnswer}',
                                  lines: q.numericalSteps != null
                                      ? [
                                          'Formula: ${q.numericalSteps!.formula}',
                                          'Substitution: ${q.numericalSteps!.substitution}',
                                          'Answer: ${q.numericalSteps!.answerWithUnit}',
                                        ]
                                      : [q.explanation],
                                ),
                                icon: const Icon(
                                  Icons.share_outlined,
                                  size: AppIconSize.sm,
                                ),
                                label: const Text('Share Solution Card'),
                              ),
                            ],
                          ),
                        ],
                      );
                    },
                  ),
                ],
              ],
            ),
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
                      'Entrance Exams (Separate Track)',
                      style: theme.textTheme.titleMedium,
                    ),
                    const SizedBox(height: 2),
                    Text(
                      'MDCAT and ETEA Engineering admission prep are isolated from board scores.',
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

class _FilterToggleButton extends StatelessWidget {
  const _FilterToggleButton({
    required this.label,
    required this.selected,
    required this.onPressed,
  });

  final String label;
  final bool selected;
  final VoidCallback onPressed;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    return OutlinedButton(
      onPressed: onPressed,
      style: OutlinedButton.styleFrom(
        minimumSize: const Size(48, 40),
        backgroundColor:
            selected ? theme.colorScheme.primaryContainer : null,
        side: BorderSide(
          color: selected
              ? theme.colorScheme.primary
              : theme.colorScheme.outline,
        ),
      ),
      child: Text(label),
    );
  }
}
