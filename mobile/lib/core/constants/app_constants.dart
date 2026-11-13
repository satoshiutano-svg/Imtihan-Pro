/// Core domain constants for Roshan Study (Phase 1 foundation).
///
/// Confirmed v1 scope:
/// - Grades 9–12, English-medium textbooks/content initially (Urdu medium later).
/// - All 8 Khyber Pakhtunkhwa BISE boards supported.
/// - Student progress stored 100% locally on-device in MVP (zero mandatory account).
class AppConstants {
  const AppConstants._();

  static const String appName = 'Roshan Study';
  static const String appTagline =
      'Calm, offline-first study for KPK Grades 9–12';
  static const String defaultInstructionalLanguage = 'English';
  static const bool localOnlyProgressMvp = true;
}

/// All eight Khyber Pakhtunkhwa Boards of Intermediate & Secondary Education.
enum KpkBoard {
  peshawar('peshawar', 'BISE Peshawar'),
  mardan('mardan', 'BISE Mardan'),
  swat('swat', 'BISE Swat'),
  malakand('malakand', 'BISE Malakand'),
  abbottabad('abbottabad', 'BISE Abbottabad'),
  kohat('kohat', 'BISE Kohat'),
  bannu('bannu', 'BISE Bannu'),
  deraIsmailKhan('dikhan', 'BISE D.I. Khan');

  const KpkBoard(this.id, this.displayName);

  final String id;
  final String displayName;
}

/// Supported secondary and higher-secondary grades.
enum StudyGrade {
  grade9(9, 'Grade 9 (SSC Part I)'),
  grade10(10, 'Grade 10 (SSC Part II)'),
  grade11(11, 'Grade 11 (HSSC Part I)'),
  grade12(12, 'Grade 12 (HSSC Part II)');

  const StudyGrade(this.number, this.label);

  final int number;
  final String label;

  bool get isSsc => number == 9 || number == 10;
  bool get isHssc => number == 11 || number == 12;
}

/// Academic groups mapped cleanly to SSC (9–10) and HSSC (11–12).
enum AcademicGroup {
  sscScience('ssc_science', 'Science Group', true),
  sscHumanities('ssc_humanities', 'Humanities & Social Sciences', true),
  hsscPreMedical('hssc_pre_medical', 'Pre-Medical', false),
  hsscPreEngineering('hssc_pre_engineering', 'Pre-Engineering', false),
  hsscComputerScience('hssc_cs', 'General / Computer Science', false);

  const AcademicGroup(this.id, this.displayName, this.isSscGroup);

  final String id;
  final String displayName;
  final bool isSscGroup;

  static List<AcademicGroup> forGrade(StudyGrade grade) {
    return values
        .where((group) => group.isSscGroup == grade.isSsc)
        .toList(growable: false);
  }
}
