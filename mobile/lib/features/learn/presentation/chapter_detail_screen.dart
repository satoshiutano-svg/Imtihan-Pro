import 'dart:convert';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:roshan_study/app/theme/app_tokens.dart';
import 'package:roshan_study/core/widgets/academic_surface.dart';
import 'package:roshan_study/data/repositories/content_repository.dart';

class ChapterDetailScreen extends ConsumerStatefulWidget {
  const ChapterDetailScreen({super.key, required this.chapterId});

  final String chapterId;

  @override
  ConsumerState<ChapterDetailScreen> createState() =>
      _ChapterDetailScreenState();
}

class _ChapterDetailScreenState extends ConsumerState<ChapterDetailScreen> {
  void _toggleOfflineSave() {
    final repo = ref.read(contentRepositoryProvider);
    final pack = repo.getPackById(widget.chapterId);
    if (pack == null) return;

    final alreadySaved = repo
        .listDownloadedChapters()
        .any((d) => d.chapterId == widget.chapterId);

    if (alreadySaved) {
      repo.removeDownloadedChapter(widget.chapterId);
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
          content: Text('Removed extra offline cache for chapter.'),
        ),
      );
    } else {
      final serialized = jsonEncode({
        'chapterId': pack.chapterId,
        'title': pack.title,
        'version': pack.packVersion,
      });
      repo.saveVerifiedChapterPack(pack: pack, rawJson: serialized);
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
          content: Text('Chapter verified (SHA-256) and saved offline.'),
        ),
      );
    }
    setState(() {});
  }

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final repo = ref.watch(contentRepositoryProvider);
    final pack = repo.getPackById(widget.chapterId);

    if (pack == null) {
      return Scaffold(
        appBar: AppBar(title: const Text('Chapter')),
        body: const StudyPageContainer(
          children: [
            StudyEmptyState(
              icon: Icons.menu_book_outlined,
              title: 'Chapter not found locally',
              message:
                  'This chapter pack has not been cached on your device yet.',
            ),
          ],
        ),
      );
    }

    final isExplicitlyCached = repo
        .listDownloadedChapters()
        .any((d) => d.chapterId == pack.chapterId);

    return Scaffold(
      appBar: AppBar(
        title: Text('Ch ${pack.chapterNumber}: ${pack.title}'),
        actions: [
          IconButton(
            tooltip: 'Save/Remove Offline Copy',
            icon: Icon(
              isExplicitlyCached ? Icons.offline_pin : Icons.download_outlined,
            ),
            onPressed: _toggleOfflineSave,
          ),
        ],
      ),
      body: StudyPageContainer(
        children: [
          // Unboxed calm overview & primary chapter practice CTA
          StudySectionHeader(
            kicker: 'Grade ${pack.grade} • Chapter ${pack.chapterNumber}',
            title: 'Learning Outcomes',
          ),
          const SizedBox(height: AppSpacing.xs),
          for (final lo in pack.learningOutcomes)
            Padding(
              padding: const EdgeInsets.only(bottom: AppSpacing.xxs),
              child: Text('• $lo', style: theme.textTheme.bodyMedium),
            ),
          const SizedBox(height: AppSpacing.md),
          SizedBox(
            width: double.infinity,
            child: FilledButton.icon(
              onPressed: () =>
                  context.push('/practice/session?chapterId=${pack.chapterId}'),
              icon: const Icon(Icons.edit_note_outlined),
              label: Text('Practise Chapter (${pack.questions.length} Qs)'),
            ),
          ),
          const StudyDivider(verticalPadding: AppSpacing.xl),
          for (int tIdx = 0; tIdx < pack.topics.length; tIdx++) ...[
            if (tIdx > 0) const SizedBox(height: AppSpacing.lg),
            Builder(
              builder: (context) {
                final topic = pack.topics[tIdx];
                final topicConcepts = pack.concepts
                    .where((c) => c.topicId == topic.id)
                    .toList(growable: false);

                return Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    StudySectionHeader(
                      title: 'Topic ${topic.orderIndex}: ${topic.title}',
                    ),
                    const SizedBox(height: AppSpacing.xs),
                    AcademicSurface(
                      padding: EdgeInsets.zero,
                      child: Column(
                        children: [
                          for (int cIdx = 0;
                              cIdx < topicConcepts.length;
                              cIdx++) ...[
                            if (cIdx > 0) const Divider(height: 1),
                            Builder(
                              builder: (context) {
                                final concept = topicConcepts[cIdx];
                                final progress =
                                    repo.getReadingProgress(concept.id);
                                return ListTile(
                                  minTileHeight: 56,
                                  leading: Icon(
                                    progress?.isCompleted == true
                                        ? Icons.check_circle
                                        : Icons.article_outlined,
                                    color: progress?.isCompleted == true
                                        ? theme.colorScheme.primary
                                        : theme.colorScheme.onSurfaceVariant,
                                    size: AppIconSize.md,
                                  ),
                                  title: Text(
                                    concept.title,
                                    style: theme.textTheme.titleSmall,
                                  ),
                                  subtitle: Text(concept.sourcePage),
                                  trailing: progress?.isBookmarked == true
                                      ? Icon(
                                          Icons.bookmark,
                                          size: AppIconSize.sm,
                                          color: theme.colorScheme.primary,
                                        )
                                      : const Icon(Icons.chevron_right),
                                  onTap: () => context.push(
                                    '/learn/chapter/${pack.chapterId}/concept/${concept.id}',
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
              },
            ),
          ],
        ],
      ),
    );
  }
}
