import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:roshan_study/app/router/scaffold_with_nav_bar.dart';
import 'package:roshan_study/core/models/curriculum_models.dart';
import 'package:roshan_study/features/admissions/presentation/admission_hub_screen.dart';
import 'package:roshan_study/features/downloads/presentation/download_manager_screen.dart';
import 'package:roshan_study/features/exams/presentation/exam_runner_screen.dart';
import 'package:roshan_study/features/exams/presentation/exams_screen.dart';
import 'package:roshan_study/features/home/presentation/home_screen.dart';
import 'package:roshan_study/features/learn/presentation/chapter_detail_screen.dart';
import 'package:roshan_study/features/learn/presentation/concept_reader_screen.dart';
import 'package:roshan_study/features/learn/presentation/learn_screen.dart';
import 'package:roshan_study/features/onboarding/presentation/onboarding_screen.dart';
import 'package:roshan_study/features/practice/presentation/formula_match_screen.dart';
import 'package:roshan_study/features/practice/presentation/practice_screen.dart';
import 'package:roshan_study/features/practice/presentation/practice_session_screen.dart';
import 'package:roshan_study/features/progress/presentation/progress_screen.dart';
import 'package:roshan_study/features/settings/presentation/privacy_policy_screen.dart';
import 'package:roshan_study/features/settings/presentation/settings_screen.dart';

final _rootNavigatorKey = GlobalKey<NavigatorState>(debugLabel: 'root');

final appRouterProvider = Provider<GoRouter>((ref) {
  return GoRouter(
    navigatorKey: _rootNavigatorKey,
    initialLocation: '/home',
    routes: [
      StatefulShellRoute.indexedStack(
        builder: (context, state, navigationShell) {
          return ScaffoldWithNavBar(navigationShell: navigationShell);
        },
        branches: [
          StatefulShellBranch(
            routes: [
              GoRoute(
                path: '/home',
                name: 'home',
                builder: (context, state) => const HomeScreen(),
              ),
            ],
          ),
          StatefulShellBranch(
            routes: [
              GoRoute(
                path: '/learn',
                name: 'learn',
                builder: (context, state) => const LearnScreen(),
              ),
            ],
          ),
          StatefulShellBranch(
            routes: [
              GoRoute(
                path: '/practice',
                name: 'practice',
                builder: (context, state) => const PracticeScreen(),
              ),
            ],
          ),
          StatefulShellBranch(
            routes: [
              GoRoute(
                path: '/exams',
                name: 'exams',
                builder: (context, state) => const ExamsScreen(),
              ),
            ],
          ),
          StatefulShellBranch(
            routes: [
              GoRoute(
                path: '/progress',
                name: 'progress',
                builder: (context, state) => const ProgressScreen(),
              ),
            ],
          ),
        ],
      ),
      GoRoute(
        parentNavigatorKey: _rootNavigatorKey,
        path: '/onboarding',
        builder: (context, state) => const OnboardingScreen(),
      ),
      GoRoute(
        parentNavigatorKey: _rootNavigatorKey,
        path: '/learn/chapter/:chapterId',
        builder: (context, state) => ChapterDetailScreen(
          chapterId: state.pathParameters['chapterId']!,
        ),
      ),
      GoRoute(
        parentNavigatorKey: _rootNavigatorKey,
        path: '/learn/chapter/:chapterId/concept/:conceptId',
        builder: (context, state) => ConceptReaderScreen(
          chapterId: state.pathParameters['chapterId']!,
          conceptId: state.pathParameters['conceptId']!,
        ),
      ),
      GoRoute(
        parentNavigatorKey: _rootNavigatorKey,
        path: '/practice/session',
        builder: (context, state) {
          final q = state.uri.queryParameters;
          return PracticeSessionScreen(
            chapterId: q['chapterId'],
            conceptId: q['conceptId'],
            maxDifficulty: int.tryParse(q['maxDifficulty'] ?? '') ?? 7,
            programmeId: ProgrammeId.fromId(q['programme'] ?? 'ssc_hssc'),
          );
        },
      ),
      GoRoute(
        parentNavigatorKey: _rootNavigatorKey,
        path: '/practice/match',
        builder: (context, state) => const FormulaMatchScreen(),
      ),
      GoRoute(
        parentNavigatorKey: _rootNavigatorKey,
        path: '/exams/run/:examId',
        builder: (context, state) => ExamRunnerScreen(
          examId: state.pathParameters['examId']!,
        ),
      ),
      GoRoute(
        parentNavigatorKey: _rootNavigatorKey,
        path: '/admissions',
        builder: (context, state) => const AdmissionHubScreen(),
      ),
      GoRoute(
        parentNavigatorKey: _rootNavigatorKey,
        path: '/downloads',
        builder: (context, state) => const DownloadManagerScreen(),
      ),
      GoRoute(
        parentNavigatorKey: _rootNavigatorKey,
        path: '/privacy',
        builder: (context, state) => const PrivacyPolicyScreen(),
      ),
      GoRoute(
        parentNavigatorKey: _rootNavigatorKey,
        path: '/settings',
        builder: (context, state) => const SettingsScreen(),
      ),
    ],
  );
});
