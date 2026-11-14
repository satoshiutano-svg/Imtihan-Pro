import 'dart:convert';

import 'package:roshan_study/core/constants/app_constants.dart';

class StudentProfile {
  const StudentProfile({
    required this.deviceUuid,
    required this.board,
    required this.grade,
    required this.group,
    this.selectedElectiveIds = const [],
    this.examDateIso,
    this.dailyQuestionTarget = 10,
    this.onboardingCompleted = false,
  });

  final String deviceUuid;
  final KpkBoard board;
  final StudyGrade grade;
  final AcademicGroup group;
  final List<String> selectedElectiveIds;
  final String? examDateIso;
  final int dailyQuestionTarget;
  final bool onboardingCompleted;

  DateTime? get examDate =>
      examDateIso == null ? null : DateTime.tryParse(examDateIso!);

  int? daysUntilExam({DateTime? now}) {
    final target = examDate;
    if (target == null) return null;
    final today = now ?? DateTime.now();
    final todayMidnight = DateTime(today.year, today.month, today.day);
    final targetMidnight = DateTime(target.year, target.month, target.day);
    return targetMidnight.difference(todayMidnight).inDays;
  }

  StudentProfile copyWith({
    KpkBoard? board,
    StudyGrade? grade,
    AcademicGroup? group,
    List<String>? selectedElectiveIds,
    String? examDateIso,
    bool clearExamDate = false,
    int? dailyQuestionTarget,
    bool? onboardingCompleted,
  }) {
    return StudentProfile(
      deviceUuid: deviceUuid,
      board: board ?? this.board,
      grade: grade ?? this.grade,
      group: group ?? this.group,
      selectedElectiveIds: selectedElectiveIds ?? this.selectedElectiveIds,
      examDateIso: clearExamDate ? null : (examDateIso ?? this.examDateIso),
      dailyQuestionTarget: dailyQuestionTarget ?? this.dailyQuestionTarget,
      onboardingCompleted: onboardingCompleted ?? this.onboardingCompleted,
    );
  }

  String encodeElectivesJson() => jsonEncode(selectedElectiveIds);

  static List<String> decodeElectivesJson(String raw) {
    try {
      final list = jsonDecode(raw) as List<dynamic>;
      return list.map((e) => e.toString()).toList(growable: false);
    } catch (_) {
      return const [];
    }
  }
}
