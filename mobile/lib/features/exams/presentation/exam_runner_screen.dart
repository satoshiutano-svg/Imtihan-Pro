import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:roshan_study/app/theme/app_tokens.dart';
import 'package:roshan_study/app/theme/app_typography.dart';
import 'package:roshan_study/core/models/curriculum_models.dart';
import 'package:roshan_study/core/utils/answer_matcher.dart';
import 'package:roshan_study/core/widgets/academic_surface.dart';
import 'package:roshan_study/core/widgets/math_text.dart';
import 'package:roshan_study/data/repositories/content_repository.dart';
import 'package:roshan_study/data/repositories/profile_repository.dart';
import 'package:roshan_study/data/repositories/progress_repository.dart';

class ExamRunnerScreen extends ConsumerStatefulWidget {
  const ExamRunnerScreen({super.key, required this.examId});

  final String examId;

  @override
  ConsumerState<ExamRunnerScreen> createState() => _ExamRunnerScreenState();
}

class _ExamRunnerScreenState extends ConsumerState<ExamRunnerScreen> {
  MockExamDefinition? _exam;
  List<QuestionItem> _questions = const [];
  final Map<String, String> _answers = {};
  final Map<String, int> _selfMarks = {};
  Timer? _timer;
  int _remainingSeconds = 0;
  int _totalSeconds = 0;
  bool _submitted = false;
  int _finalScore = 0;

  @override
  void initState() {
    super.initState();
    final repo = ref.read(contentRepositoryProvider);
    for (final prog in ProgrammeId.values) {
      final found = repo
          .getMocksForProgramme(prog)
          .where((m) => m.id == widget.examId)
          .firstOrNull;
      if (found != null) {
        _exam = found;
        break;
      }
    }
    if (_exam != null) {
      _questions = _exam!.questionIds
          .map(repo.getQuestionById)
          .whereType<QuestionItem>()
          .toList(growable: false);
      _totalSeconds = _exam!.durationMinutes * 60;
      _remainingSeconds = _totalSeconds;
      _timer = Timer.periodic(const Duration(seconds: 1), (_) {
        if (!mounted || _submitted) return;
        if (_remainingSeconds <= 1) {
          _submitExam();
        } else {
          setState(() => _remainingSeconds--);
        }
      });
    }
  }

  @override
  void dispose() {
    _timer?.cancel();
    super.dispose();
  }

  void _submitExam() {
    final exam = _exam;
    if (exam == null || _submitted) return;
    _timer?.cancel();

    int total = 0;
    final progressRepo = ref.read(progressRepositoryProvider);
    final profile = ref.read(studentProfileProvider);

    for (final q in _questions) {
      if (q.isSelfCheckedWritten) {
        final marks = _selfMarks[q.id] ?? 0;
        total += marks;
        progressRepo.recordAttempt(
          question: q,
          isCorrect: marks >= (q.marks / 2).ceil(),
          selfScoreMarks: marks,
        );
      } else {
        final ok = AnswerMatcher.isMatch(
          userRaw: _answers[q.id] ?? '',
          expectedRaw: q.correctAnswer,
          type: q.type,
        );
        if (ok) total += q.marks;
        progressRepo.recordAttempt(question: q, isCorrect: ok);
      }
    }

    progressRepo.saveMockExamResult(
      exam: exam,
      boardId: profile.board.id,
      score: total,
      maxScore: exam.totalMarks,
      durationSec: _totalSeconds - _remainingSeconds,
    );

    setState(() {
      _submitted = true;
      _finalScore = total;
    });
  }

  String _formatClock(int seconds) {
    final m = (seconds ~/ 60).toString().padLeft(2, '0');
    final s = (seconds % 60).toString().padLeft(2, '0');
    return '$m:$s';
  }

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final exam = _exam;
    if (exam == null) {
      return Scaffold(
        appBar: AppBar(title: const Text('Mock Exam')),
        body: const StudyPageContainer(
          children: [
            StudyEmptyState(
              icon: Icons.assignment_late_outlined,
              title: 'Exam paper not found',
              message: 'Please select an available mock paper from Board Exams.',
            ),
          ],
        ),
      );
    }

