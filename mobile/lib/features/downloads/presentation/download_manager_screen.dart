import 'dart:convert';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:roshan_study/app/theme/app_tokens.dart';
import 'package:roshan_study/app/theme/app_typography.dart';
import 'package:roshan_study/core/models/curriculum_models.dart';
import 'package:roshan_study/core/widgets/academic_surface.dart';
import 'package:roshan_study/data/repositories/content_repository.dart';
import 'package:roshan_study/data/repositories/progress_repository.dart';
import 'package:roshan_study/data/repositories/sync_service.dart';

class DownloadManagerScreen extends ConsumerStatefulWidget {
  const DownloadManagerScreen({super.key});

  @override
  ConsumerState<DownloadManagerScreen> createState() =>
      _DownloadManagerScreenState();
}

class _DownloadManagerScreenState extends ConsumerState<DownloadManagerScreen> {
  String? _syncStatus;
  bool _loadingCatalog = false;
  String? _catalogError;
  List<CatalogChapterSummary> _remoteCatalog = const [];
  String? _downloadingId;

  Future<void> _attemptSync() async {
    final res = await ref.read(syncServiceProvider).flushPendingOutbox();
    if (!mounted) return;
    setState(() {
      if (res.skippedOfflineOrLocalOnly) {
        _syncStatus =
            'Local-only MVP mode active (or offline). All progress remains safely saved on your device.';
      } else if (res.errorMessage != null) {
        _syncStatus = 'Sync deferred safely: ${res.errorMessage}';
      } else {
        _syncStatus = 'Synced ${res.synced} queued attempts.';
      }
    });
  }

  Future<void> _fetchCatalog() async {
    setState(() {
      _loadingCatalog = true;
      _catalogError = null;
    });
    try {
      final page = await ref.read(syncServiceProvider).fetchRemoteCatalog();
      if (!mounted) return;
      setState(() {
        _remoteCatalog = page.items;
        _loadingCatalog = false;
      });
    } catch (e) {
      if (!mounted) return;
      setState(() {
        _catalogError = e.toString().replaceFirst('Bad state: ', '');
        _loadingCatalog = false;
      });
    }
  }

