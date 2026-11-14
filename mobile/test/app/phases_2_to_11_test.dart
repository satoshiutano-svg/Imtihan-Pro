import 'dart:convert';

import 'package:crypto/crypto.dart';
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
import 'package:roshan_study/core/widgets/math_graph_view.dart';
import 'package:roshan_study/core/widgets/math_text.dart';
import 'package:roshan_study/core/widgets/motion_graphic_player.dart';
import 'package:roshan_study/core/widgets/motion_system.dart';
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

  group('Phase 12 — Unlimited Dynamic Cloud Packs & Offline Visual Widgets', () {
    test('hydrates dynamic cloud ChapterPack JSON from SQLite and supports searchPacks', () {
      final db = LocalDatabase.inMemory();
      addTearDown(db.close);
      final repo = ContentRepository(db);

      final cloudMap = <String, dynamic>{
        'chapterId': 'math_10_ch1_cloud',
        'programmeId': 'ssc_hssc',
        'grade': 10,
        'subjectId': 'math_10',
        'subjectName': 'Mathematics',
        'chapterNumber': 1,
        'title': 'Quadratic Equations (Cloud Pack)',
        'packVersion': 2,
        'estimatedSizeKb': 110,
        'learningOutcomes': ['Solve quadratic equations by completing square and formula.'],
        'concepts': [
          {
            'id': 'c_math_10_1_cloud',
            'chapterId': 'math_10_ch1_cloud',
            'topicId': 't_math_10_1',
            'orderIndex': 1,
            'title': 'Quadratic Formula',
            'simpleExplanation': r'Roots of $ax^2 + bx + c = 0$ are $x = \frac{-b \pm \sqrt{b^2-4ac}}{2a}$.',
            'formulas': [
              {
                'expression': r'$$x = \frac{-b \pm \sqrt{b^2 - 4ac}}{2a}$$',
                'description': 'Standard quadratic formula',
              },
            ],
            'sourceBook': 'KPECTB Mathematics Grade 10',
            'sourcePage': 'Ch. 1, p. 12',
          },
        ],
        'questions': [
          {
            'id': 'q_math_10_1_cloud',
            'programmeId': 'ssc_hssc',
            'grade': 10,
            'subjectId': 'math_10',
            'chapterId': 'math_10_ch1_cloud',
            'topicId': 't_math_10_1',
            'conceptId': 'c_math_10_1_cloud',
            'questionType': 'mcq',
            'difficulty': 2,
            'statement': r'If discriminant $b^2 - 4ac = 0$, the roots are:',
            'options': ['Real and equal', 'Imaginary', 'Unequal', 'Undefined'],
            'correctAnswer': 'Real and equal',
            'explanation': r'When $b^2 - 4ac = 0$, both roots equal $\frac{-b}{2a}$.',
            'marks': 1,
          },
        ],
      };

      final rawJson = jsonEncode(cloudMap);
      final sha = sha256.convert(utf8.encode(rawJson)).toString();
      final pack = ChapterPack.fromJson(cloudMap);
      repo.saveVerifiedChapterPack(pack: pack, rawJson: rawJson, expectedSha256: sha);

      final hydrated = repo.getPackById('math_10_ch1_cloud');
      expect(hydrated, isNotNull);
      expect(hydrated!.title, 'Quadratic Equations (Cloud Pack)');
      expect(repo.getConceptById('c_math_10_1_cloud'), isNotNull);
      expect(repo.getQuestionById('q_math_10_1_cloud'), isNotNull);

      final matches = repo.searchPacks(
        programmeId: ProgrammeId.sscHssc,
        query: 'quadratic',
        grade: 10,
      );
      expect(matches.length, 1);
      expect(matches.first.chapterId, 'math_10_ch1_cloud');
    });

    testWidgets('renders MathText, MotionGraphicPlayer, and MathGraphView offline', (tester) async {
      const motionSpec = MotionGraphicSpec(
        id: 'mg_test',
        title: 'Test Kinematics Scene',
        caption: r'Velocity $v = \frac{s}{t}$',
        durationSec: 4,
        sceneType: 'kinematics_track',
        actors: [
          MotionActor(
            id: 'car',
            label: 'Car',
            shape: 'box',
            colorToken: VisualColorToken.primary,
            startX: 10,
            startY: 50,
            endX: 90,
            endY: 50,
          ),
        ],
        stages: [
          MotionStage(
            atPercent: 0,
            label: 'Start',
            formulaLatex: r'v_i = 0',
            callout: 'At origin',
          ),
          MotionStage(
            atPercent: 100,
            label: 'End',
            formulaLatex: r'v_f = 20\text{ m/s}',
            callout: 'Final velocity',
          ),
        ],
      );

      const graphSpec = GraphSpec(
        id: 'gr_test',
        title: 'Test Velocity Graph',
        caption: 'Linear uniform acceleration',
        xLabel: 't (s)',
        yLabel: 'v (m/s)',
        xMin: 0,
        xMax: 10,
        yMin: 0,
        yMax: 20,
        series: [
          GraphSeries(
            name: 'v(t)',
            colorToken: VisualColorToken.primary,
            showArea: true,
            points: [
              GraphPoint(x: 0, y: 0),
              GraphPoint(x: 10, y: 20),
            ],
          ),
        ],
        highlights: [GraphHighlight(x: 5, y: 10, label: 'Midpoint')],
      );

      await tester.pumpWidget(
        const MaterialApp(
          home: Scaffold(
            body: SingleChildScrollView(
              child: Column(
                children: [
                  MathText(r'Formula: $$a = \frac{v_f - v_i}{t}$$'),
                  MotionGraphicPlayer(spec: motionSpec),
                  MathGraphView(spec: graphSpec),
                ],
              ),
            ),
          ),
        ),
      );
      await tester.pump(const Duration(milliseconds: 100));

      expect(find.text('Test Kinematics Scene'), findsOneWidget);
      expect(find.text('Test Velocity Graph'), findsOneWidget);
      expect(find.text('Midpoint'), findsOneWidget);
    });
  });

  group('Phase 13 — Extended Formats, Onboarding Goal & Motion System', () {
    test('validates multi_select, true_false, and matching answers without substring leaks', () {
      expect(
        AnswerMatcher.isMatch(
          userRaw: 'Velocity||Displacement',
          expectedRaw: 'Displacement||Velocity',
          type: QuestionType.multiSelect,
        ),
        isTrue,
      );
      expect(
        AnswerMatcher.isMatch(
          userRaw: 'Velocity',
          expectedRaw: 'Displacement||Velocity',
          type: QuestionType.multiSelect,
        ),
        isFalse,
      );
      expect(
        AnswerMatcher.isMatch(
          userRaw: 't',
          expectedRaw: 'True',
          type: QuestionType.trueFalse,
        ),
        isTrue,
      );
      expect(
        AnswerMatcher.isMatch(
          userRaw: 'Speed->m/s||Acceleration->m/s^2',
          expectedRaw: 'Acceleration->m/s^2||Speed->m/s',
          type: QuestionType.matching,
        ),
        isTrue,
      );
    });

    test('persists dailyQuestionTarget and parses chapterIntro & extended question formats', () {
      final db = LocalDatabase.inMemory();
      addTearDown(db.close);
      final profileRepo = ProfileRepository(db);
      final initial = profileRepo.loadOrCreateProfile();
      profileRepo.saveProfile(initial.copyWith(dailyQuestionTarget: 15));
      expect(profileRepo.loadOrCreateProfile().dailyQuestionTarget, 15);

      final pack = ChapterPack.fromJson(<String, dynamic>{
        'chapterId': 'phy_9_ch_ext',
        'programmeId': 'ssc_hssc',
        'grade': 9,
        'subjectId': 'phy_9',
        'chapterNumber': 1,
        'title': 'Physical Quantities',
        'packVersion': 1,
        'estimatedSizeKb': 95,
        'chapterIntro': 'Introduces SI units and precision instruments.',
        'prerequisites': ['Basic algebra', 'Metric prefixes'],
        'learningOutcomes': ['Distinguish base and derived units.'],
        'concepts': const <Map<String, dynamic>>[],
        'questions': <Map<String, dynamic>>[
          <String, dynamic>{
            'id': 'q_ms_1',
            'programmeId': 'ssc_hssc',
            'grade': 9,
            'subjectId': 'phy_9',
            'chapterId': 'phy_9_ch_ext',
            'topicId': 't1',
            'conceptId': 'c1',
            'questionType': 'multi_select',
            'difficulty': 2,
            'statement': 'Select SI base units:',
            'options': ['metre', 'newton', 'kilogram'],
            'multiSelectAnswers': ['metre', 'kilogram'],
            'correctAnswer': 'metre||kilogram',
            'explanation': 'Metre and kilogram are base units.',
            'marks': 2,
          },
          <String, dynamic>{
            'id': 'q_match_1',
            'programmeId': 'ssc_hssc',
            'grade': 9,
            'subjectId': 'phy_9',
            'chapterId': 'phy_9_ch_ext',
            'topicId': 't1',
            'conceptId': 'c1',
            'questionType': 'matching',
            'difficulty': 3,
            'statement': 'Match quantity with SI unit:',
            'matchingPairs': [
              {'left': 'Length', 'right': 'm'},
              {'left': 'Mass', 'right': 'kg'},
            ],
            'correctAnswer': 'Length->m||Mass->kg',
            'explanation': 'SI base units for length and mass.',
            'marks': 2,
          },
        ],
      });

      expect(pack.chapterIntro, 'Introduces SI units and precision instruments.');
      expect(pack.prerequisites.length, 2);
      expect(pack.questions[0].type, QuestionType.multiSelect);
      expect(pack.questions[0].multiSelectAnswers, ['metre', 'kilogram']);
      expect(pack.questions[1].matchingPairs.length, 2);
    });

    testWidgets('MotionSystem renders cleanly under disableAnimations reduced motion',
        (tester) async {
      await tester.pumpWidget(
        const MediaQuery(
          data: MediaQueryData(disableAnimations: true),
          child: MaterialApp(
            home: Scaffold(
              body: Column(
                children: [
                  AnimatedProgressTrack(value: 0.6),
                  MotionEntrance(child: Text('Reduced motion ready')),
                  MotionExpandable(
                    expanded: true,
                    child: Text('Hint details'),
                  ),
                ],
              ),
            ),
          ),
        ),
      );
      await tester.pumpAndSettle();

      expect(find.text('Reduced motion ready'), findsOneWidget);
      expect(find.text('Hint details'), findsOneWidget);
      expect(tester.takeException(), isNull);
    });
  });
}