    return Scaffold(
      appBar: AppBar(
        title: Text(exam.title, overflow: TextOverflow.ellipsis),
        actions: [
          Center(
            child: Padding(
              padding: const EdgeInsets.symmetric(horizontal: AppSpacing.md),
              child: Text(
                _formatClock(_remainingSeconds),
                style: AppTypography.tabular(
                  theme.textTheme.titleMedium,
                  color: _remainingSeconds < 60
                      ? theme.colorScheme.error
                      : theme.colorScheme.primary,
                ),
              ),
            ),
          ),
        ],
      ),
      body: StudyPageContainer(
        children: [
          if (_submitted) ...[
            StudyFeedbackBanner(
              kind: StudyFeedbackKind.success,
              title: 'Exam Completed: $_finalScore / ${exam.totalMarks} marks',
              message:
                  'Written answers reflect your honest marking-point self-check. Saved locally.',
            ),
            const SizedBox(height: AppSpacing.md),
            SizedBox(
              width: double.infinity,
              child: FilledButton(
                onPressed: () => context.pop(),
                child: const Text('Back to Board Exams'),
              ),
            ),
            const StudyDivider(verticalPadding: AppSpacing.xl),
          ],
          for (int idx = 0; idx < _questions.length; idx++) ...[
            if (idx > 0) const StudyDivider(verticalPadding: AppSpacing.lg),
            Builder(
              builder: (context) {
                final q = _questions[idx];
                return Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    StudyMetadataLine(
                      parts: [
                        'Q${idx + 1}',
                        '${q.marks} mark${q.marks == 1 ? '' : 's'}',
                        q.type.label,
                      ],
                      style: theme.textTheme.labelMedium?.copyWith(
                        color: theme.colorScheme.primary,
                      ),
                    ),
                    const SizedBox(height: AppSpacing.xxs),
                    MathText(q.statement, style: theme.textTheme.titleMedium),
                    const SizedBox(height: AppSpacing.sm),
                    if (q.options.isNotEmpty)
                      for (final opt in q.options)
                        Padding(
                          padding: const EdgeInsets.only(bottom: AppSpacing.xs),
                          child: AcademicSurface(
                            padding: const EdgeInsets.symmetric(
                              horizontal: AppSpacing.sm,
                              vertical: AppSpacing.xs,
                            ),
                            backgroundColor: _answers[q.id] == opt
                                ? theme.colorScheme.primaryContainer
                                    .withValues(alpha: 0.4)
                                : null,
                            borderColor: _answers[q.id] == opt
                                ? theme.colorScheme.primary
                                : theme.colorScheme.outline,
                            onTap: _submitted
                                ? null
                                : () => setState(() => _answers[q.id] = opt),
                            child: Row(
                              children: [
                                Icon(
                                  _answers[q.id] == opt
                                      ? Icons.radio_button_checked
                                      : Icons.radio_button_unchecked,
                                  size: AppIconSize.md,
                                  color: _answers[q.id] == opt
                                      ? theme.colorScheme.primary
                                      : theme.colorScheme.onSurfaceVariant,
                                ),
                                const SizedBox(width: AppSpacing.sm),
                                Expanded(
                                  child: MathText(
                                    opt,
                                    style: theme.textTheme.bodyLarge,
                                  ),
                                ),
                              ],
                            ),
                          ),
                        )
                    else if (q.isSelfCheckedWritten) ...[
                      Text(
                        'Model Answer: ${q.correctAnswer}',
                        style: theme.textTheme.bodyMedium,
                      ),
                      const SizedBox(height: AppSpacing.xs),
                      Text(
                        'Self-assessed marks (0–${q.marks}): ${_selfMarks[q.id] ?? 0}',
                        style: AppTypography.tabular(theme.textTheme.labelLarge),
                      ),
                      Slider(
                        value: (_selfMarks[q.id] ?? 0)
                            .clamp(0, q.marks > 0 ? q.marks : 1)
                            .toDouble(),
                        min: 0,
                        max: (q.marks > 0 ? q.marks : 1).toDouble(),
                        divisions: q.marks > 0 ? q.marks : 1,
                        onChanged: _submitted
                            ? null
                            : (v) =>
                                setState(() => _selfMarks[q.id] = v.round()),
                      ),
                    ] else
                      TextField(
                        enabled: !_submitted,
                        decoration: const InputDecoration(labelText: 'Answer'),
                        onChanged: (v) => _answers[q.id] = v,
                      ),
                    if (_submitted) ...[
                      const SizedBox(height: AppSpacing.xs),
                      MathText(
                        'Answer Key: ${q.correctAnswer}',
                        style: theme.textTheme.labelLarge,
                      ),
                      const SizedBox(height: AppSpacing.xxs),
                      MathText(q.explanation, style: theme.textTheme.bodySmall),
                    ],
                  ],
                );
              },
            ),
          ],
          if (!_submitted) ...[
            const SizedBox(height: AppSpacing.xl),
            SizedBox(
              width: double.infinity,
              child: FilledButton(
                onPressed: _submitExam,
                child: const Text('Submit Timed Examination'),
              ),
            ),
          ],
        ],
      ),
    );
  }
}
