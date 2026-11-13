import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_svg/flutter_svg.dart';
import 'package:go_router/go_router.dart';
import 'package:roshan_study/app/theme/app_colors.dart';
import 'package:roshan_study/app/theme/app_tokens.dart';
import 'package:roshan_study/app/theme/app_typography.dart';
import 'package:roshan_study/app/theme/display_preferences_controller.dart';
import 'package:roshan_study/core/models/curriculum_models.dart';
import 'package:roshan_study/core/widgets/academic_surface.dart';
import 'package:roshan_study/core/widgets/rtl_aware_text.dart';
import 'package:roshan_study/data/repositories/content_repository.dart';

class ConceptReaderScreen extends ConsumerStatefulWidget {
  const ConceptReaderScreen({
    super.key,
    required this.chapterId,
    required this.conceptId,
  });

  final String chapterId;
  final String conceptId;

  @override
  ConsumerState<ConceptReaderScreen> createState() =>
      _ConceptReaderScreenState();
}

class _ConceptReaderScreenState extends ConsumerState<ConceptReaderScreen> {
  late final ScrollController _scrollController;
  bool _isBookmarked = false;
  bool _isCompleted = false;
  bool _guidedMode = false;
  int _microStep = 0;
  String? _microAnswer;
  int? _expandedGlossaryIndex;

  @override
  void initState() {
    super.initState();
    final repo = ref.read(contentRepositoryProvider);
    final saved = repo.getReadingProgress(widget.conceptId);
    _isBookmarked = saved?.isBookmarked ?? false;
    _isCompleted = saved?.isCompleted ?? false;
    _scrollController = ScrollController(
      initialScrollOffset: saved?.scrollOffset ?? 0.0,
    );

    final concept = repo.getConceptById(widget.conceptId);
    if (concept != null && concept.microCards.isNotEmpty) {
      _guidedMode = true;
    }
  }

  @override
  void dispose() {
    _persistPosition();
    _scrollController.dispose();
    super.dispose();
  }

  void _persistPosition({bool? completed, bool? bookmarked}) {
    final concept =
        ref.read(contentRepositoryProvider).getConceptById(widget.conceptId);
    final pack =
        ref.read(contentRepositoryProvider).getPackById(widget.chapterId);
    if (concept == null || pack == null) return;

    final offset =
        _scrollController.hasClients ? _scrollController.offset : 0.0;
    ref.read(contentRepositoryProvider).saveReadingProgress(
          conceptId: concept.id,
          chapterId: pack.chapterId,
          subjectId: pack.subjectId,
          scrollOffset: offset,
          isCompleted: completed ?? _isCompleted,
          isBookmarked: bookmarked ?? _isBookmarked,
        );
  }

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final isDark = theme.brightness == Brightness.dark;
    final repo = ref.watch(contentRepositoryProvider);
    final concept = repo.getConceptById(widget.conceptId);
    final prefs = ref.watch(displayPreferencesProvider);

    if (concept == null) {
      return Scaffold(
        appBar: AppBar(title: const Text('Concept')),
        body: const StudyPageContainer(
          children: [
            StudyEmptyState(
              icon: Icons.article_outlined,
              title: 'Concept not found',
              message:
                  'Return to the chapter list to select an available concept.',
            ),
          ],
        ),
      );
    }

