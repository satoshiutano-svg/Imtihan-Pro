import 'dart:convert';

import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:roshan_study/core/database/database_provider.dart';
import 'package:roshan_study/core/database/local_database.dart';
import 'package:roshan_study/core/models/curriculum_models.dart';
import 'package:roshan_study/core/models/progress_models.dart';
import 'package:roshan_study/data/repositories/content_repository.dart';
import 'package:uuid/uuid.dart';

class ProgressRepository {
  ProgressRepository(this._db, this._contentRepo);

  final LocalDatabase _db;
  final ContentRepository _contentRepo;
  static const Uuid _uuid = Uuid();

  /// Local-first atomic write:
  /// 1. Saves unique attempt into `question_attempts` (IGNORE duplicates).
  /// 2. Updates `revision_schedule` using 1d -> 3d -> 7d spaced repetition.
  /// 3. Enqueues minimal attempt payload into `sync_outbox`.
  void recordAttempt({
    required QuestionItem question,
    required bool isCorrect,
    int? selfScoreMarks,
    int hintsUsed = 0,
    int timeSpentSec = 0,
    String? explicitAttemptUuid,
    DateTime? timestamp,
  }) {
    final now = timestamp ?? DateTime.now();
    final attemptUuid = explicitAttemptUuid ?? _uuid.v4();
    final conceptTitle =
        _contentRepo.getConceptById(question.conceptId)?.title ??
            question.chapterId;

    _db.db.execute('BEGIN TRANSACTION;');
    try {
      _db.db.execute(
        '''
        INSERT OR IGNORE INTO question_attempts (
          attempt_uuid, programme_id, question_id, chapter_id, subject_id,
          concept_id, difficulty, is_correct, self_score_marks, max_marks,
          hints_used, time_spent_sec, attempted_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?);
        ''',
        [
          attemptUuid,
          question.programmeId.id,
          question.id,
          question.chapterId,
          question.subjectId,
          question.conceptId,
          question.difficulty,
          isCorrect ? 1 : 0,
          selfScoreMarks,
          question.marks,
          hintsUsed,
          timeSpentSec,
          now.toIso8601String(),
        ],
      );

      // Guard idempotency: if attempt_uuid already existed, skip all
      // downstream mutations (spaced repetition, sync outbox, daily goal).
      if (_db.db.updatedRows == 0) {
        _db.db.execute('COMMIT;');
        return;
      }

      final existingRev = getRevisionForConcept(question.conceptId);
      final nextRev = SpacedRepetitionCalculator.computeNext(
        existing: existingRev,
        conceptId: question.conceptId,
        chapterId: question.chapterId,
        subjectId: question.subjectId,
        conceptTitle: conceptTitle,
        isCorrect: isCorrect,
        now: now,
      );

      _db.db.execute(
        '''
        INSERT INTO revision_schedule (
          concept_id, chapter_id, subject_id, concept_title,
          interval_days, consecutive_correct, mistake_count,
          next_review_at, last_reviewed_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(concept_id) DO UPDATE SET
          interval_days = excluded.interval_days,
          consecutive_correct = excluded.consecutive_correct,
          mistake_count = excluded.mistake_count,
          next_review_at = excluded.next_review_at,
          last_reviewed_at = excluded.last_reviewed_at;
        ''',
        [
          nextRev.conceptId,
          nextRev.chapterId,
          nextRev.subjectId,
          nextRev.conceptTitle,
          nextRev.intervalDays,
          nextRev.consecutiveCorrect,
          nextRev.mistakeCount,
          nextRev.nextReviewAt.toIso8601String(),
          nextRev.lastReviewedAt.toIso8601String(),
        ],
      );

      final outboxPayload = jsonEncode({
        'attemptUuid': attemptUuid,
        'questionId': question.id,
        'isCorrect': isCorrect,
        'hintsUsed': hintsUsed,
        'timeSpentSec': timeSpentSec,
        'attemptedAt': now.toUtc().toIso8601String(),
      });

      _db.db.execute(
        '''
        INSERT OR IGNORE INTO sync_outbox (attempt_uuid, payload_json, status, created_at)
        VALUES (?, ?, 'pending', ?);
        ''',
        [attemptUuid, outboxPayload, now.toIso8601String()],
      );

      _incrementDailyProgressInTx(addQuestions: 1, addLessons: 0, now: now);

      _db.db.execute('COMMIT;');
    } catch (e) {
      _db.db.execute('ROLLBACK;');
      rethrow;
    }
  }

