import 'dart:convert';

import 'package:crypto/crypto.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:roshan_study/core/database/database_provider.dart';
import 'package:roshan_study/core/database/local_database.dart';
import 'package:roshan_study/core/models/curriculum_models.dart';
import 'package:roshan_study/data/starter_packs_seed.dart';

class DownloadedChapterMeta {
  const DownloadedChapterMeta({
    required this.chapterId,
    required this.subjectId,
    required this.programmeId,
    required this.packVersion,
    required this.checksumSha256,
    required this.sizeBytes,
    required this.downloadedAt,
  });

  final String chapterId;
  final String subjectId;
  final String programmeId;
  final int packVersion;
  final String checksumSha256;
  final int sizeBytes;
  final DateTime downloadedAt;
}

class ReadingProgressEntry {
  const ReadingProgressEntry({
    required this.conceptId,
    required this.chapterId,
    required this.subjectId,
    required this.scrollOffset,
    required this.isCompleted,
    required this.isBookmarked,
    required this.lastReadAt,
  });

  final String conceptId;
  final String chapterId;
  final String subjectId;
  final double scrollOffset;
  final bool isCompleted;
  final bool isBookmarked;
  final DateTime lastReadAt;
}

class ContentRepository {
  ContentRepository(this._db);

  final LocalDatabase _db;

  List<ChapterPack> getPacksForProgramme(ProgrammeId programmeId) {
    return StarterPacksSeed.starterPacks
        .where((p) => p.programmeId == programmeId)
        .toList(growable: false);
  }

  List<ChapterPack> getPacksForSubject(String subjectId) {
    return StarterPacksSeed.starterPacks
        .where((p) => p.subjectId == subjectId)
        .toList(growable: false);
  }

  ChapterPack? getPackById(String chapterId) {
    for (final pack in StarterPacksSeed.starterPacks) {
      if (pack.chapterId == chapterId) return pack;
    }
    return null;
  }

  ConceptItem? getConceptById(String conceptId) {
    for (final pack in StarterPacksSeed.starterPacks) {
      for (final concept in pack.concepts) {
        if (concept.id == conceptId) return concept;
      }
    }
    return null;
  }

  QuestionItem? getQuestionById(String questionId) {
    for (final pack in StarterPacksSeed.starterPacks) {
      for (final q in pack.questions) {
        if (q.id == questionId) return q;
      }
    }
    return null;
  }

  List<QuestionItem> getQuestions({
    required ProgrammeId programmeId,
    String? subjectId,
    String? chapterId,
    String? conceptId,
    int? maxDifficulty,
  }) {
    final results = <QuestionItem>[];
    for (final pack in StarterPacksSeed.starterPacks) {
      if (pack.programmeId != programmeId) continue;
      if (subjectId != null && pack.subjectId != subjectId) continue;
      if (chapterId != null && pack.chapterId != chapterId) continue;
      for (final q in pack.questions) {
        if (conceptId != null && q.conceptId != conceptId) continue;
        if (maxDifficulty != null && q.difficulty > maxDifficulty) continue;
        results.add(q);
      }
    }
    return results;
  }

  List<MockExamDefinition> getMocksForProgramme(ProgrammeId programmeId) {
    return StarterPacksSeed.starterMocks
        .where((m) => m.programmeId == programmeId)
        .toList(growable: false);
  }

  bool isChapterDownloaded(String chapterId) {
    final rows = _db.db.select(
      'SELECT chapter_id FROM downloaded_chapters WHERE chapter_id = ?;',
      [chapterId],
    );
    if (rows.isNotEmpty) return true;
    return getPackById(chapterId)?.isBundledStarter ?? false;
  }

  List<DownloadedChapterMeta> listDownloadedChapters() {
    final rows = _db.db.select(
      'SELECT chapter_id, subject_id, programme_id, pack_version, checksum_sha256, size_bytes, downloaded_at FROM downloaded_chapters ORDER BY downloaded_at DESC;',
    );
    return rows
        .map(
          (r) => DownloadedChapterMeta(
            chapterId: r['chapter_id'] as String,
            subjectId: r['subject_id'] as String,
            programmeId: r['programme_id'] as String,
            packVersion: r['pack_version'] as int,
            checksumSha256: r['checksum_sha256'] as String,
            sizeBytes: r['size_bytes'] as int,
            downloadedAt: DateTime.parse(r['downloaded_at'] as String),
          ),
        )
        .toList(growable: false);
  }

