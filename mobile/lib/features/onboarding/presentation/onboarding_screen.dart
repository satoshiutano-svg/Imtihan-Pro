import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:roshan_study/app/theme/app_tokens.dart';
import 'package:roshan_study/core/constants/app_constants.dart';
import 'package:roshan_study/core/models/curriculum_models.dart';
import 'package:roshan_study/core/widgets/academic_surface.dart';
import 'package:roshan_study/core/widgets/motion_system.dart';
import 'package:roshan_study/data/kpk_subject_catalog.dart';
import 'package:roshan_study/data/repositories/profile_repository.dart';

class OnboardingScreen extends ConsumerStatefulWidget {
  const OnboardingScreen({super.key});

  @override
  ConsumerState<OnboardingScreen> createState() => _OnboardingScreenState();
}

class _OnboardingScreenState extends ConsumerState<OnboardingScreen> {
  static const int _totalSteps = 5;
  static const List<int> _dailyGoalOptions = [5, 10, 15, 20];

  int _step = 0;
  late KpkBoard _board;
  late StudyGrade _grade;
  late AcademicGroup _group;
  late Set<String> _electives;
  late int _dailyQuestionTarget;
  DateTime? _examDate;

  @override
  void initState() {
    super.initState();
    final current = ref.read(studentProfileProvider);
    _board = current.board;
    _grade = current.grade;
    _group = current.group;
    _electives = current.selectedElectiveIds.toSet();
    _dailyQuestionTarget = current.dailyQuestionTarget;
    _examDate = current.examDate;
    _syncDefaultElectives();
  }

  void _syncDefaultElectives() {
    final options = KpkSubjectCatalog.availableElectives(
      grade: _grade,
      group: _group,
    );
    final validIds = options.map((o) => o.id).toSet();
    _electives = _electives.where(validIds.contains).toSet();
    if (_electives.isEmpty && options.isNotEmpty) {
      _electives.add(options.first.id);
    }
  }

  Future<void> _pickExamDate() async {
    final now = DateTime.now();
    final picked = await showDatePicker(
      context: context,
      initialDate: _examDate ?? now.add(const Duration(days: 60)),
      firstDate: now,
      lastDate: now.add(const Duration(days: 540)),
    );
    if (picked != null) {
      setState(() => _examDate = picked);
    }
  }

  void _saveAndContinue() {
    final current = ref.read(studentProfileProvider);
    final updated = current.copyWith(
      board: _board,
      grade: _grade,
      group: _group,
      selectedElectiveIds: _electives.toList(growable: false),
      examDateIso: _examDate?.toIso8601String(),
      clearExamDate: _examDate == null,
      dailyQuestionTarget: _dailyQuestionTarget,
      onboardingCompleted: true,
    );
    ref.read(studentProfileProvider.notifier).updateProfile(updated);
    if (context.canPop()) {
      context.pop();
    } else {
      context.go('/home');
    }
  }

  void _skipSetup() {
    final current = ref.read(studentProfileProvider);
    ref.read(studentProfileProvider.notifier).updateProfile(
          current.copyWith(onboardingCompleted: true),
        );
    if (context.canPop()) {
      context.pop();
    } else {
      context.go('/home');
    }
  }

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final groups = AcademicGroup.forGrade(_grade);
    final electives = KpkSubjectCatalog.availableElectives(
      grade: _grade,
      group: _group,
    );
    final previewSubjects = KpkSubjectCatalog.subjectsForProfile(
      grade: _grade,
      group: _group,
      selectedElectiveIds: _electives.toList(growable: false),
    );

