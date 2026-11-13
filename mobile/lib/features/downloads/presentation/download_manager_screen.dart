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

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final contentRepo = ref.watch(contentRepositoryProvider);
    final progressRepo = ref.watch(progressRepositoryProvider);
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
          Align(
            alignment: Alignment.centerLeft,
            child: OutlinedButton.icon(
              onPressed: _attemptSync,
              icon: const Icon(Icons.sync),
              label: const Text('Check / Flush Sync Queue'),
            ),
          ),
          if (_syncStatus != null) ...[
            const SizedBox(height: AppSpacing.sm),
            StudyFeedbackBanner(
              kind: StudyFeedbackKind.info,
              title: 'Sync Status',
              message: _syncStatus,
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
                                rawJson: jsonEncode({
                                  'chapterId': pack.chapterId,
                                  'version': pack.packVersion,
                                }),
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
