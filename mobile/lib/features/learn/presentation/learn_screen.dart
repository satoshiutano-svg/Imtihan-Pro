import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:roshan_study/app/theme/app_tokens.dart';
import 'package:roshan_study/core/models/curriculum_models.dart';
import 'package:roshan_study/core/widgets/academic_surface.dart';
import 'package:roshan_study/core/widgets/rtl_aware_text.dart';
import 'package:roshan_study/data/kpk_subject_catalog.dart';
import 'package:roshan_study/data/repositories/content_repository.dart';
import 'package:roshan_study/data/repositories/profile_repository.dart';

class LearnScreen extends ConsumerStatefulWidget {
  const LearnScreen({super.key});

  @override
  ConsumerState<LearnScreen> createState() => _LearnScreenState();
}

class _LearnScreenState extends ConsumerState<LearnScreen> {
  final TextEditingController _searchController = TextEditingController();
  String _query = '';

  @override
  void dispose() {
    _searchController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final profile = ref.watch(studentProfileProvider);
    final contentRepo = ref.watch(contentRepositoryProvider);
    final subjects = KpkSubjectCatalog.subjectsForProfile(
      grade: profile.grade,
      group: profile.group,
      selectedElectiveIds: profile.selectedElectiveIds,
    );
    final bookmarks = contentRepo.listBookmarks();
    final catalogIds = subjects.map((s) => s.id).toSet();

    // Also surface any dynamically downloaded SSC/HSSC cloud packs for this grade
    // whose subjectId isn't already in the profile's default list.
    final dynamicExtraPacks = contentRepo
        .getPacksForProgramme(ProgrammeId.sscHssc)
        .where((p) => p.grade == profile.grade.number && !catalogIds.contains(p.subjectId))
        .toList(growable: false);

    final trimmedQuery = _query.trim().toLowerCase();

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
        const SizedBox(height: AppSpacing.md),
        TextField(
          controller: _searchController,
          decoration: InputDecoration(
            hintText: 'Search chapters, topics, or downloaded packs...',
            prefixIcon: const Icon(Icons.search),
            suffixIcon: trimmedQuery.isNotEmpty
                ? IconButton(
                    tooltip: 'Clear search',
                    onPressed: () {
                      _searchController.clear();
                      setState(() => _query = '');
                    },
                    icon: const Icon(Icons.clear),
                  )
                : null,
          ),
          onChanged: (v) => setState(() => _query = v),
        ),
        if (bookmarks.isNotEmpty && trimmedQuery.isEmpty) ...[
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
          Builder(
            builder: (context) {
              final subject = subjects[sIdx];
              final chapters = contentRepo.getPacksForSubject(subject.id).where((ch) {
                if (trimmedQuery.isEmpty) return true;
                final hay =
                    '${subject.name} ${ch.title} ${ch.concepts.map((c) => c.title).join(' ')}'
                        .toLowerCase();
                return hay.contains(trimmedQuery);
              }).toList(growable: false);

              if (trimmedQuery.isNotEmpty && chapters.isEmpty) {
                return const SizedBox.shrink();
              }

              return Padding(
                padding: EdgeInsets.only(bottom: sIdx + 1 < subjects.length ? AppSpacing.lg : 0),
                child: Column(
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
                              _ChapterRow(
                                chapter: chapters[cIdx],
                                downloaded: contentRepo
                                    .isChapterDownloaded(chapters[cIdx].chapterId),
                                onTap: () => context.push(
                                  '/learn/chapter/${chapters[cIdx].chapterId}',
                                ),
                              ),
                            ],
                          ],
                        ),
                      ),
                  ],
                ),
              );
            },
          ),
        ],
        if (dynamicExtraPacks.isNotEmpty) ...[
          const StudyDivider(verticalPadding: AppSpacing.lg),
          const StudySectionHeader(
            title: 'Downloaded Cloud Packs',
            subtitle: 'Additional subjects and chapters synced offline',
          ),
          const SizedBox(height: AppSpacing.xs),
          AcademicSurface(
            padding: EdgeInsets.zero,
            child: Column(
              children: [
                for (int i = 0; i < dynamicExtraPacks.length; i++) ...[
                  if (i > 0) const Divider(height: 1),
                  _ChapterRow(
                    chapter: dynamicExtraPacks[i],
                    downloaded: true,
                    onTap: () => context.push(
                      '/learn/chapter/${dynamicExtraPacks[i].chapterId}',
                    ),
                  ),
                ],
              ],
            ),
          ),
        ],
      ],
    );
  }
}

class _ChapterRow extends StatelessWidget {
  const _ChapterRow({
    required this.chapter,
    required this.downloaded,
    required this.onTap,
  });

  final ChapterPack chapter;
  final bool downloaded;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    return ListTile(
      minTileHeight: 60,
      title: Text(
        'Ch ${chapter.chapterNumber}: ${chapter.title}',
        style: theme.textTheme.titleSmall,
      ),
      subtitle: StudyMetadataLine(
        parts: [
          '${chapter.concepts.length} concepts',
          '${chapter.questions.length} questions',
          '${chapter.estimatedSizeKb} KB',
        ],
      ),
      trailing: Icon(
        downloaded ? Icons.offline_pin : Icons.chevron_right,
        color: downloaded
            ? theme.colorScheme.primary
            : theme.colorScheme.onSurfaceVariant,
        size: AppIconSize.md,
      ),
      onTap: onTap,
    );
  }
}
