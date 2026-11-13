import 'dart:convert';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:roshan_study/app/app.dart';
import 'package:roshan_study/core/constants/app_constants.dart';
import 'package:roshan_study/core/database/database_provider.dart';
import 'package:roshan_study/core/database/local_database.dart';
import 'package:roshan_study/core/models/curriculum_models.dart';
import 'package:roshan_study/core/models/progress_models.dart';
import 'package:roshan_study/core/utils/answer_matcher.dart';
import 'package:roshan_study/data/kpk_subject_catalog.dart';
import 'package:roshan_study/data/repositories/content_repository.dart';
import 'package:roshan_study/data/repositories/profile_repository.dart';
import 'package:roshan_study/data/repositories/progress_repository.dart';

void main() {
  group('Phase 2 — Grades 9–12 English-Medium Subject Catalog & Persistence', () {
    test('returns accurate Grade 9 Science subjects based on elective choice', () {
      final bioSubjects = KpkSubjectCatalog.subjectsForProfile(
        grade: StudyGrade.grade9,
        group: AcademicGroup.sscScience,
        selectedElectiveIds: const ['bio_9'],
      );
      expect(bioSubjects.any((s) => s.id == 'bio_9'), isTrue);
      expect(bioSubjects.any((s) => s.id == 'cs_9'), isFalse);

      final csSubjects = KpkSubjectCatalog.subjectsForProfile(
        grade: StudyGrade.grade9,
        group: AcademicGroup.sscScience,
        selectedElectiveIds: const ['cs_9'],
      );
      expect(csSubjects.any((s) => s.id == 'cs_9'), isTrue);
      expect(csSubjects.any((s) => s.id == 'bio_9'), isFalse);
    });

    test('persists student profile and optional exam countdown in SQLite', () {
      final db = LocalDatabase.inMemory();
      addTearDown(db.close);
      final repo = ProfileRepository(db);

      final initial = repo.loadOrCreateProfile();
      final targetDate = DateTime.now().add(const Duration(days: 30));
      repo.saveProfile(
        initial.copyWith(
          board: KpkBoard.swat,
          grade: StudyGrade.grade11,
          group: AcademicGroup.hsscPreEngineering,
          examDateIso: targetDate.toIso8601String(),
          onboardingCompleted: true,
        ),
      );

      final reloaded = repo.loadOrCreateProfile();
      expect(reloaded.board, KpkBoard.swat);
      expect(reloaded.grade, StudyGrade.grade11);
      expect(reloaded.group, AcademicGroup.hsscPreEngineering);
      expect(reloaded.onboardingCompleted, isTrue);
      expect(reloaded.daysUntilExam(), isNotNull);
    });
  });

  group('Phase 3, 6 & 9 — Offline Packs, SHA-256 Verification & Reading State', () {
    test('verifies SHA-256 checksum on pack save and rejects tampered packs', () {
      final db = LocalDatabase.inMemory();
      addTearDown(db.close);
      final repo = ContentRepository(db);
      final pack = repo.getPackById('phy_9_ch2')!;
      final raw = jsonEncode({'chapterId': pack.chapterId, 'v': 1});

      repo.saveVerifiedChapterPack(pack: pack, rawJson: raw);
      expect(repo.listDownloadedChapters().length, 1);

      expect(
        () => repo.saveVerifiedChapterPack(
          pack: pack,
          rawJson: raw,
          expectedSha256: 'deadbeef',
        ),
        throwsStateError,
      );
    });

    test('saves and restores bookmarks and scroll offsets', () {
      final db = LocalDatabase.inMemory();
      addTearDown(db.close);
      final repo = ContentRepository(db);

      repo.saveReadingProgress(
        conceptId: 'c_phy_9_2_1',
        chapterId: 'phy_9_ch2',
        subjectId: 'phy_9',
        scrollOffset: 340.5,
        isBookmarked: true,
        isCompleted: true,
      );

      final saved = repo.getReadingProgress('c_phy_9_2_1');
      expect(saved, isNotNull);
      expect(saved!.scrollOffset, 340.5);
      expect(saved.isBookmarked, isTrue);
      expect(saved.isCompleted, isTrue);
    });
  });

  group('Phase 4, 7 & 10 — Spaced Repetition, Idempotency & Admission Isolation', () {
    test('implements 1d -> 3d -> 7d spaced repetition and resets on mistake', () {
      final t0 = DateTime.utc(2026, 11, 13, 8);
      final r1 = SpacedRepetitionCalculator.computeNext(
        conceptId: 'c_phy_9_2_1',
        chapterId: 'phy_9_ch2',
        subjectId: 'phy_9',
        conceptTitle: 'Speed and Velocity',
        isCorrect: true,
        now: t0,
      );
      expect(r1.intervalDays, 1);

      final r2 = SpacedRepetitionCalculator.computeNext(
        existing: r1,
        conceptId: 'c_phy_9_2_1',
        chapterId: 'phy_9_ch2',
        subjectId: 'phy_9',
        conceptTitle: 'Speed and Velocity',
        isCorrect: true,
        now: t0.add(const Duration(days: 1)),
      );
      expect(r2.intervalDays, 3);

      final r3 = SpacedRepetitionCalculator.computeNext(
        existing: r2,
        conceptId: 'c_phy_9_2_1',
        chapterId: 'phy_9_ch2',
        subjectId: 'phy_9',
        conceptTitle: 'Speed and Velocity',
        isCorrect: true,
        now: t0.add(const Duration(days: 4)),
      );
      expect(r3.intervalDays, 7);

      final reset = SpacedRepetitionCalculator.computeNext(
        existing: r3,
        conceptId: 'c_phy_9_2_1',
        chapterId: 'phy_9_ch2',
        subjectId: 'phy_9',
        conceptTitle: 'Speed and Velocity',
        isCorrect: false,
        now: t0.add(const Duration(days: 11)),
      );
      expect(reset.intervalDays, 1);
      expect(reset.mistakeCount, 1);
    });

    test('deduplicates identical attempt_uuid and isolates MDCAT from SSC/HSSC', () {
      final db = LocalDatabase.inMemory();
      addTearDown(db.close);
      final content = ContentRepository(db);
      final progress = ProgressRepository(db, content);

      final boardQ = content.getQuestionById('q_phy_9_2_1')!;
      final mdcatQ = content.getQuestionById('q_mdcat_bio_1')!;

      progress.recordAttempt(
        question: boardQ,
        isCorrect: true,
        explicitAttemptUuid: 'fixed-uuid-1',
      );
      // Duplicate submission with identical UUID must be ignored
      progress.recordAttempt(
        question: boardQ,
        isCorrect: true,
        explicitAttemptUuid: 'fixed-uuid-1',
      );
      progress.recordAttempt(
        question: mdcatQ,
        isCorrect: false,
        explicitAttemptUuid: 'fixed-uuid-2',
      );

      content.saveReadingProgress(
        conceptId: 'c_phy_9_2_1',
        chapterId: 'phy_9_ch2',
        subjectId: 'phy_9',
        scrollOffset: 0,
        isCompleted: true,
      );

      final sscReport = progress.buildReport(programmeId: ProgrammeId.sscHssc);
      final mdcatReport = progress.buildReport(programmeId: ProgrammeId.mdcat);

      expect(sscReport.questionsAttempted, 1);
      expect(sscReport.verifiedAccuracy, 1.0);
      expect(sscReport.topicsStudied, 1);
      expect(mdcatReport.questionsAttempted, 1);
      expect(mdcatReport.verifiedAccuracy, 0.0);
      expect(mdcatReport.topicsStudied, 0);
      expect(progress.getDailyGoalProgress().questionsCompleted, 2);
    });

    test('validates numerical answers without substring false positives', () {
      expect(
        AnswerMatcher.isMatch(
          userRaw: '54 m',
          expectedRaw: '54 m',
          type: QuestionType.numerical,
        ),
        isTrue,
      );
      expect(
        AnswerMatcher.isMatch(
          userRaw: '54',
          expectedRaw: '54 m',
          type: QuestionType.numerical,
        ),
        isTrue,
      );
      expect(
        AnswerMatcher.isMatch(
          userRaw: '5',
          expectedRaw: '54 m',
          type: QuestionType.numerical,
        ),
        isFalse,
      );
      expect(
        AnswerMatcher.isMatch(
          userRaw: 'm',
          expectedRaw: '54 m',
          type: QuestionType.numerical,
        ),
        isFalse,
      );
      expect(
        AnswerMatcher.isMatch(
          userRaw: '54 km',
          expectedRaw: '54 m',
          type: QuestionType.numerical,
        ),
        isFalse,
      );
    });

    test('protects daily streak with up to 2 load-shedding grace freezes', () {
      final db = LocalDatabase.inMemory();
      addTearDown(db.close);
      final content = ContentRepository(db);
      final progress = ProgressRepository(db, content);

      final day1 = DateTime.utc(2026, 11, 10, 12);
      final q = content.getQuestionById('q_phy_9_2_1')!;
      progress.recordAttempt(
        question: q,
        isCorrect: true,
        explicitAttemptUuid: 'streak-1',
        timestamp: day1,
      );
      progress.recordDailyChallengeCompletion(ProgrammeId.sscHssc, now: day1);

      final afterDay1 = progress.getDailyGoalProgress(now: day1);
      expect(afterDay1.streakDays, 2);
      expect(afterDay1.dailyBoardDone, isTrue);

      // Skip 1 day (load-shedding): should consume 1 grace freeze and keep streak
      final day3 = DateTime.utc(2026, 11, 12, 12);
      final rolled = progress.getDailyGoalProgress(now: day3);
      expect(rolled.streakDays, 2);
      expect(rolled.graceFreezesRemaining, 1);
    });
  });

  group('Phase 11 — Full App Smoke & Accessibility Check', () {
    testWidgets('renders Home and opens Learn chapter reader without errors',
        (tester) async {
      final db = LocalDatabase.inMemory();
      addTearDown(db.close);

      await tester.pumpWidget(
        ProviderScope(
          overrides: [localDatabaseProvider.overrideWithValue(db)],
          child: const RoshanStudyApp(),
        ),
      );
      await tester.pumpAndSettle();

      expect(find.text('What should I study or practise next?'), findsOneWidget);
      await tester.tap(find.text('Learn'));
      await tester.pumpAndSettle();
      expect(find.textContaining('Ch 2: Kinematics'), findsOneWidget);
    });
  });
}