    return Scaffold(
      appBar: AppBar(
        title: Text(concept.title, overflow: TextOverflow.ellipsis),
        actions: [
          IconButton(
            tooltip: 'Decrease text size',
            icon: const Icon(Icons.text_decrease),
            onPressed: () => ref
                .read(displayPreferencesProvider.notifier)
                .setReadingScale(prefs.readingScale - 0.1),
          ),
          IconButton(
            tooltip: 'Increase text size',
            icon: const Icon(Icons.text_increase),
            onPressed: () => ref
                .read(displayPreferencesProvider.notifier)
                .setReadingScale(prefs.readingScale + 0.1),
          ),
          IconButton(
            tooltip: _isBookmarked ? 'Remove bookmark' : 'Bookmark concept',
            icon: Icon(
              _isBookmarked ? Icons.bookmark : Icons.bookmark_border,
            ),
            onPressed: () {
              setState(() => _isBookmarked = !_isBookmarked);
              _persistPosition(bookmarked: _isBookmarked);
            },
          ),
        ],
      ),
      body: StudyPageContainer(
        controller: _scrollController,
        children: [
          if (concept.microCards.isNotEmpty) ...[
            SegmentedButton<bool>(
              segments: const [
                ButtonSegment(
                  value: true,
                  label: Text('5-Min Guided'),
                  icon: Icon(Icons.bolt_outlined),
                ),
                ButtonSegment(
                  value: false,
                  label: Text('Full Textbook'),
                  icon: Icon(Icons.menu_book_outlined),
                ),
              ],
              selected: {_guidedMode},
              onSelectionChanged: (s) => setState(() => _guidedMode = s.first),
            ),
            const SizedBox(height: AppSpacing.lg),
          ],

          if (_guidedMode && concept.microCards.isNotEmpty) ...[
            _buildMicroStepper(context, concept),
          ] else ...[
            // Continuous, textbook-grade reading flow (no boxed card around main prose)
            Text(concept.title, style: theme.textTheme.headlineSmall),
            const SizedBox(height: AppSpacing.xs),
            StudyMetadataLine(
              parts: [concept.sourceBook, concept.sourcePage],
            ),
            const SizedBox(height: AppSpacing.md),
            RtlAwareText(
              concept.simpleExplanation,
              explicitDirection: concept.textDirection,
              style: theme.textTheme.bodyLarge,
            ),

            if (concept.glossaryHints.isNotEmpty) ...[
              const StudyDivider(verticalPadding: AppSpacing.xl),
              const StudySectionHeader(
                title: '1-Tap Urdu Term Help',
                subtitle: 'Tap any term for a plain Urdu & English explanation',
              ),
              const SizedBox(height: AppSpacing.sm),
              Wrap(
                spacing: AppSpacing.xs,
                runSpacing: AppSpacing.xs,
                children: List.generate(
                  concept.glossaryHints.length,
                  (i) {
                    final selected = _expandedGlossaryIndex == i;
                    return OutlinedButton(
                      onPressed: () => setState(() {
                        _expandedGlossaryIndex = selected ? null : i;
                      }),
                      style: OutlinedButton.styleFrom(
                        minimumSize: const Size(48, 40),
                        backgroundColor: selected
                            ? theme.colorScheme.primaryContainer
                            : null,
                        side: BorderSide(
                          color: selected
                              ? theme.colorScheme.primary
                              : theme.colorScheme.outline,
                        ),
                      ),
                      child: Text(concept.glossaryHints[i].term),
                    );
                  },
                ),
              ),
              if (_expandedGlossaryIndex != null) ...[
                const SizedBox(height: AppSpacing.sm),
                AcademicSurface(
                  backgroundColor: theme.colorScheme.surfaceContainerHighest
                      .withValues(alpha: 0.55),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      RtlAwareText(
                        concept
                            .glossaryHints[_expandedGlossaryIndex!].urduMeaning,
                        explicitDirection: TextDirection.rtl,
                        style: theme.textTheme.titleMedium,
                      ),
                      const SizedBox(height: AppSpacing.xxs),
                      Text(
                        concept
                            .glossaryHints[_expandedGlossaryIndex!].simpleHint,
                        style: theme.textTheme.bodyMedium,
                      ),
                    ],
                  ),
                ),
              ],
            ],

            if (concept.definitions.isNotEmpty) ...[
              const StudyDivider(verticalPadding: AppSpacing.xl),
              const StudySectionHeader(title: 'Key Definitions'),
              const SizedBox(height: AppSpacing.sm),
              for (final d in concept.definitions)
                Padding(
                  padding: const EdgeInsets.only(bottom: AppSpacing.sm),
                  child: Text.rich(
                    TextSpan(
                      children: [
                        TextSpan(
                          text: '${d.term}: ',
                          style: theme.textTheme.titleMedium,
                        ),
                        TextSpan(
                          text: d.definition,
                          style: theme.textTheme.bodyLarge,
                        ),
                      ],
                    ),
                  ),
                ),
            ],

            if (concept.importantPoints.isNotEmpty) ...[
              const StudyDivider(verticalPadding: AppSpacing.xl),
              const StudySectionHeader(title: 'Important Points'),
              const SizedBox(height: AppSpacing.sm),
              for (final pt in concept.importantPoints)
                Padding(
                  padding: const EdgeInsets.only(bottom: AppSpacing.xs),
                  child: Text('• $pt', style: theme.textTheme.bodyLarge),
                ),
            ],

            if (concept.formulas.isNotEmpty) ...[
              const StudyDivider(verticalPadding: AppSpacing.xl),
              const StudySectionHeader(title: 'Formulas & SI Units'),
              const SizedBox(height: AppSpacing.sm),
              for (final f in concept.formulas)
                Padding(
                  padding: const EdgeInsets.only(bottom: AppSpacing.xs),
                  child: AcademicSurface(
                    backgroundColor: theme.colorScheme.surfaceContainerHighest
                        .withValues(alpha: 0.55),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          f.expression,
                          style: AppTypography.formula(context),
                        ),
                        const SizedBox(height: AppSpacing.xxs),
                        Text(
                          f.unit == null
                              ? f.description
                              : '${f.description} • SI Unit: ${f.unit}',
                          style: theme.textTheme.bodyMedium,
                        ),
                      ],
                    ),
                  ),
                ),
            ],

            if (concept.diagrams.isNotEmpty) ...[
              const StudyDivider(verticalPadding: AppSpacing.xl),
              const StudySectionHeader(title: 'Diagrams & Illustrations'),
              const SizedBox(height: AppSpacing.sm),
              for (final diag in concept.diagrams)
                Padding(
                  padding: const EdgeInsets.only(bottom: AppSpacing.sm),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      if (diag.svgMarkup != null)
                        AcademicSurface(
                          padding: const EdgeInsets.all(AppSpacing.sm),
                          child: SvgPicture.string(
                            diag.svgMarkup!,
                            height: 180,
                            fit: BoxFit.contain,
                          ),
                        ),
                      const SizedBox(height: AppSpacing.xs),
                      Text(diag.caption, style: theme.textTheme.bodySmall),
                    ],
                  ),
                ),
            ],

            if (concept.workedExamples.isNotEmpty) ...[
              const StudyDivider(verticalPadding: AppSpacing.xl),
              const StudySectionHeader(title: 'Worked Examples'),
              const SizedBox(height: AppSpacing.sm),
              for (final ex in concept.workedExamples)
                Padding(
                  padding: const EdgeInsets.only(bottom: AppSpacing.md),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(ex.prompt, style: theme.textTheme.titleMedium),
                      const SizedBox(height: AppSpacing.xs),
                      for (final s in ex.steps)
                        Padding(
                          padding: const EdgeInsets.only(bottom: AppSpacing.xxs),
                          child: Text(s, style: theme.textTheme.bodyMedium),
                        ),
                      const SizedBox(height: AppSpacing.xxs),
                      Text(
                        'Answer: ${ex.finalAnswer}',
                        style: AppTypography.tabular(
                          theme.textTheme.labelLarge,
                          color: theme.colorScheme.primary,
                        ),
                      ),
                    ],
                  ),
                ),
            ],

            if (concept.applications.isNotEmpty) ...[
              const StudyDivider(verticalPadding: AppSpacing.xl),
              const StudySectionHeader(title: 'Everyday Applications'),
              const SizedBox(height: AppSpacing.sm),
              for (final a in concept.applications)
                Padding(
                  padding: const EdgeInsets.only(bottom: AppSpacing.xs),
                  child: Text('• $a', style: theme.textTheme.bodyLarge),
                ),
            ],

            if (concept.commonMistakes.isNotEmpty) ...[
              const StudyDivider(verticalPadding: AppSpacing.xl),
              const StudySectionHeader(title: 'Common Mistakes to Avoid'),
              const SizedBox(height: AppSpacing.sm),
              for (final m in concept.commonMistakes)
                Padding(
                  padding: const EdgeInsets.only(bottom: AppSpacing.sm),
                  child: AcademicSurface(
                    backgroundColor: isDark
                        ? AppColors.errorContainerDark
                        : AppColors.errorContainerLight,
                    borderColor: theme.colorScheme.error.withValues(alpha: 0.3),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Row(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Icon(
                              Icons.warning_amber_outlined,
                              size: AppIconSize.md,
                              color: theme.colorScheme.error,
                            ),
                            const SizedBox(width: AppSpacing.xs),
                            Expanded(
                              child: Text(
                                'Mistake: ${m.mistake}',
                                style: theme.textTheme.titleSmall?.copyWith(
                                  color: theme.colorScheme.error,
                                ),
                              ),
                            ),
                          ],
                        ),
                        const SizedBox(height: AppSpacing.xxs),
                        Text(
                          'Correction: ${m.correction}',
                          style: theme.textTheme.bodyMedium,
                        ),
                      ],
                    ),
                  ),
                ),
            ],

            if (concept.quickRevisionSummary.isNotEmpty) ...[
              const StudyDivider(verticalPadding: AppSpacing.xl),
              const StudySectionHeader(title: 'Quick Revision Summary'),
              const SizedBox(height: AppSpacing.sm),
              for (final s in concept.quickRevisionSummary)
                Padding(
                  padding: const EdgeInsets.only(bottom: AppSpacing.xs),
                  child: Row(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Icon(
                        Icons.check,
                        size: AppIconSize.sm,
                        color: theme.colorScheme.primary,
                      ),
                      const SizedBox(width: AppSpacing.xs),
                      Expanded(
                        child: Text(s, style: theme.textTheme.bodyLarge),
                      ),
                    ],
                  ),
                ),
            ],
          ],

          if (concept.videoLinks.isNotEmpty) ...[
            const StudyDivider(verticalPadding: AppSpacing.xl),
            const StudySectionHeader(
              title: 'Curated YouTube Explanations',
              subtitle: 'Optional external video links (requires internet)',
            ),
            const SizedBox(height: AppSpacing.sm),
            AcademicSurface(
              padding: EdgeInsets.zero,
              child: Column(
                children: [
                  for (int i = 0; i < concept.videoLinks.length; i++) ...[
                    if (i > 0) const Divider(height: 1),
                    ListTile(
                      minTileHeight: 64,
                      leading: Icon(
                        Icons.play_circle_outline,
                        color: theme.colorScheme.primary,
                      ),
                      title: Text(concept.videoLinks[i].title),
                      subtitle: Text(
                        '${concept.videoLinks[i].channelName} • ${concept.videoLinks[i].durationLabel} • ${concept.videoLinks[i].language.toUpperCase()}',
                      ),
                      trailing: const Icon(Icons.copy_outlined, size: AppIconSize.sm),
                      onTap: () async {
                        await Clipboard.setData(
                          ClipboardData(text: concept.videoLinks[i].youtubeUrl),
                        );
                        if (!context.mounted) return;
                        ScaffoldMessenger.of(context).showSnackBar(
                          const SnackBar(
                            content: Text(
                              'YouTube link copied — open in your browser when online.',
                            ),
                          ),
                        );
                      },
                    ),
                  ],
                ],
              ),
            ),
          ],

          const StudyDivider(verticalPadding: AppSpacing.xl),

          // Source citation & completion actions
          Text(
            'Source: ${concept.sourceBook} (${concept.sourcePage})',
            style: theme.textTheme.bodySmall,
          ),
          const SizedBox(height: AppSpacing.md),
          Wrap(
            spacing: AppSpacing.xs,
            runSpacing: AppSpacing.xs,
            children: [
              OutlinedButton.icon(
                onPressed: () {
                  setState(() => _isCompleted = !_isCompleted);
                  _persistPosition(completed: _isCompleted);
                },
                icon: Icon(
                  _isCompleted
                      ? Icons.check_circle
                      : Icons.check_circle_outline,
                ),
                label: Text(
                  _isCompleted ? 'Marked Understood' : 'Mark Understood',
                ),
              ),
              FilledButton.icon(
                onPressed: () {
                  _persistPosition(completed: true);
                  context.push('/practice/session?conceptId=${concept.id}');
                },
                icon: const Icon(Icons.edit_note_outlined),
                label: const Text('Practise This Concept'),
              ),
            ],
          ),
        ],
      ),
    );
  }

  Widget _buildMicroStepper(BuildContext context, ConceptItem concept) {
    final theme = Theme.of(context);
    final cards = concept.microCards;
    final card = cards[_microStep];

    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        Row(
          mainAxisAlignment: MainAxisAlignment.spaceBetween,
          children: [
            Text(
              'Step ${_microStep + 1} of ${cards.length} • ${card.stageTitle}',
              style: theme.textTheme.labelLarge?.copyWith(
                color: theme.colorScheme.primary,
              ),
            ),
            Text(
              '${(((_microStep + 1) / cards.length) * 100).round()}%',
              style: AppTypography.tabular(theme.textTheme.bodySmall),
            ),
          ],
        ),
        const SizedBox(height: AppSpacing.xs),
        LinearProgressIndicator(value: (_microStep + 1) / cards.length),
        const SizedBox(height: AppSpacing.lg),
        Text(card.body, style: theme.textTheme.bodyLarge),
        if (card.quickCheckQuestion != null) ...[
          const StudyDivider(verticalPadding: AppSpacing.lg),
          Text(card.quickCheckQuestion!, style: theme.textTheme.titleMedium),
          const SizedBox(height: AppSpacing.sm),
          for (final opt in card.quickCheckOptions)
            Padding(
              padding: const EdgeInsets.only(bottom: AppSpacing.xs),
              child: AcademicSurface(
                padding: const EdgeInsets.symmetric(
                  horizontal: AppSpacing.sm,
                  vertical: AppSpacing.xs,
                ),
                backgroundColor: _microAnswer == opt
                    ? theme.colorScheme.primaryContainer.withValues(alpha: 0.45)
                    : null,
                borderColor: _microAnswer == opt
                    ? theme.colorScheme.primary
                    : theme.colorScheme.outline,
                onTap: () => setState(() => _microAnswer = opt),
                child: ConstrainedBox(
                  constraints:
                      const BoxConstraints(minHeight: AppTouchTarget.min - 16),
                  child: Row(
                    children: [
                      Icon(
                        _microAnswer == opt
                            ? Icons.radio_button_checked
                            : Icons.radio_button_unchecked,
                        size: AppIconSize.md,
                        color: _microAnswer == opt
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
            ),
          if (_microAnswer != null) ...[
            const SizedBox(height: AppSpacing.xs),
            StudyFeedbackBanner(
              kind: _microAnswer == card.quickCheckAnswer
                  ? StudyFeedbackKind.success
                  : StudyFeedbackKind.error,
              title: _microAnswer == card.quickCheckAnswer
                  ? 'Correct — you got it.'
                  : 'Not quite — correct answer is ${card.quickCheckAnswer}.',
            ),
          ],
        ],
        const SizedBox(height: AppSpacing.xl),
        Row(
          mainAxisAlignment: MainAxisAlignment.spaceBetween,
          children: [
            if (_microStep > 0)
              OutlinedButton(
                onPressed: () => setState(() {
                  _microStep--;
                  _microAnswer = null;
                }),
                child: const Text('Previous'),
              )
            else
              const SizedBox.shrink(),
            if (_microStep < cards.length - 1)
              FilledButton(
                onPressed: () => setState(() {
                  _microStep++;
                  _microAnswer = null;
                }),
                child: const Text('Next Step'),
              )
            else
              FilledButton(
                onPressed: () {
                  setState(() => _isCompleted = true);
                  _persistPosition(completed: true);
                  context.push('/practice/session?conceptId=${concept.id}');
                },
                child: const Text('Finish & Practise'),
              ),
          ],
        ),
      ],
    );
  }
}
