import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:roshan_study/app/app.dart';
import 'package:roshan_study/app/theme/app_colors.dart';
import 'package:roshan_study/app/theme/app_theme.dart';
import 'package:roshan_study/core/constants/app_constants.dart';
import 'package:roshan_study/core/widgets/rtl_aware_text.dart';

void main() {
  group('Phase 1 — Domain Constants & Theme Tokens', () {
    test('supports all 8 KPK BISE boards and Grades 9–12 groups', () {
      expect(KpkBoard.values.length, 8);
      expect(StudyGrade.values.length, 4);
      expect(AcademicGroup.forGrade(StudyGrade.grade9).length, 2);
      expect(AcademicGroup.forGrade(StudyGrade.grade11).length, 3);
      expect(AppConstants.localOnlyProgressMvp, isTrue);
    });

    test('uses academic green primary brand tokens for Light and Dark themes', () {
      final lightTheme = AppTheme.light();
      final darkTheme = AppTheme.dark();

      expect(lightTheme.colorScheme.primary, AppColors.primaryLight);
      expect(darkTheme.colorScheme.primary, AppColors.primaryDark);
      expect(lightTheme.brightness, Brightness.light);
      expect(darkTheme.brightness, Brightness.dark);
    });

    test('RtlAwareText detects Urdu Unicode RTL vs English LTR', () {
      expect(
        RtlAwareText.resolveDirection('Newton Second Law: F = ma'),
        TextDirection.ltr,
      );
      expect(
        RtlAwareText.resolveDirection('نیوٹن کا دوسرا قانون'),
        TextDirection.rtl,
      );
      expect(
        RtlAwareText.resolveDirection(
          'Force',
          explicitDirection: TextDirection.rtl,
        ),
        TextDirection.rtl,
      );
    });
  });

  group('Phase 1 — Navigation, Narrow Screens & Text Scaling', () {
    testWidgets('navigates cleanly across all 5 student areas', (tester) async {
      await tester.pumpWidget(
        const ProviderScope(child: RoshanStudyApp()),
      );
      await tester.pumpAndSettle();

      expect(find.text('What should I study or practise next?'), findsOneWidget);

      await tester.tap(find.text('Learn'));
      await tester.pumpAndSettle();
      expect(find.text('Tap any chapter to read concepts offline.'), findsOneWidget);

      await tester.tap(find.text('Practice'));
      await tester.pumpAndSettle();
      expect(find.text('Progressive Practice Engine'), findsOneWidget);

      await tester.tap(find.text('Exams'));
      await tester.pumpAndSettle();
      expect(find.text('KPK Board Exam Preparation'), findsOneWidget);

      await tester.tap(find.text('Progress'));
      await tester.pumpAndSettle();
      expect(find.text('Verified Board Progress (SSC / HSSC)'), findsOneWidget);
    });

    testWidgets('renders without overflow on 320px narrow screen at 2.0x scale',
        (tester) async {
      tester.view.physicalSize = const Size(320, 568);
      tester.view.devicePixelRatio = 1.0;
      addTearDown(tester.view.resetPhysicalSize);
      addTearDown(tester.view.resetDevicePixelRatio);

      await tester.pumpWidget(
        ProviderScope(
          child: MediaQuery(
            data: const MediaQueryData(
              size: Size(320, 568),
              textScaler: TextScaler.linear(2.0),
            ),
            child: const RoshanStudyApp(),
          ),
        ),
      );
      await tester.pumpAndSettle();

      expect(tester.takeException(), isNull);
    });
  });
}