  /// Stores a verified JSON chapter pack locally after SHA-256 verification.
  void saveVerifiedChapterPack({
    required ChapterPack pack,
    required String rawJson,
    String? expectedSha256,
  }) {
    final actualSha = sha256.convert(utf8.encode(rawJson)).toString();
    if (expectedSha256 != null && expectedSha256 != actualSha) {
      throw StateError(
        'Checksum mismatch for chapter ${pack.chapterId}. Expected $expectedSha256, got $actualSha.',
      );
    }

    _db.db.execute(
      '''
      INSERT INTO downloaded_chapters (
        chapter_id, subject_id, programme_id, pack_version,
        checksum_sha256, size_bytes, pack_json, downloaded_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(chapter_id) DO UPDATE SET
        pack_version = excluded.pack_version,
        checksum_sha256 = excluded.checksum_sha256,
        size_bytes = excluded.size_bytes,
        pack_json = excluded.pack_json,
        downloaded_at = excluded.downloaded_at;
      ''',
      [
        pack.chapterId,
        pack.subjectId,
        pack.programmeId.id,
        pack.packVersion,
        actualSha,
        utf8.encode(rawJson).length,
        rawJson,
        DateTime.now().toIso8601String(),
      ],
    );
  }

  void removeDownloadedChapter(String chapterId) {
    _db.db.execute(
      'DELETE FROM downloaded_chapters WHERE chapter_id = ?;',
      [chapterId],
    );
  }

  void saveReadingProgress({
    required String conceptId,
    required String chapterId,
    required String subjectId,
    required double scrollOffset,
    bool? isCompleted,
    bool? isBookmarked,
  }) {
    final existing = getReadingProgress(conceptId);
    _db.db.execute(
      '''
      INSERT INTO reading_progress (
        concept_id, chapter_id, subject_id, scroll_offset,
        is_completed, is_bookmarked, last_read_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(concept_id) DO UPDATE SET
        scroll_offset = excluded.scroll_offset,
        is_completed = excluded.is_completed,
        is_bookmarked = excluded.is_bookmarked,
        last_read_at = excluded.last_read_at;
      ''',
      [
        conceptId,
        chapterId,
        subjectId,
        scrollOffset,
        (isCompleted ?? existing?.isCompleted ?? false) ? 1 : 0,
        (isBookmarked ?? existing?.isBookmarked ?? false) ? 1 : 0,
        DateTime.now().toIso8601String(),
      ],
    );
  }

  ReadingProgressEntry? getReadingProgress(String conceptId) {
    final rows = _db.db.select(
      'SELECT * FROM reading_progress WHERE concept_id = ?;',
      [conceptId],
    );
    if (rows.isEmpty) return null;
    final r = rows.first;
    return ReadingProgressEntry(
      conceptId: r['concept_id'] as String,
      chapterId: r['chapter_id'] as String,
      subjectId: r['subject_id'] as String,
      scrollOffset: (r['scroll_offset'] as num).toDouble(),
      isCompleted: (r['is_completed'] as int) == 1,
      isBookmarked: (r['is_bookmarked'] as int) == 1,
      lastReadAt: DateTime.parse(r['last_read_at'] as String),
    );
  }

  ReadingProgressEntry? getMostRecentReading() {
    final rows = _db.db.select(
      'SELECT * FROM reading_progress ORDER BY last_read_at DESC LIMIT 1;',
    );
    if (rows.isEmpty) return null;
    final r = rows.first;
    return ReadingProgressEntry(
      conceptId: r['concept_id'] as String,
      chapterId: r['chapter_id'] as String,
      subjectId: r['subject_id'] as String,
      scrollOffset: (r['scroll_offset'] as num).toDouble(),
      isCompleted: (r['is_completed'] as int) == 1,
      isBookmarked: (r['is_bookmarked'] as int) == 1,
      lastReadAt: DateTime.parse(r['last_read_at'] as String),
    );
  }

  List<ReadingProgressEntry> listBookmarks() {
    final rows = _db.db.select(
      'SELECT * FROM reading_progress WHERE is_bookmarked = 1 ORDER BY last_read_at DESC;',
    );
    return rows
        .map(
          (r) => ReadingProgressEntry(
            conceptId: r['concept_id'] as String,
            chapterId: r['chapter_id'] as String,
            subjectId: r['subject_id'] as String,
            scrollOffset: (r['scroll_offset'] as num).toDouble(),
            isCompleted: (r['is_completed'] as int) == 1,
            isBookmarked: true,
            lastReadAt: DateTime.parse(r['last_read_at'] as String),
          ),
        )
        .toList(growable: false);
  }
}

final contentRepositoryProvider = Provider<ContentRepository>((ref) {
  return ContentRepository(ref.watch(localDatabaseProvider));
});
