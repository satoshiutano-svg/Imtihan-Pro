import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:roshan_study/core/constants/app_constants.dart';
import 'package:roshan_study/core/database/database_provider.dart';
import 'package:roshan_study/core/database/local_database.dart';
import 'package:roshan_study/core/models/student_profile.dart';
import 'package:uuid/uuid.dart';

class ProfileRepository {
  ProfileRepository(this._db);

  final LocalDatabase _db;
  static const Uuid _uuid = Uuid();

  StudentProfile loadOrCreateProfile() {
    final rows = _db.db.select('SELECT * FROM student_profile WHERE id = 1;');
    if (rows.isEmpty) {
      final initial = StudentProfile(
        deviceUuid: _uuid.v4(),
        board: KpkBoard.peshawar,
        grade: StudyGrade.grade9,
        group: AcademicGroup.sscScience,
        selectedElectiveIds: const ['bio_9'],
        onboardingCompleted: false,
      );
      saveProfile(initial);
      return initial;
    }

    final row = rows.first;
    final boardId = row['board_id'] as String;
    final gradeNum = row['grade'] as int;
    final groupId = row['group_id'] as String;

    return StudentProfile(
      deviceUuid: row['device_uuid'] as String,
      board: KpkBoard.values.firstWhere(
        (b) => b.id == boardId,
        orElse: () => KpkBoard.peshawar,
      ),
      grade: StudyGrade.values.firstWhere(
        (g) => g.number == gradeNum,
        orElse: () => StudyGrade.grade9,
      ),
      group: AcademicGroup.values.firstWhere(
        (g) => g.id == groupId,
        orElse: () => AcademicGroup.sscScience,
      ),
      selectedElectiveIds: selectedElectivesJson(row),
      examDateIso: row['exam_date_iso'] as String?,
      dailyQuestionTarget:
          ((row['daily_question_target'] as num?)?.toInt() ?? 10).clamp(5, 50),
      onboardingCompleted: (row['onboarding_completed'] as int? ?? 0) == 1,
    );
  }

  static List<String> selectedElectivesJson(Map<String, Object?> row) {
    return StudentProfile.decodeElectivesJson(
      row['selected_electives_json'] as String? ?? '[]',
    );
  }

  void saveProfile(StudentProfile profile) {
    final now = DateTime.now().toIso8601String();
    _db.db.execute(
      '''
      INSERT INTO student_profile (
        id, device_uuid, board_id, grade, group_id,
        selected_electives_json, exam_date_iso, daily_question_target,
        onboarding_completed, updated_at
      ) VALUES (1, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(id) DO UPDATE SET
        board_id = excluded.board_id,
        grade = excluded.grade,
        group_id = excluded.group_id,
        selected_electives_json = excluded.selected_electives_json,
        exam_date_iso = excluded.exam_date_iso,
        daily_question_target = excluded.daily_question_target,
        onboarding_completed = excluded.onboarding_completed,
        updated_at = excluded.updated_at;
      ''',
      [
        profile.deviceUuid,
        profile.board.id,
        profile.grade.number,
        profile.group.id,
        profile.encodeElectivesJson(),
        profile.examDateIso,
        profile.dailyQuestionTarget.clamp(5, 50),
        profile.onboardingCompleted ? 1 : 0,
        now,
      ],
    );
  }

  ({ThemeMode themeMode, double readingScale}) loadDisplayPreferences() {
    final rows = _db.db.select(
      'SELECT theme_mode, reading_scale FROM student_profile WHERE id = 1;',
    );
    if (rows.isEmpty) {
      return (themeMode: ThemeMode.system, readingScale: 1.0);
    }
    final row = rows.first;
    final modeStr = row['theme_mode'] as String? ?? 'system';
    final themeMode = switch (modeStr) {
      'light' => ThemeMode.light,
      'dark' => ThemeMode.dark,
      _ => ThemeMode.system,
    };
    final scale = (row['reading_scale'] as num?)?.toDouble() ?? 1.0;
    return (themeMode: themeMode, readingScale: scale.clamp(0.85, 1.5));
  }

  void saveDisplayPreferences({
    required ThemeMode themeMode,
    required double readingScale,
  }) {
    loadOrCreateProfile();
    final modeStr = switch (themeMode) {
      ThemeMode.light => 'light',
      ThemeMode.dark => 'dark',
      ThemeMode.system => 'system',
    };
    _db.db.execute(
      'UPDATE student_profile SET theme_mode = ?, reading_scale = ?, updated_at = ? WHERE id = 1;',
      [modeStr, readingScale.clamp(0.85, 1.5), DateTime.now().toIso8601String()],
    );
  }
}

final profileRepositoryProvider = Provider<ProfileRepository>((ref) {
  return ProfileRepository(ref.watch(localDatabaseProvider));
});

class StudentProfileController extends Notifier<StudentProfile> {
  @override
  StudentProfile build() {
    return ref.watch(profileRepositoryProvider).loadOrCreateProfile();
  }

  void updateProfile(StudentProfile updated) {
    ref.read(profileRepositoryProvider).saveProfile(updated);
    state = updated;
  }
}

final studentProfileProvider =
    NotifierProvider<StudentProfileController, StudentProfile>(
  StudentProfileController.new,
);