  DailyGoalProgress getDailyGoalProgress({DateTime? now}) {
    final refNow = now ?? DateTime.now();
    final rows = _db.db.select(
      'SELECT * FROM daily_progress ORDER BY date_iso DESC LIMIT 1;',
    );
    if (rows.isEmpty) {
      return ForgivingStreakCalculator.rolloverToDate(now: refNow);
    }
    final r = rows.first;
    final latest = DailyGoalProgress(
      dateIso: r['date_iso'] as String,
      questionsCompleted: r['questions_completed'] as int,
      lessonsCompleted: r['lessons_completed'] as int,
      streakDays: r['streak_days'] as int,
      graceFreezesRemaining: r['grace_freezes_remaining'] as int,
      dailyBoardDone: (r['daily_board_done'] as int) == 1,
      dailyMdcatDone: (r['daily_mdcat_done'] as int) == 1,
    );
    return ForgivingStreakCalculator.rolloverToDate(
      previous: latest,
      now: refNow,
    );
  }

  void recordDailyChallengeCompletion(ProgrammeId programmeId, {DateTime? now}) {
    final refNow = now ?? DateTime.now();
    _db.db.execute('BEGIN TRANSACTION;');
    try {
      _incrementDailyProgressInTx(
        addQuestions: 0,
        addLessons: 1,
        now: refNow,
        markBoardDone: programmeId == ProgrammeId.sscHssc,
        markMdcatDone: programmeId == ProgrammeId.mdcat,
      );
      _db.db.execute('COMMIT;');
    } catch (e) {
      _db.db.execute('ROLLBACK;');
      rethrow;
    }
  }

  void _incrementDailyProgressInTx({
    required int addQuestions,
    required int addLessons,
    required DateTime now,
    bool markBoardDone = false,
    bool markMdcatDone = false,
  }) {
    final current = getDailyGoalProgress(now: now);
    final wasGoalDone = current.isGoalCompleted;
    final nextQs = current.questionsCompleted + addQuestions;
    final nextLessons = current.lessonsCompleted + addLessons;
    final isNowDone =
        nextQs >= DailyGoalProgress.dailyQuestionTarget || nextLessons >= 1;
    final nextStreak = (!wasGoalDone && isNowDone)
        ? current.streakDays + 1
        : (current.streakDays == 0 ? 1 : current.streakDays);

    _db.db.execute(
      '''
      INSERT INTO daily_progress (
        date_iso, questions_completed, lessons_completed, streak_days,
        grace_freezes_remaining, daily_board_done, daily_mdcat_done
      ) VALUES (?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(date_iso) DO UPDATE SET
        questions_completed = excluded.questions_completed,
        lessons_completed = excluded.lessons_completed,
        streak_days = excluded.streak_days,
        grace_freezes_remaining = excluded.grace_freezes_remaining,
        daily_board_done = MAX(daily_progress.daily_board_done, excluded.daily_board_done),
        daily_mdcat_done = MAX(daily_progress.daily_mdcat_done, excluded.daily_mdcat_done);
      ''',
      [
        current.dateIso,
        nextQs,
        nextLessons,
        nextStreak,
        current.graceFreezesRemaining,
        (current.dailyBoardDone || markBoardDone) ? 1 : 0,
        (current.dailyMdcatDone || markMdcatDone) ? 1 : 0,
      ],
    );
  }

  RevisionItem? getRevisionForConcept(String conceptId) {
    final rows = _db.db.select(
      'SELECT * FROM revision_schedule WHERE concept_id = ?;',
      [conceptId],
    );
    if (rows.isEmpty) return null;
    return _rowToRevision(rows.first);
  }

  void saveMockExamResult({
    required MockExamDefinition exam,
    required String boardId,
    required int score,
    required int maxScore,
    required int durationSec,
  }) {
    _db.db.execute(
      '''
      INSERT INTO mock_exam_results (
        id, programme_id, exam_id, title, board_id, score, max_score, duration_sec, completed_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?);
      ''',
      [
        _uuid.v4(),
        exam.programmeId.id,
        exam.id,
        exam.title,
        boardId,
        score,
        maxScore,
        durationSec,
        DateTime.now().toIso8601String(),
      ],
    );
  }