  Future<void> _downloadRemotePack(CatalogChapterSummary summary) async {
    setState(() => _downloadingId = summary.chapterId);
    try {
      await ref.read(syncServiceProvider).downloadAndSaveChapterPack(
            chapterId: summary.chapterId,
            version: summary.packVersion,
            contentRepo: ref.read(contentRepositoryProvider),
            expectedSha256: summary.checksumSha256.isNotEmpty
                ? summary.checksumSha256
                : null,
          );
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text('Downloaded "${summary.title}" for offline study.'),
        ),
      );
      setState(() => _downloadingId = null);
    } catch (e) {
      if (!mounted) return;
      setState(() {
        _downloadingId = null;
        _catalogError = 'Download failed: $e';
      });
    }
  }

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final contentRepo = ref.watch(contentRepositoryProvider);
    final progressRepo = ref.watch(progressRepositoryProvider);
    final syncService = ref.watch(syncServiceProvider);
    final cached = contentRepo.listDownloadedChapters();
    final allPacks = contentRepo.getPacksForProgramme(ProgrammeId.sscHssc);
    final pendingSync = progressRepo.pendingOutboxCount();
    final totalBytes = cached.fold<int>(0, (acc, item) => acc + item.sizeBytes);

    return Scaffold(
      appBar: AppBar(title: const Text('Offline Storage & Sync')),
      body: StudyPageContainer(
        children: [
          const StudySectionHeader(
            kicker: 'Device Storage',
            title: 'Local Cache & Sync Queue',
          ),
          const SizedBox(height: AppSpacing.xs),
          Text(
            'Downloaded extra packs: ${cached.length} (${(totalBytes / 1024).toStringAsFixed(1)} KB)\n'
            'Pending sync queue items: $pendingSync',
            style: AppTypography.tabular(theme.textTheme.bodyMedium),
          ),
          const SizedBox(height: AppSpacing.sm),
          Wrap(
            spacing: AppSpacing.xs,
            runSpacing: AppSpacing.xs,
            children: [
              OutlinedButton.icon(
                onPressed: _attemptSync,
                icon: const Icon(Icons.sync),
                label: const Text('Check / Flush Sync Queue'),
              ),
              if (syncService.effectiveCatalogBaseUrl != null)
                FilledButton.tonalIcon(
                  onPressed: _loadingCatalog ? null : _fetchCatalog,
                  icon: const Icon(Icons.cloud_download_outlined),
                  label: Text(
                    _loadingCatalog
                        ? 'Checking Cloud...'
                        : 'Browse Cloud Catalog',
                  ),
                ),
            ],
          ),
          if (_syncStatus != null) ...[
            const SizedBox(height: AppSpacing.sm),
            StudyFeedbackBanner(
              kind: StudyFeedbackKind.info,
              title: 'Sync Status',
              message: _syncStatus,
            ),
          ],
          if (_catalogError != null) ...[
            const SizedBox(height: AppSpacing.sm),
            StudyFeedbackBanner(
              kind: StudyFeedbackKind.error,
              title: 'Cloud Catalog Notice',
              message: _catalogError,
            ),
          ],

          if (_remoteCatalog.isNotEmpty) ...[
            const StudyDivider(verticalPadding: AppSpacing.xl),
            const StudySectionHeader(
              title: 'Cloud Library Catalog',
              subtitle: 'Admin-approved chapters ready for offline download',
            ),
            const SizedBox(height: AppSpacing.sm),
            AcademicSurface(
              padding: EdgeInsets.zero,
              child: Column(
                children: [
                  for (int i = 0; i < _remoteCatalog.length; i++) ...[
                    if (i > 0) const Divider(height: 1),
                    Builder(
                      builder: (context) {
                        final item = _remoteCatalog[i];
                        final busy = _downloadingId == item.chapterId;
                        final saved =
                            cached.any((c) => c.chapterId == item.chapterId);
                        return ListTile(
                          minTileHeight: 60,
                          title: Text(
                            'Grade ${item.grade} • Ch ${item.chapterNumber}: ${item.title}',
                            style: theme.textTheme.titleSmall,
                          ),
                          subtitle: Text(
                            '${item.subjectName} • ${item.conceptCount} concepts • ${item.questionCount} Qs',
                          ),
                          trailing: IconButton(
                            tooltip: saved ? 'Re-download update' : 'Download offline',
                            onPressed:
                                busy ? null : () => _downloadRemotePack(item),
                            icon: Icon(
                              saved
                                  ? Icons.offline_pin
                                  : Icons.cloud_download_outlined,
                              color: saved
                                  ? theme.colorScheme.primary
                                  : theme.colorScheme.onSurfaceVariant,
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

          const StudySectionHeader(
            title: 'SSC / HSSC Chapter Packs',
            subtitle: 'Verify SHA-256 checksums for offline study reliability',
          ),
          const SizedBox(height: AppSpacing.sm),
          AcademicSurface(
            padding: EdgeInsets.zero,
            child: Column(
              children: [
                for (int i = 0; i < allPacks.length; i++) ...[
                  if (i > 0) const Divider(height: 1),
                  Builder(
                    builder: (context) {
                      final pack = allPacks[i];
                      final saved =
                          cached.any((c) => c.chapterId == pack.chapterId);
                      return ListTile(
                        minTileHeight: 60,
                        title: Text(
                          'Grade ${pack.grade} • ${pack.title}',
                          style: theme.textTheme.titleSmall,
                        ),
                        subtitle: Text(
                          saved
                              ? 'SHA-256 verified local cache'
                              : 'Bundled starter (~${pack.estimatedSizeKb} KB)',
                        ),
                        trailing: IconButton(
                          tooltip: saved
                              ? 'Remove cached copy'
                              : 'Verify & cache locally',
                          icon: Icon(
                            saved
                                ? Icons.delete_outline
                                : Icons.download_outlined,
                            color: saved
                                ? theme.colorScheme.error
                                : theme.colorScheme.primary,
                          ),
                          onPressed: () {
                            if (saved) {
                              contentRepo
                                  .removeDownloadedChapter(pack.chapterId);
                            } else {
                              contentRepo.saveVerifiedChapterPack(
                                pack: pack,
                                rawJson: jsonEncode(pack.toJson()),
                              );
                            }
                            setState(() {});
                          },
                        ),
                      );
                    },
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
