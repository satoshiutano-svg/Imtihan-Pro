import 'package:flutter/material.dart';
import 'package:flutter_localizations/flutter_localizations.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:roshan_study/app/router/app_router.dart';
import 'package:roshan_study/app/theme/app_theme.dart';
import 'package:roshan_study/app/theme/display_preferences_controller.dart';
import 'package:roshan_study/core/constants/app_constants.dart';

class RoshanStudyApp extends ConsumerWidget {
  const RoshanStudyApp({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final router = ref.watch(appRouterProvider);
    final prefs = ref.watch(displayPreferencesProvider);

    return MaterialApp.router(
      title: AppConstants.appName,
      debugShowCheckedModeBanner: false,
      theme: AppTheme.light(readingScale: prefs.readingScale),
      darkTheme: AppTheme.dark(readingScale: prefs.readingScale),
      themeMode: prefs.themeMode,
      routerConfig: router,
      locale: const Locale('en'),
      supportedLocales: const [
        Locale('en'),
        Locale('ur'),
      ],
      localizationsDelegates: const [
        GlobalMaterialLocalizations.delegate,
        GlobalWidgetsLocalizations.delegate,
        GlobalCupertinoLocalizations.delegate,
      ],
    );
  }
}
