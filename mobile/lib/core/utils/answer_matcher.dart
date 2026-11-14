import 'package:roshan_study/core/models/curriculum_models.dart';

/// Strict answer comparison utility for objective and numerical questions.
///
/// Prevents false-positive substring matches (e.g. "5" or "m" matching "54 m")
/// while allowing equivalent numerical formatting with optional omitted unit
/// (e.g. "54" or "54.0 m" matching "54 m").
class AnswerMatcher {
  const AnswerMatcher._();

  static final RegExp _numericWithUnitPattern = RegExp(
    r'^([-+]?\d+(?:\.\d+)?)(.*)$',
  );

  static bool isMatch({
    required String userRaw,
    required String expectedRaw,
    required QuestionType type,
  }) {
    if (type == QuestionType.multiSelect || type == QuestionType.matching) {
      final uSet = _parseDelimitedSet(userRaw);
      final eSet = _parseDelimitedSet(expectedRaw);
      if (uSet.isEmpty || uSet.length != eSet.length) {
        return false;
      }
      for (int i = 0; i < uSet.length; i++) {
        if (uSet[i] != eSet[i]) return false;
      }
      return true;
    }

    final userNorm = _normalize(userRaw);
    final expectedNorm = _normalize(expectedRaw);
    if (userNorm.isEmpty || expectedNorm.isEmpty) {
      return false;
    }
    if (userNorm == expectedNorm) {
      return true;
    }

    if (type == QuestionType.trueFalse) {
      return _canonTrueFalse(userNorm) == _canonTrueFalse(expectedNorm);
    }

    if (type == QuestionType.numerical) {
      final userMatch = _numericWithUnitPattern.firstMatch(userNorm);
      final expectedMatch = _numericWithUnitPattern.firstMatch(expectedNorm);
      if (userMatch != null && expectedMatch != null) {
        final userNum = double.tryParse(userMatch.group(1)!);
        final expectedNum = double.tryParse(expectedMatch.group(1)!);
        final userUnit = userMatch.group(2) ?? '';
        final expectedUnit = expectedMatch.group(2) ?? '';
        if (userNum != null && expectedNum != null) {
          final numericMatches = (userNum - expectedNum).abs() <= 1e-6;
          final unitMatches = userUnit.isEmpty || userUnit == expectedUnit;
          return numericMatches && unitMatches;
        }
      }
    }

    return false;
  }

  static List<String> _parseDelimitedSet(String raw) {
    final items = raw
        .split('||')
        .map(_normalize)
        .where((item) => item.isNotEmpty)
        .toSet()
        .toList()
      ..sort();
    return items;
  }

  static String _canonTrueFalse(String norm) {
    if (norm == 't' || norm == 'true') return 'true';
    if (norm == 'f' || norm == 'false') return 'false';
    return norm;
  }

  static String _normalize(String raw) {
    return raw.trim().toLowerCase().replaceAll(RegExp(r'\s+'), '');
  }
}
