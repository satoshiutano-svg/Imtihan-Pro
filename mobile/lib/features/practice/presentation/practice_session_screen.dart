import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:roshan_study/app/theme/app_tokens.dart';
import 'package:roshan_study/app/theme/app_typography.dart';
import 'package:roshan_study/core/models/curriculum_models.dart';
import 'package:roshan_study/core/utils/answer_matcher.dart';
import 'package:roshan_study/core/widgets/academic_surface.dart';
import 'package:roshan_study/core/widgets/share_study_card_sheet.dart';
import 'package:roshan_study/data/repositories/content_repository.dart';
import 'package:roshan_study/data/repositories/progress_repository.dart';

class PracticeSessionScreen extends ConsumerStatefulWidget {
  const PracticeSessionScreen({
    super.key,
    this.chapterId,
    this.conceptId,
    this.maxDifficulty = 7,
    this.programmeId = ProgrammeId.sscHssc,
  });

  final String? chapterId;
  final String? conceptId;
  final int maxDifficulty;
  final ProgrammeId programmeId;

  @override
  ConsumerState<PracticeSessionScreen> createState() =>
      _PracticeSessionScreenState();
}

class _PracticeSessionScreenState extends ConsumerState<PracticeSessionScreen> {
  late List<QuestionItem> _queue;
  int _index = 0;
  int _correctCount = 0;
  int _hintsRevealed = 0;
  bool _submitted = false;
  bool _isCorrect = false;
  String? _selectedOption;
  final TextEditingController _textController = TextEditingController();
  late Set<int> _checkedMarkingPoints;
  late DateTime _questionStartedAt;

  @override
  void initState() {
    super.initState();
    final repo = ref.read(contentRepositoryProvider);
    _queue = repo
        .getQuestions(
          programmeId: widget.programmeId,
          chapterId: widget.chapterId,
          conceptId: widget.conceptId,
          maxDifficulty: widget.maxDifficulty,
        )
        .toList();
    _checkedMarkingPoints = <int>{};
    _questionStartedAt = DateTime.now();
  }

  @override
  void dispose() {
    _textController.dispose();
    super.dispose();
  }

  QuestionItem? get _current =>
      _index < _queue.length ? _queue[_index] : null;