  OverallProgressReport buildReport({
    required ProgrammeId programmeId,
    DateTime? now,
  }) {
    final referenceNow = now ?? DateTime.now();

    final programmeChapterIds = _contentRepo
        .getPacksForProgramme(programmeId)
        .map((p) => p.chapterId)
        .toSet();

    final readRows = _db.db.select(
      'SELECT DISTINCT concept_id, chapter_id FROM reading_progress WHERE is_completed = 1;',
    );
    final topicsStudied = readRows
        .where((r) => programmeChapterIds.contains(r['chapter_id'] as String))
        .map((r) => r['concept_id'] as String)
        .toSet()
        .length;

    final attemptStats = _db.db.select(
      '''
      SELECT
        COUNT(*) AS total,
        COALESCE(SUM(is_correct), 0) AS correct,
        COALESCE(SUM(time_spent_sec), 0) AS sec
      FROM question_attempts
      WHERE programme_id = ?;
      ''',
      [programmeId.id],
    ).first;

    final revRows = _db.db.select(
      'SELECT * FROM revision_schedule ORDER BY next_review_at ASC;',
    );
    final allRevisions = revRows.map(_rowToRevision).toList(growable: false);

    final filteredRevisions = allRevisions
        .where((r) => programmeChapterIds.contains(r.chapterId))
        .toList(growable: false);

    final dueRevisions = filteredRevisions
        .where((r) => r.isDue(now: referenceNow))
        .toList(growable: false);

    final weakConcepts = filteredRevisions
        .where((r) => r.mistakeCount > 0 && r.consecutiveCorrect < 2)
        .toList(growable: false);

    final chapterSummaries = _contentRepo.getPacksForProgramme(programmeId).map((pack) {
      final row = _db.db.select(
        '''
        SELECT COUNT(*) AS total, COALESCE(SUM(is_correct), 0) AS correct
        FROM question_attempts
        WHERE programme_id = ? AND chapter_id = ?;
        ''',
        [programmeId.id, pack.chapterId],
      ).first;

      return ChapterMasterySummary(
        chapterId: pack.chapterId,
        chapterTitle: pack.title,
        subjectId: pack.subjectId,
        attemptedCount: row['total'] as int? ?? 0,
        correctCount: row['correct'] as int? ?? 0,
        totalQuestionsInChapter: pack.questions.length,
      );
    }).toList(growable: false);

    final mockRows = _db.db.select(
      'SELECT * FROM mock_exam_results WHERE programme_id = ? ORDER BY completed_at DESC LIMIT 10;',
      [programmeId.id],
    );
    final mockScores = mockRows
        .map(
          (r) => MockScoreEntry(
            id: r['id'] as String,
            title: r['title'] as String,
            score: r['score'] as int,
            maxScore: r['max_score'] as int,
            completedAt: DateTime.parse(r['completed_at'] as String),
          ),
        )
        .toList(growable: false);

    return OverallProgressReport(
      topicsStudied: topicsStudied,
      questionsAttempted: attemptStats['total'] as int? ?? 0,
      correctAttempts: attemptStats['correct'] as int? ?? 0,
      totalTimeSpentSec: attemptStats['sec'] as int? ?? 0,
      dueRevisions: dueRevisions,
      weakConcepts: weakConcepts,
      chapterSummaries: chapterSummaries,
      mockScores: mockScores,
    );
  }

  int pendingOutboxCount() {
    final row = _db.db.select(
      "SELECT COUNT(*) AS cnt FROM sync_outbox WHERE status = 'pending';",
    ).first;
    return row['cnt'] as int? ?? 0;
  }

  RevisionItem _rowToRevision(Map<String, Object?> r) {
    return RevisionItem(
      conceptId: r['concept_id'] as String,
      chapterId: r['chapter_id'] as String,
      subjectId: r['subject_id'] as String,
      conceptTitle: r['concept_title'] as String,
      intervalDays: r['interval_days'] as int,
      consecutiveCorrect: r['consecutive_correct'] as int,
      mistakeCount: r['mistake_count'] as int,
      nextReviewAt: DateTime.parse(r['next_review_at'] as String),
      lastReviewedAt: DateTime.parse(r['last_reviewed_at'] as String),
    );
  }
}

final progressRepositoryProvider = Provider<ProgressRepository>((ref) {
  return ProgressRepository(
    ref.watch(localDatabaseProvider),
    ref.watch(contentRepositoryProvider),
  );
});
