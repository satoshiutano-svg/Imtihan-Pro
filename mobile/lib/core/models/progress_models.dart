class PracticeAttempt {
  const PracticeAttempt({
    required this.attemptUuid,
    required this.programmeId,
    required this.questionId,
    required this.chapterId,
    required this.subjectId,
    required this.conceptId,
    required this.difficulty,
    required this.isCorrect,
    this.selfScoreMarks,
    this.maxMarks = 1,
    this.hintsUsed = 0,
    this.timeSpentSec = 0,
    required this.attemptedAt,
  });

  final String attemptUuid;
  final String programmeId;
  final String questionId;
  final String chapterId;
  final String subjectId;
  final String conceptId;
  final int difficulty;
  final bool isCorrect;
  final int? selfScoreMarks;
  final int maxMarks;
  final int hintsUsed;
  final int timeSpentSec;
  final DateTime attemptedAt;
}

class RevisionItem {
  const RevisionItem({
    required this.conceptId,
    required this.chapterId,
    required this.subjectId,
    required this.conceptTitle,
    required this.intervalDays,
    required this.consecutiveCorrect,
    required this.mistakeCount,
    required this.nextReviewAt,
    required this.lastReviewedAt,
  });

  final String conceptId;
  final String chapterId;
  final String subjectId;
  final String conceptTitle;
  final int intervalDays;
  final int consecutiveCorrect;
  final int mistakeCount;
  final DateTime nextReviewAt;
  final DateTime lastReviewedAt;

  bool isDue({DateTime? now}) {
    final reference = now ?? DateTime.now();
    return !nextReviewAt.isAfter(reference);
  }
}

class ChapterMasterySummary {
  const ChapterMasterySummary({
    required this.chapterId,
    required this.chapterTitle,
    required this.subjectId,
    required this.attemptedCount,
    required this.correctCount,
    required this.totalQuestionsInChapter,
  });

  final String chapterId;
  final String chapterTitle;
  final String subjectId;
  final int attemptedCount;
  final int correctCount;
  final int totalQuestionsInChapter;

  /// Verified accuracy only; returns null when zero attempts exist so UI
  /// never invents misleading 0% or fake mastery percentages.
  double? get verifiedAccuracy =>
      attemptedCount == 0 ? null : correctCount / attemptedCount;
}

class OverallProgressReport {
  const OverallProgressReport({
    required this.topicsStudied,
    required this.questionsAttempted,
    required this.correctAttempts,
    required this.totalTimeSpentSec,
    required this.dueRevisions,
    required this.weakConcepts,
    required this.chapterSummaries,
    required this.mockScores,
  });

  final int topicsStudied;
  final int questionsAttempted;
  final int correctAttempts;
  final int totalTimeSpentSec;
  final List<RevisionItem> dueRevisions;
  final List<RevisionItem> weakConcepts;
  final List<ChapterMasterySummary> chapterSummaries;
  final List<MockScoreEntry> mockScores;

  double? get verifiedAccuracy =>
      questionsAttempted == 0 ? null : correctAttempts / questionsAttempted;
}

class MockScoreEntry {
  const MockScoreEntry({
    required this.id,
    required this.title,
    required this.score,
    required this.maxScore,
    required this.completedAt,
  });

  final String id;
  final String title;
  final int score;
  final int maxScore;
  final DateTime completedAt;
}

/// Spaced repetition engine implementing initial 1d -> 3d -> 7d intervals
/// and adaptive resets on incorrect recall.
class SpacedRepetitionCalculator {
  const SpacedRepetitionCalculator._();

  static const List<int> initialScheduleDays = [1, 3, 7, 14, 30];

  static RevisionItem computeNext({
    RevisionItem? existing,
    required String conceptId,
    required String chapterId,
    required String subjectId,
    required String conceptTitle,
    required bool isCorrect,
    required DateTime now,
  }) {
    if (!isCorrect) {
      return RevisionItem(
        conceptId: conceptId,
        chapterId: chapterId,
        subjectId: subjectId,
        conceptTitle: conceptTitle,
        intervalDays: 1,
        consecutiveCorrect: 0,
        mistakeCount: (existing?.mistakeCount ?? 0) + 1,
        nextReviewAt: now.add(const Duration(days: 1)),
        lastReviewedAt: now,
      );
    }

    final nextStreak = (existing?.consecutiveCorrect ?? 0) + 1;
    final idx = (nextStreak - 1).clamp(0, initialScheduleDays.length - 1);
    final nextInterval = initialScheduleDays[idx];

    return RevisionItem(
      conceptId: conceptId,
      chapterId: chapterId,
      subjectId: subjectId,
      conceptTitle: conceptTitle,
      intervalDays: nextInterval,
      consecutiveCorrect: nextStreak,
      mistakeCount: existing?.mistakeCount ?? 0,
      nextReviewAt: now.add(Duration(days: nextInterval)),
      lastReviewedAt: now,
    );
  }
}

class DailyGoalProgress {
  const DailyGoalProgress({
    required this.dateIso,
    required this.questionsCompleted,
    required this.lessonsCompleted,
    required this.streakDays,
    required this.graceFreezesRemaining,
    this.dailyBoardDone = false,
    this.dailyMdcatDone = false,
  });

  final String dateIso;
  final int questionsCompleted;
  final int lessonsCompleted;
  final int streakDays;
  final int graceFreezesRemaining;
  final bool dailyBoardDone;
  final bool dailyMdcatDone;

  static const int dailyQuestionTarget = 10;

  bool get isGoalCompleted =>
      questionsCompleted >= dailyQuestionTarget || lessonsCompleted >= 1;

  double get completionFraction {
    if (isGoalCompleted) return 1.0;
    return (questionsCompleted / dailyQuestionTarget).clamp(0.0, 1.0);
  }
}

/// Forgiving streak calculator supporting up to 2 automatic grace freezes
/// so power load-shedding or exam days never unfairly wipe a student's streak.
class ForgivingStreakCalculator {
  const ForgivingStreakCalculator._();

  static String formatDateIso(DateTime dt) {
    final local = dt.toLocal();
    final y = local.year.toString().padLeft(4, '0');
    final m = local.month.toString().padLeft(2, '0');
    final d = local.day.toString().padLeft(2, '0');
    return '$y-$m-$d';
  }

  static DailyGoalProgress rolloverToDate({
    DailyGoalProgress? previous,
    required DateTime now,
  }) {
    final todayIso = formatDateIso(now);
    if (previous == null) {
      return DailyGoalProgress(
        dateIso: todayIso,
        questionsCompleted: 0,
        lessonsCompleted: 0,
        streakDays: 0,
        graceFreezesRemaining: 2,
      );
    }
    if (previous.dateIso == todayIso) {
      return previous;
    }

    final prevDate = DateTime.parse('${previous.dateIso}T00:00:00Z');
    final currDate = DateTime.parse('${todayIso}T00:00:00Z');
    final gapDays = currDate.difference(prevDate).inDays;

    var nextStreak = previous.streakDays;
    var nextFreezes = previous.graceFreezesRemaining;

    if (gapDays > 1) {
      final missedDays = gapDays - 1;
      if (missedDays <= nextFreezes) {
        nextFreezes -= missedDays;
      } else {
        nextStreak = 0;
        nextFreezes = 2;
      }
    }

    return DailyGoalProgress(
      dateIso: todayIso,
      questionsCompleted: 0,
      lessonsCompleted: 0,
      streakDays: nextStreak,
      graceFreezesRemaining: nextFreezes,
    );
  }
}