  void _submitObjectiveOrNumerical(QuestionItem q) {
    final userRaw = q.options.isNotEmpty
        ? (_selectedOption ?? '').trim()
        : _textController.text.trim();

    if (userRaw.isEmpty) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Please enter or select an answer first.')),
      );
      return;
    }

    final correct = AnswerMatcher.isMatch(
      userRaw: userRaw,
      expectedRaw: q.correctAnswer,
      type: q.type,
    );

    _recordOutcome(q, isCorrect: correct);
  }

  void _submitSelfCheckedWritten(QuestionItem q) {
    final hitCount = _checkedMarkingPoints.length;
    final totalPoints = q.markingPoints.length;
    final passed =
        totalPoints == 0 ? true : hitCount >= (totalPoints / 2).ceil();

    _recordOutcome(
      q,
      isCorrect: passed,
      selfScoreMarks: totalPoints == 0
          ? q.marks
          : ((hitCount / totalPoints) * q.marks).round(),
    );
  }

  void _recordOutcome(
    QuestionItem q, {
    required bool isCorrect,
    int? selfScoreMarks,
  }) {
    final elapsed = DateTime.now().difference(_questionStartedAt).inSeconds;
    ref.read(progressRepositoryProvider).recordAttempt(
          question: q,
          isCorrect: isCorrect,
          selfScoreMarks: selfScoreMarks,
          hintsUsed: _hintsRevealed,
          timeSpentSec: elapsed,
        );

    if (isCorrect) {
      _correctCount++;
    } else {
      // Wrong-answer remediation: queue another similar question if available
      final similar = ref
          .read(contentRepositoryProvider)
          .getQuestions(
            programmeId: q.programmeId,
            chapterId: q.chapterId,
          )
          .where(
            (candidate) =>
                candidate.id != q.id && !_queue.any((x) => x.id == candidate.id),
          )
          .firstOrNull;
      if (similar != null) {
        _queue.insert(_index + 1, similar);
      }
    }

    setState(() {
      _submitted = true;
      _isCorrect = isCorrect;
    });
  }

  void _nextQuestion() {
    setState(() {
      _index++;
      _hintsRevealed = 0;
      _submitted = false;
      _isCorrect = false;
      _selectedOption = null;
      _textController.clear();
      _checkedMarkingPoints.clear();
      _questionStartedAt = DateTime.now();
    });
  }

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);

    if (_queue.isEmpty) {
      return Scaffold(
        appBar: AppBar(title: const Text('Practice Session')),
        body: StudyPageContainer(
          children: [
            StudyEmptyState(
              icon: Icons.quiz_outlined,
              title: 'No matching questions found',
              message:
                  'Try raising your difficulty slider or selecting another chapter.',
              actionLabel: 'Back to Practice',
              onAction: () => context.pop(),
            ),
          ],
        ),
      );
    }

    final q = _current;

    if (q == null) {
      final pct = ((_correctCount / _queue.length) * 100).round();
      return Scaffold(
        appBar: AppBar(title: const Text('Practice Complete')),
        body: StudyPageContainer(
          children: [
            StudyFeedbackBanner(
              kind: StudyFeedbackKind.success,
              title: 'Session Finished — $_correctCount/${_queue.length} ($pct%)',
              message:
                  'All attempts were saved locally to your progress and spaced-revision schedule.',
            ),
            const SizedBox(height: AppSpacing.lg),
            Wrap(
              spacing: AppSpacing.xs,
              runSpacing: AppSpacing.xs,
              children: [
                FilledButton(
                  onPressed: () => context.pop(),
                  child: const Text('Done'),
                ),
                OutlinedButton.icon(
                  onPressed: () => showShareStudyCardSheet(
                    context,
                    kicker: widget.programmeId == ProgrammeId.mdcat
                        ? 'MDCAT Practice'
                        : 'KPK Board Practice',
                    title: 'Practice Session Completed',
                    highlightMetric: '$_correctCount/${_queue.length} ($pct%)',
                    lines: [
                      'Questions completed: ${_queue.length}',
                      'Saved offline to spaced-revision schedule.',
                    ],
                  ),
                  icon: const Icon(Icons.share_outlined, size: AppIconSize.sm),
                  label: const Text('Share Result Card'),
                ),
              ],
            ),
          ],
        ),
      );
    }

    final misconception = _selectedOption != null
        ? q.optionMisconceptions[_selectedOption!]
        : null;

    return Scaffold(
      appBar: AppBar(
        title: Text('Question ${_index + 1} of ${_queue.length}'),
      ),
      body: StudyPageContainer(
        children: [
          LinearProgressIndicator(value: (_index + 1) / _queue.length),
          const SizedBox(height: AppSpacing.md),

          // Quiet unboxed metadata line replacing Chip clutter
          StudyMetadataLine(
            parts: [
              q.difficultyLabel,
              q.type.label,
              q.sourceType.label,
              '${q.marks} mark${q.marks == 1 ? '' : 's'}',
            ],
          ),
          const SizedBox(height: AppSpacing.xs),
          Text(q.statement, style: theme.textTheme.titleLarge),
          const SizedBox(height: AppSpacing.md),

          // Progressive hints (before submission)
          if (!_submitted && q.hints.isNotEmpty) ...[
            if (_hintsRevealed > 0) ...[
              AcademicSurface(
                backgroundColor: theme.colorScheme.surfaceContainerHighest
                    .withValues(alpha: 0.55),
                padding: const EdgeInsets.all(AppSpacing.sm),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    for (int i = 0; i < _hintsRevealed; i++)
                      Padding(
                        padding: EdgeInsets.only(
                          bottom: i + 1 < _hintsRevealed ? AppSpacing.xxs : 0,
                        ),
                        child: Text(
                          'Hint ${i + 1}: ${q.hints[i]}',
                          style: theme.textTheme.bodyMedium,
                        ),
                      ),
                  ],
                ),
              ),
              const SizedBox(height: AppSpacing.xs),
            ],
            if (_hintsRevealed < q.hints.length)
              Align(
                alignment: Alignment.centerLeft,
                child: TextButton.icon(
                  onPressed: () => setState(() => _hintsRevealed++),
                  icon: const Icon(Icons.lightbulb_outline, size: AppIconSize.sm),
                  label: Text(
                    'Show Hint (${_hintsRevealed + 1}/${q.hints.length})',
                  ),
                ),
              ),
            const SizedBox(height: AppSpacing.sm),
          ],

          // Input UI per Question Type
          if (q.options.isNotEmpty)
            for (final opt in q.options)
              Padding(
                padding: const EdgeInsets.only(bottom: AppSpacing.xs),
                child: AcademicSurface(
                  padding: const EdgeInsets.symmetric(
                    horizontal: AppSpacing.sm,
                    vertical: AppSpacing.xs,
                  ),
                  backgroundColor: _selectedOption == opt
                      ? theme.colorScheme.primaryContainer
                          .withValues(alpha: 0.4)
                      : null,
                  borderColor: _selectedOption == opt
                      ? theme.colorScheme.primary
                      : theme.colorScheme.outline,
                  onTap: _submitted
                      ? null
                      : () => setState(() => _selectedOption = opt),
                  child: ConstrainedBox(
                    constraints: const BoxConstraints(
                      minHeight: AppTouchTarget.min - 16,
                    ),
                    child: Row(
                      children: [
                        Icon(
                          _selectedOption == opt
                              ? Icons.radio_button_checked
                              : Icons.radio_button_unchecked,
                          size: AppIconSize.md,
                          color: _selectedOption == opt
                              ? theme.colorScheme.primary
                              : theme.colorScheme.onSurfaceVariant,
                        ),
                        const SizedBox(width: AppSpacing.sm),
                        Expanded(
                          child: Text(opt, style: theme.textTheme.bodyLarge),
                        ),
                      ],
                    ),
                  ),
                ),
              )
          else if (q.isSelfCheckedWritten) ...[
            Text(
              'Write your answer on paper first (${q.marks} marks), then reveal the model answer and marking points to self-check honestly.',
              style: theme.textTheme.bodyMedium,
            ),
            const SizedBox(height: AppSpacing.sm),
            if (_submitted || _hintsRevealed > 0) ...[
              AcademicSurface(
                backgroundColor: theme.colorScheme.surfaceContainerHighest
                    .withValues(alpha: 0.45),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text('Model Answer', style: theme.textTheme.titleSmall),
                    const SizedBox(height: AppSpacing.xxs),
                    Text(q.correctAnswer, style: theme.textTheme.bodyLarge),
                    const StudyDivider(verticalPadding: AppSpacing.sm),
                    Text(
                      'Marking Points Checklist',
                      style: theme.textTheme.titleSmall,
                    ),
                    const SizedBox(height: AppSpacing.xxs),
                    for (int i = 0; i < q.markingPoints.length; i++)
                      CheckboxListTile(
                        contentPadding: EdgeInsets.zero,
                        controlAffinity: ListTileControlAffinity.leading,
                        value: _checkedMarkingPoints.contains(i),
                        title: Text(q.markingPoints[i]),
                        onChanged: _submitted
                            ? null
                            : (checked) {
                                setState(() {
                                  if (checked == true) {
                                    _checkedMarkingPoints.add(i);
                                  } else {
                                    _checkedMarkingPoints.remove(i);
                                  }
                                });
                              },
                      ),
                  ],
                ),
              ),
            ],
          ] else ...[
            TextField(
              controller: _textController,
              enabled: !_submitted,
              decoration: InputDecoration(
                labelText: q.type == QuestionType.numerical
                    ? 'Numerical answer with unit (e.g. 54 m)'
                    : 'Type your answer',
              ),
            ),
          ],

          const SizedBox(height: AppSpacing.md),
          if (!_submitted)
            SizedBox(
              width: double.infinity,
              child: q.isSelfCheckedWritten && _hintsRevealed == 0
                  ? FilledButton(
                      onPressed: () => setState(() => _hintsRevealed = 1),
                      child: const Text('Reveal Model Answer & Check Points'),
                    )
                  : FilledButton(
                      onPressed: () => q.isSelfCheckedWritten
                          ? _submitSelfCheckedWritten(q)
                          : _submitObjectiveOrNumerical(q),
                      child: const Text('Submit Answer'),
                    ),
            ),

          // Post-Attempt Feedback & Mistake Remediation
          if (_submitted) ...[
            const StudyDivider(verticalPadding: AppSpacing.lg),
            StudyFeedbackBanner(
              kind: _isCorrect
                  ? StudyFeedbackKind.success
                  : StudyFeedbackKind.error,
              title: _isCorrect
                  ? 'Correct — scheduled for your next spaced revision'
                  : 'Incorrect — scheduled for 1-day spaced revision',
              message: !_isCorrect && misconception != null
                  ? 'Why your choice is incorrect: $misconception'
                  : null,
            ),
            const SizedBox(height: AppSpacing.md),
            Text(
              'Correct Answer: ${q.correctAnswer}',
              style: theme.textTheme.titleSmall,
            ),
            const SizedBox(height: AppSpacing.xxs),
            Text(q.explanation, style: theme.textTheme.bodyMedium),
            if (q.numericalSteps != null) ...[
              const SizedBox(height: AppSpacing.md),
              AcademicSurface(
                backgroundColor: theme.colorScheme.surfaceContainerHighest
                    .withValues(alpha: 0.45),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      '6-Step Numerical Solution',
                      style: theme.textTheme.titleSmall,
                    ),
                    const SizedBox(height: AppSpacing.xs),
                    Text('1. Given: ${q.numericalSteps!.given.join(", ")}'),
                    Text('2. Required: ${q.numericalSteps!.required}'),
                    Text(
                      '3. Formula: ${q.numericalSteps!.formula}',
                      style: AppTypography.tabular(theme.textTheme.bodyMedium),
                    ),
                    Text(
                      '4. Substitution: ${q.numericalSteps!.substitution}',
                      style: AppTypography.tabular(theme.textTheme.bodyMedium),
                    ),
                    Text(
                      '5. Calculation: ${q.numericalSteps!.calculation}',
                      style: AppTypography.tabular(theme.textTheme.bodyMedium),
                    ),
                    const SizedBox(height: AppSpacing.xxs),
                    Text(
                      '6. Answer: ${q.numericalSteps!.answerWithUnit}',
                      style: AppTypography.tabular(
                        theme.textTheme.labelLarge,
                        color: theme.colorScheme.primary,
                      ),
                    ),
                  ],
                ),
              ),
            ],
            const SizedBox(height: AppSpacing.lg),
            Wrap(
              spacing: AppSpacing.xs,
              runSpacing: AppSpacing.xs,
              children: [
                if (!_isCorrect)
                  OutlinedButton.icon(
                    onPressed: () => context.push(
                      '/learn/chapter/${q.chapterId}/concept/${q.conceptId}',
                    ),
                    icon: const Icon(Icons.menu_book_outlined),
                    label: const Text('Review Concept'),
                  ),
                FilledButton(
                  onPressed: _nextQuestion,
                  child: Text(
                    _index + 1 < _queue.length
                        ? 'Next Question'
                        : 'Finish Session',
                  ),
                ),
              ],
            ),
          ],
        ],
      ),
    );
  }
}
