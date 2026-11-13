import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:roshan_study/app/theme/app_tokens.dart';
import 'package:roshan_study/core/widgets/academic_surface.dart';
import 'package:roshan_study/core/widgets/rtl_aware_text.dart';
import 'package:roshan_study/data/kpk_subject_catalog.dart';
import 'package:roshan_study/data/repositories/content_repository.dart';
import 'package:roshan_study/data/repositories/profile_repository.dart';

class LearnScreen extends ConsumerWidget {
  const LearnScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final theme = Theme.of(context);
    final profile = ref.watch(studentProfileProvider);
    final contentRepo = ref.watch(contentRepositoryProvider);
    final subjects = KpkSubjectCatalog.subjectsForProfile(
      grade: profile.grade,
      group: profile.group,
      selectedElectiveIds: profile.selectedElectiveIds,
    );
    final bookmarks = contentRepo.listBookmarks();

    return StudyPageContainer(
      children: [
        StudySectionHeader(
          kicker: '${profile.board.displayName} • English Medium',
          title: '${profile.grade.label} — ${profile.group.displayName}',
          subtitle: 'Tap any chapter to read concepts offline.',
          trailing: OutlinedButton.icon(
            onPressed: () => context.push('/downloads'),
            icon: const Icon(
              Icons.download_for_offline_outlined,
              size: AppIconSize.sm,
            ),
            label: const Text('Offline'),
          ),
        ),
        if (bookmarks.isNotEmpty) ...[
          const StudyDivider(verticalPadding: AppSpacing.lg),
          const StudySectionHeader(title: 'Bookmarked Concepts'),
          const SizedBox(height: AppSpacing.xs),
          AcademicSurface(
            padding: EdgeInsets.zero,
            child: Column(
              children: [
                for (int i = 0; i < bookmarks.length; i++) ...[
                  if (i > 0) const Divider(height: 1),
                  Builder(
                    builder: (context) {
                      final concept =
                          contentRepo.getConceptById(bookmarks[i].conceptId);
                      if (concept == null) return const SizedBox.shrink();
                      return ListTile(
                        minTileHeight: 56,
                        leading: Icon(
                          Icons.bookmark,
                          color: theme.colorScheme.primary,
                          size: AppIconSize.md,
                        ),
                        title: Text(concept.title),
                        subtitle: Text(concept.sourcePage),
                        trailing: const Icon(Icons.chevron_right),
                        onTap: () => context.push(
                          '/learn/chapter/${concept.chapterId}/concept/${concept.id}',
                        ),
                      );
                    },
                  ),
                ],
              ],
            ),
          ),
        ],
        const StudyDivider(verticalPadding: AppSpacing.lg),
        for (int sIdx = 0; sIdx < subjects.length; sIdx++) ...[
          if (sIdx > 0) const SizedBox(height: AppSpacing.lg),
          Builder(
            builder: (context) {
              final subject = subjects[sIdx];
              final chapters = contentRepo.getPacksForSubject(subject.id);

              return Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  StudySectionHeader(
                    title: subject.name,
                    subtitle: subject.code,
                  ),
                  if (subject.note != null) ...[
                    const SizedBox(height: AppSpacing.xxs),
                    RtlAwareText(
                      subject.note!,
                      style: theme.textTheme.bodySmall,
                    ),
                  ],
                  const SizedBox(height: AppSpacing.xs),
                  if (chapters.isEmpty)
                    Padding(
                      padding: const EdgeInsets.symmetric(
                        vertical: AppSpacing.xs,
                      ),
                      child: Text(
                        'Chapters queued for publishing in CMS (text-first, permission-verified).',
                        style: theme.textTheme.bodySmall,
                      ),
                    )
                  else
                    AcademicSurface(
                      padding: EdgeInsets.zero,
                      child: Column(
                        children: [
                          for (int cIdx = 0; cIdx < chapters.length; cIdx++) ...[
                            if (cIdx > 0) const Divider(height: 1),
                            Builder(
                              builder: (context) {
                                final ch = chapters[cIdx];
                                final downloaded =
                                    contentRepo.isChapterDownloaded(ch.chapterId);
                                return ListTile(
                                  minTileHeight: 60,
                                  title: Text(
                                    'Ch ${ch.chapterNumber}: ${ch.title}',
                                    style: theme.textTheme.titleSmall,
                                  ),
                                  subtitle: StudyMetadataLine(
                                    parts: [
                                      '${ch.concepts.length} concepts',
                                      '${ch.questions.length} questions',
                                      '${ch.estimatedSizeKb} KB',
                                    ],
                                  ),
                                  trailing: Icon(
                                    downloaded
                                        ? Icons.offline_pin
                                        : Icons.chevron_right,
                                    color: downloaded
                                        ? theme.colorScheme.primary
                                        : theme.colorScheme.onSurfaceVariant,
                                    size: AppIconSize.md,
                                  ),
                                  onTap: () => context.push(
                                    '/learn/chapter/${ch.chapterId}',
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
    );
  }
}
