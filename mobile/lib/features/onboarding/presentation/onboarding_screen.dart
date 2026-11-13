import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:roshan_study/app/theme/app_tokens.dart';
import 'package:roshan_study/core/constants/app_constants.dart';
import 'package:roshan_study/core/models/curriculum_models.dart';
import 'package:roshan_study/core/widgets/academic_surface.dart';
import 'package:roshan_study/data/kpk_subject_catalog.dart';
import 'package:roshan_study/data/repositories/profile_repository.dart';

class OnboardingScreen extends ConsumerStatefulWidget {
  const OnboardingScreen({super.key});

  @override
  ConsumerState<OnboardingScreen> createState() => _OnboardingScreenState();
}

class _OnboardingScreenState extends ConsumerState<OnboardingScreen> {
  late KpkBoard _board;
  late StudyGrade _grade;
  late AcademicGroup _group;
  late Set<String> _electives;
  DateTime? _examDate;

  @override
  void initState() {
    super.initState();
    final current = ref.read(studentProfileProvider);
    _board = current.board;
    _grade = current.grade;
    _group = current.group;
    _electives = current.selectedElectiveIds.toSet();
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
      onboardingCompleted: true,
    );
    ref.read(studentProfileProvider.notifier).updateProfile(updated);
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
      appBar: AppBar(title: const Text('Academic Profile Setup')),
      body: StudyPageContainer(
        children: [
          const StudySectionHeader(
            kicker: 'Zero Account • Local First',
            title: '1. Select Your KPK BISE Board',
            subtitle: 'Used to match regional model papers and past-paper filters.',
          ),
          const SizedBox(height: AppSpacing.xs),
          DropdownButtonFormField<KpkBoard>(
            initialValue: _board,
            isExpanded: true,
            items: KpkBoard.values
                .map((b) => DropdownMenuItem(value: b, child: Text(b.displayName)))
                .toList(),
            onChanged: (b) {
              if (b != null) setState(() => _board = b);
            },
          ),
          const StudyDivider(verticalPadding: AppSpacing.lg),

          const StudySectionHeader(
            title: '2. Select Grade (English Medium)',
          ),
          const SizedBox(height: AppSpacing.xs),
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
          const StudyDivider(verticalPadding: AppSpacing.lg),

          const StudySectionHeader(
            title: '3. Select Academic Group',
          ),
          const SizedBox(height: AppSpacing.xs),
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
                  backgroundColor:
                      selected ? theme.colorScheme.primaryContainer : null,
                  side: BorderSide(
                    color: selected
                        ? theme.colorScheme.primary
                        : theme.colorScheme.outline,
                  ),
                ),
                child: Text(grp.displayName),
              );
            }).toList(),
          ),

          if (electives.isNotEmpty) ...[
            const StudyDivider(verticalPadding: AppSpacing.lg),
            const StudySectionHeader(
              title: '4. Select Elective Subject',
            ),
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
                    backgroundColor:
                        selected ? theme.colorScheme.primaryContainer : null,
                    side: BorderSide(
                      color: selected
                          ? theme.colorScheme.primary
                          : theme.colorScheme.outline,
                    ),
                  ),
                  child: Text(subj.name),
                );
              }).toList(),
            ),
          ],

          const StudyDivider(verticalPadding: AppSpacing.lg),
          const StudySectionHeader(
            title: '5. Board Exam Date (Optional)',
            subtitle: 'Only shown if you enter a real date. Never fabricated.',
          ),
          const SizedBox(height: AppSpacing.xs),
          Wrap(
            spacing: AppSpacing.xs,
            runSpacing: AppSpacing.xs,
            children: [
              OutlinedButton.icon(
                onPressed: _pickExamDate,
                icon: const Icon(Icons.event_outlined),
                label: Text(
                  _examDate == null
                      ? 'Set Exam Date'
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
            backgroundColor:
                theme.colorScheme.surfaceContainerHighest.withValues(alpha: 0.4),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  'Your ${previewSubjects.length} Subjects (${_grade.label})',
                  style: theme.textTheme.titleMedium,
                ),
                const SizedBox(height: AppSpacing.xs),
                StudyMetadataLine(
                  parts: previewSubjects.map((s) => s.name).toList(),
                  style: theme.textTheme.bodyMedium,
                ),
                const SizedBox(height: AppSpacing.md),
                SizedBox(
                  width: double.infinity,
                  child: FilledButton(
                    onPressed: _saveAndContinue,
                    child: const Text('Save & Start Studying Offline'),
                  ),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}