    return Scaffold(
      appBar: AppBar(
        title: const Text('Study Setup'),
        actions: [
          TextButton(
            onPressed: _skipSetup,
            child: const Text('Skip to Study'),
          ),
        ],
      ),
      body: StudyPageContainer(
        children: [
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Text(
                'Step ${_step + 1} of $_totalSteps',
                style: theme.textTheme.labelLarge?.copyWith(
                  color: theme.colorScheme.primary,
                ),
              ),
              Text(
                'Zero Account • Offline-First',
                style: theme.textTheme.bodySmall,
              ),
            ],
          ),
          const SizedBox(height: AppSpacing.xs),
          AnimatedProgressTrack(value: (_step + 1) / _totalSteps),
          const SizedBox(height: AppSpacing.lg),

          MotionEntrance(
            key: ValueKey(_step),
            child: switch (_step) {
              0 => Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    const StudySectionHeader(
                      kicker: 'Roshan Study • KPK BISE',
                      title: 'Welcome to Focused Board Preparation',
                      subtitle:
                          'Built for Grades 9–12 English medium across all 8 KPK boards — no login, no ads while reading or testing, and 100% offline once downloaded.',
                    ),
                    const SizedBox(height: AppSpacing.md),
                    AcademicSurface(
                      backgroundColor: theme.colorScheme.primaryContainer
                          .withValues(alpha: 0.28),
                      child: const Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text('1. Understand concepts step-by-step with visuals & Urdu term help'),
                          SizedBox(height: AppSpacing.xs),
                          Text('2. Practise with instant feedback & 6-step solved numericals'),
                          SizedBox(height: AppSpacing.xs),
                          Text('3. Revise automatically on a 1d → 3d → 7d schedule'),
                        ],
                      ),
                    ),
                  ],
                ),
              1 => Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    const StudySectionHeader(
                      title: 'Select Your KPK BISE Board',
                      subtitle:
                          'Matches regional past-paper filters and board exam templates.',
                    ),
                    const SizedBox(height: AppSpacing.sm),
                    DropdownButtonFormField<KpkBoard>(
                      initialValue: _board,
                      isExpanded: true,
                      items: KpkBoard.values
                          .map(
                            (b) => DropdownMenuItem(
                              value: b,
                              child: Text(b.displayName),
                            ),
                          )
                          .toList(growable: false),
                      onChanged: (b) {
                        if (b != null) setState(() => _board = b);
                      },
                    ),
                  ],
                ),
              2 => Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    const StudySectionHeader(
                      title: 'Select Grade (English Medium)',
                      subtitle: 'You can switch or revisit any grade anytime.',
                    ),
                    const SizedBox(height: AppSpacing.sm),
                    SegmentedButton<StudyGrade>(
                      segments: StudyGrade.values
                          .map(
                            (g) => ButtonSegment(
                              value: g,
                              label: Text('G${g.number}'),
                            ),
                          )
                          .toList(growable: false),
                      selected: {_grade},
                      onSelectionChanged: (s) {
                        final g = s.first;
                        setState(() {
                          _grade = g;
                          final validGroups = AcademicGroup.forGrade(g);
                          if (!validGroups.contains(_group)) {
                            _group = validGroups.first;
                          }
                          _syncDefaultElectives();
                        });
                      },
                    ),
                  ],
                ),
              3 => Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    const StudySectionHeader(
                      title: 'Academic Group & Elective Subject',
                      subtitle: 'Filters your library and board exam blueprints.',
                    ),
                    const SizedBox(height: AppSpacing.sm),
                    Wrap(
                      spacing: AppSpacing.xs,
                      runSpacing: AppSpacing.xs,
                      children: groups.map((grp) {
                        final selected = _group == grp;
                        return OutlinedButton(
                          onPressed: () {
                            setState(() {
                              _group = grp;
                              _syncDefaultElectives();
                            });
                          },
                          style: OutlinedButton.styleFrom(
                            backgroundColor: selected
                                ? theme.colorScheme.primaryContainer
                                : null,
                            side: BorderSide(
                              color: selected
                                  ? theme.colorScheme.primary
                                  : theme.colorScheme.outline,
                            ),
                          ),
                          child: Text(grp.displayName),
                        );
                      }).toList(growable: false),
                    ),
                    if (electives.isNotEmpty) ...[
                      const StudyDivider(verticalPadding: AppSpacing.lg),
                      const StudySectionHeader(title: 'Select Elective Subject'),
                      const SizedBox(height: AppSpacing.xs),
                      Wrap(
                        spacing: AppSpacing.xs,
                        runSpacing: AppSpacing.xs,
                        children: electives.map((SubjectDefinition subj) {
                          final selected = _electives.contains(subj.id);
                          return OutlinedButton(
                            onPressed: () {
                              setState(() {
                                _electives
                                  ..clear()
                                  ..add(subj.id);
                              });
                            },
                            style: OutlinedButton.styleFrom(
                              backgroundColor: selected
                                  ? theme.colorScheme.primaryContainer
                                  : null,
                              side: BorderSide(
                                color: selected
                                    ? theme.colorScheme.primary
                                    : theme.colorScheme.outline,
                              ),
                            ),
                            child: Text(subj.name),
                          );
                        }).toList(growable: false),
                      ),
                    ],
                  ],
                ),
              _ => Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    const StudySectionHeader(
                      title: 'Daily Study Goal & Exam Date',
                      subtitle:
                          'Set a realistic daily question target. Streak includes 2 grace freezes for load-shedding days.',
                    ),
                    const SizedBox(height: AppSpacing.sm),
                    Wrap(
                      spacing: AppSpacing.xs,
                      runSpacing: AppSpacing.xs,
                      children: _dailyGoalOptions.map((target) {
                        final selected = _dailyQuestionTarget == target;
                        return OutlinedButton(
                          onPressed: () =>
                              setState(() => _dailyQuestionTarget = target),
                          style: OutlinedButton.styleFrom(
                            backgroundColor: selected
                                ? theme.colorScheme.primaryContainer
                                : null,
                            side: BorderSide(
                              color: selected
                                  ? theme.colorScheme.primary
                                  : theme.colorScheme.outline,
                            ),
                          ),
                          child: Text('$target Qs / day'),
                        );
                      }).toList(growable: false),
                    ),
                    const SizedBox(height: AppSpacing.md),
                    Wrap(
                      spacing: AppSpacing.xs,
                      runSpacing: AppSpacing.xs,
                      children: [
                        OutlinedButton.icon(
                          onPressed: _pickExamDate,
                          icon: const Icon(Icons.event_outlined),
                          label: Text(
                            _examDate == null
                                ? 'Set Board Exam Date (Optional)'
                                : '${_examDate!.year}-${_examDate!.month.toString().padLeft(2, '0')}-${_examDate!.day.toString().padLeft(2, '0')}',
                          ),
                        ),
                        if (_examDate != null)
                          TextButton(
                            onPressed: () => setState(() => _examDate = null),
                            child: const Text('Clear Date'),
                          ),
                      ],
                    ),
                    const StudyDivider(verticalPadding: AppSpacing.lg),
                    AcademicSurface(
                      backgroundColor: theme.colorScheme.surfaceContainerHighest
                          .withValues(alpha: 0.4),
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(
                            'Your ${previewSubjects.length} Subjects (${_grade.label} • ${_board.displayName})',
                            style: theme.textTheme.titleMedium,
                          ),
                          const SizedBox(height: AppSpacing.xs),
                          StudyMetadataLine(
                            parts: previewSubjects
                                .map((s) => s.name)
                                .toList(growable: false),
                            style: theme.textTheme.bodyMedium,
                          ),
                        ],
                      ),
                    ),
                  ],
                ),
            },
          ),

          const SizedBox(height: AppSpacing.xl),
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              if (_step > 0)
                OutlinedButton(
                  onPressed: () => setState(() => _step--),
                  child: const Text('Back'),
                )
              else
                const SizedBox.shrink(),
              if (_step < _totalSteps - 1)
                FilledButton(
                  onPressed: () => setState(() => _step++),
                  child: Text(_step == 0 ? 'Get Started' : 'Next'),
                )
              else
                FilledButton(
                  onPressed: _saveAndContinue,
                  child: const Text('Save & Start Studying Offline'),
                ),
            ],
          ),
        ],
      ),
    );
  }
}
