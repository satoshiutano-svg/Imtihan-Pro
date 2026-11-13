import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:roshan_study/data/repositories/profile_repository.dart';

class DisplayPreferences {
  const DisplayPreferences({
    this.themeMode = ThemeMode.system,
    this.readingScale = 1.0,
  });

  final ThemeMode themeMode;
  final double readingScale;

  DisplayPreferences copyWith({
    ThemeMode? themeMode,
    double? readingScale,
  }) {
    return DisplayPreferences(
      themeMode: themeMode ?? this.themeMode,
      readingScale: readingScale ?? this.readingScale,
    );
  }
}

class DisplayPreferencesController extends Notifier<DisplayPreferences> {
  @override
  DisplayPreferences build() {
    final stored = ref.watch(profileRepositoryProvider).loadDisplayPreferences();
    return DisplayPreferences(
      themeMode: stored.themeMode,
      readingScale: stored.readingScale,
    );
  }

  void setThemeMode(ThemeMode mode) {
    state = state.copyWith(themeMode: mode);
    ref.read(profileRepositoryProvider).saveDisplayPreferences(
          themeMode: state.themeMode,
          readingScale: state.readingScale,
        );
  }

  void setReadingScale(double scale) {
    final clamped = scale.clamp(0.85, 1.5);
    state = state.copyWith(readingScale: clamped);
    ref.read(profileRepositoryProvider).saveDisplayPreferences(
          themeMode: state.themeMode,
          readingScale: state.readingScale,
        );
  }
}

final displayPreferencesProvider =
    NotifierProvider<DisplayPreferencesController, DisplayPreferences>(
  DisplayPreferencesController.new,
);
