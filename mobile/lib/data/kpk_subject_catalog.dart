import 'dart:ui';

import 'package:roshan_study/core/constants/app_constants.dart';
import 'package:roshan_study/core/models/curriculum_models.dart';

/// English-medium subject catalog for Grades 9–12 across KPK BISE tracks,
/// plus isolated MDCAT and ETEA Engineering admission subjects.
///
/// Note: Urdu-medium textbooks are intentionally deferred to a future release.
/// Compulsory Urdu language subject retains RTL architectural metadata.
class KpkSubjectCatalog {
  const KpkSubjectCatalog._();

  static const List<SubjectDefinition> allSubjects = [
    // ================= GRADE 9 (SSC Part I — English Medium) =================
    SubjectDefinition(
      id: 'eng_9',
      code: 'ENG-9',
      name: 'English',
      grade: 9,
      groupIds: ['ssc_science', 'ssc_humanities'],
      isCompulsory: true,
    ),
    SubjectDefinition(
      id: 'ur_9',
      code: 'URD-9',
      name: 'Urdu (Compulsory)',
      grade: 9,
      groupIds: ['ssc_science', 'ssc_humanities'],
      isCompulsory: true,
      textDirection: TextDirection.rtl,
      note: 'Urdu script subject (RTL); Urdu-medium textbooks added later.',
    ),
    SubjectDefinition(
      id: 'isl_9',
      code: 'ISL-9',
      name: 'Islamiat (Compulsory)',
      grade: 9,
      groupIds: ['ssc_science', 'ssc_humanities'],
      isCompulsory: true,
    ),
    SubjectDefinition(
      id: 'ps_9',
      code: 'PST-9',
      name: 'Pakistan Studies',
      grade: 9,
      groupIds: ['ssc_science', 'ssc_humanities'],
      isCompulsory: true,
    ),
    SubjectDefinition(
      id: 'math_9',
      code: 'MTH-9',
      name: 'Mathematics',
      grade: 9,
      groupIds: ['ssc_science'],
      isCompulsory: true,
    ),
    SubjectDefinition(
      id: 'phy_9',
      code: 'PHY-9',
      name: 'Physics',
      grade: 9,
      groupIds: ['ssc_science'],
      isCompulsory: true,
    ),
    SubjectDefinition(
      id: 'chem_9',
      code: 'CHM-9',
      name: 'Chemistry',
      grade: 9,
      groupIds: ['ssc_science'],
      isCompulsory: true,
    ),
    SubjectDefinition(
      id: 'bio_9',
      code: 'BIO-9',
      name: 'Biology',
      grade: 9,
      groupIds: ['ssc_science'],
      isCompulsory: false,
      electiveSlot: 'ssc_science_elective',
    ),
    SubjectDefinition(
      id: 'cs_9',
      code: 'CSC-9',
      name: 'Computer Science',
      grade: 9,
      groupIds: ['ssc_science'],
      isCompulsory: false,
      electiveSlot: 'ssc_science_elective',
    ),
    SubjectDefinition(
      id: 'gmath_9',
      code: 'GMTH-9',
      name: 'General Mathematics',
      grade: 9,
      groupIds: ['ssc_humanities'],
      isCompulsory: true,
    ),
    SubjectDefinition(
      id: 'gsci_9',
      code: 'GSCI-9',
      name: 'General Science',
      grade: 9,
      groupIds: ['ssc_humanities'],
      isCompulsory: true,
    ),
    SubjectDefinition(
      id: 'civ_9',
      code: 'CIV-9',
      name: 'Civics',
      grade: 9,
      groupIds: ['ssc_humanities'],
      isCompulsory: false,
      electiveSlot: 'ssc_humanities_elective',
    ),
    SubjectDefinition(
      id: 'eco_9',
      code: 'ECO-9',
      name: 'Economics',
      grade: 9,
      groupIds: ['ssc_humanities'],
      isCompulsory: false,
      electiveSlot: 'ssc_humanities_elective',
    ),

    // ================= GRADE 10 (SSC Part II — English Medium) ================
    SubjectDefinition(
      id: 'eng_10',
      code: 'ENG-10',
      name: 'English',
      grade: 10,
      groupIds: ['ssc_science', 'ssc_humanities'],
      isCompulsory: true,
    ),
    SubjectDefinition(
      id: 'ur_10',
      code: 'URD-10',
      name: 'Urdu (Compulsory)',
      grade: 10,
      groupIds: ['ssc_science', 'ssc_humanities'],
      isCompulsory: true,
      textDirection: TextDirection.rtl,
    ),
    SubjectDefinition(
      id: 'isl_10',
      code: 'ISL-10',
      name: 'Islamiat (Compulsory)',
      grade: 10,
      groupIds: ['ssc_science', 'ssc_humanities'],
      isCompulsory: true,
    ),
    SubjectDefinition(
      id: 'ps_10',
      code: 'PST-10',
      name: 'Pakistan Studies',
      grade: 10,
      groupIds: ['ssc_science', 'ssc_humanities'],
      isCompulsory: true,
    ),
    SubjectDefinition(
      id: 'math_10',
      code: 'MTH-10',
      name: 'Mathematics',
      grade: 10,
      groupIds: ['ssc_science'],
      isCompulsory: true,
    ),
    SubjectDefinition(
      id: 'phy_10',
      code: 'PHY-10',
      name: 'Physics',
      grade: 10,
      groupIds: ['ssc_science'],
      isCompulsory: true,
    ),
    SubjectDefinition(
      id: 'chem_10',
      code: 'CHM-10',
      name: 'Chemistry',
      grade: 10,
      groupIds: ['ssc_science'],
      isCompulsory: true,
    ),
    SubjectDefinition(
      id: 'bio_10',
      code: 'BIO-10',
      name: 'Biology',
      grade: 10,
      groupIds: ['ssc_science'],
      isCompulsory: false,
      electiveSlot: 'ssc_science_elective',
    ),
    SubjectDefinition(
      id: 'cs_10',
      code: 'CSC-10',
      name: 'Computer Science',
      grade: 10,
      groupIds: ['ssc_science'],
      isCompulsory: false,
      electiveSlot: 'ssc_science_elective',
    ),
    SubjectDefinition(
      id: 'gmath_10',
      code: 'GMTH-10',
      name: 'General Mathematics',
      grade: 10,
      groupIds: ['ssc_humanities'],
      isCompulsory: true,
    ),
    SubjectDefinition(
      id: 'gsci_10',
      code: 'GSCI-10',
      name: 'General Science',
      grade: 10,
      groupIds: ['ssc_humanities'],
      isCompulsory: true,
    ),

    // ================= GRADE 11 (HSSC Part I — English Medium) ===============
    SubjectDefinition(
      id: 'eng_11',
      code: 'ENG-11',
      name: 'English',
      grade: 11,
      groupIds: ['hssc_pre_medical', 'hssc_pre_engineering', 'hssc_cs'],
      isCompulsory: true,
    ),
    SubjectDefinition(
      id: 'ur_11',
      code: 'URD-11',
      name: 'Urdu (Compulsory)',
      grade: 11,
      groupIds: ['hssc_pre_medical', 'hssc_pre_engineering', 'hssc_cs'],
      isCompulsory: true,
      textDirection: TextDirection.rtl,
    ),
    SubjectDefinition(
      id: 'isl_11',
      code: 'ISL-11',
      name: 'Islamic Education',
      grade: 11,
      groupIds: ['hssc_pre_medical', 'hssc_pre_engineering', 'hssc_cs'],
      isCompulsory: true,
    ),
    SubjectDefinition(
      id: 'phy_11',
      code: 'PHY-11',
      name: 'Physics',
      grade: 11,
      groupIds: ['hssc_pre_medical', 'hssc_pre_engineering'],
      isCompulsory: true,
    ),
    SubjectDefinition(
      id: 'chem_11',
      code: 'CHM-11',
      name: 'Chemistry',
      grade: 11,
      groupIds: ['hssc_pre_medical', 'hssc_pre_engineering'],
      isCompulsory: true,
    ),
    SubjectDefinition(
      id: 'bio_11',
      code: 'BIO-11',
      name: 'Biology',
      grade: 11,
      groupIds: ['hssc_pre_medical'],
      isCompulsory: true,
    ),
    SubjectDefinition(
      id: 'math_11',
      code: 'MTH-11',
      name: 'Mathematics',
      grade: 11,
      groupIds: ['hssc_pre_engineering', 'hssc_cs'],
      isCompulsory: true,
    ),
    SubjectDefinition(
      id: 'cs_11',
      code: 'CSC-11',
      name: 'Computer Science',
      grade: 11,
      groupIds: ['hssc_cs'],
      isCompulsory: true,
    ),
    SubjectDefinition(
      id: 'phy_11_cs',
      code: 'PHY-11',
      name: 'Physics (ICS)',
      grade: 11,
      groupIds: ['hssc_cs'],
      isCompulsory: false,
      electiveSlot: 'hssc_cs_third',
    ),
    SubjectDefinition(
      id: 'stat_11',
      code: 'STT-11',
      name: 'Statistics',
      grade: 11,
      groupIds: ['hssc_cs'],
      isCompulsory: false,
      electiveSlot: 'hssc_cs_third',
    ),
    SubjectDefinition(
      id: 'eco_11',
      code: 'ECO-11',
      name: 'Economics',
      grade: 11,
      groupIds: ['hssc_cs'],
      isCompulsory: false,
      electiveSlot: 'hssc_cs_third',
    ),

    // ================= GRADE 12 (HSSC Part II — English Medium) ==============
    SubjectDefinition(
      id: 'eng_12',
      code: 'ENG-12',
      name: 'English',
      grade: 12,
      groupIds: ['hssc_pre_medical', 'hssc_pre_engineering', 'hssc_cs'],
      isCompulsory: true,
    ),
    SubjectDefinition(
      id: 'ur_12',
      code: 'URD-12',
      name: 'Urdu (Compulsory)',
      grade: 12,
      groupIds: ['hssc_pre_medical', 'hssc_pre_engineering', 'hssc_cs'],
      isCompulsory: true,
      textDirection: TextDirection.rtl,
    ),
    SubjectDefinition(
      id: 'ps_12',
      code: 'PST-12',
      name: 'Pakistan Studies',
      grade: 12,
      groupIds: ['hssc_pre_medical', 'hssc_pre_engineering', 'hssc_cs'],
      isCompulsory: true,
    ),
    SubjectDefinition(
      id: 'phy_12',
      code: 'PHY-12',
      name: 'Physics',
      grade: 12,
      groupIds: ['hssc_pre_medical', 'hssc_pre_engineering'],
      isCompulsory: true,
    ),
    SubjectDefinition(
      id: 'chem_12',
      code: 'CHM-12',
      name: 'Chemistry',
      grade: 12,
      groupIds: ['hssc_pre_medical', 'hssc_pre_engineering'],
      isCompulsory: true,
    ),
    SubjectDefinition(
      id: 'bio_12',
      code: 'BIO-12',
      name: 'Biology',
      grade: 12,
      groupIds: ['hssc_pre_medical'],
      isCompulsory: true,
    ),
    SubjectDefinition(
      id: 'math_12',
      code: 'MTH-12',
      name: 'Mathematics',
      grade: 12,
      groupIds: ['hssc_pre_engineering', 'hssc_cs'],
      isCompulsory: true,
    ),
    SubjectDefinition(
      id: 'cs_12',
      code: 'CSC-12',
      name: 'Computer Science',
      grade: 12,
      groupIds: ['hssc_cs'],
      isCompulsory: true,
    ),
    SubjectDefinition(
      id: 'phy_12_cs',
      code: 'PHY-12',
      name: 'Physics (ICS)',
      grade: 12,
      groupIds: ['hssc_cs'],
      isCompulsory: false,
      electiveSlot: 'hssc_cs_third',
    ),
    SubjectDefinition(
      id: 'stat_12',
      code: 'STT-12',
      name: 'Statistics',
      grade: 12,
      groupIds: ['hssc_cs'],
      isCompulsory: false,
      electiveSlot: 'hssc_cs_third',
    ),

    // ================= ISOLATED ADMISSION PROGRAMMES (Phase 10) ==============
    SubjectDefinition(
      id: 'mdcat_bio',
      code: 'MDCAT-BIO',
      name: 'MDCAT Biology',
      grade: 12,
      groupIds: ['mdcat'],
      isCompulsory: true,
      programmeId: ProgrammeId.mdcat,
    ),
    SubjectDefinition(
      id: 'mdcat_phy',
      code: 'MDCAT-PHY',
      name: 'MDCAT Physics',
      grade: 12,
      groupIds: ['mdcat'],
      isCompulsory: true,
      programmeId: ProgrammeId.mdcat,
    ),
    SubjectDefinition(
      id: 'etea_math',
      code: 'ETEA-MTH',
      name: 'ETEA Engineering Mathematics',
      grade: 12,
      groupIds: ['etea_eng'],
      isCompulsory: true,
      programmeId: ProgrammeId.eteaEng,
    ),
    SubjectDefinition(
      id: 'etea_phy',
      code: 'ETEA-PHY',
      name: 'ETEA Engineering Physics',
      grade: 12,
      groupIds: ['etea_eng'],
      isCompulsory: true,
      programmeId: ProgrammeId.eteaEng,
    ),
  ];

  static List<SubjectDefinition> subjectsForProfile({
    required StudyGrade grade,
    required AcademicGroup group,
    List<String> selectedElectiveIds = const [],
  }) {
    return allSubjects.where((s) {
      if (s.programmeId != ProgrammeId.sscHssc) return false;
      if (s.grade != grade.number) return false;
      if (!s.groupIds.contains(group.id)) return false;
      if (s.isCompulsory) return true;
      return selectedElectiveIds.contains(s.id);
    }).toList(growable: false);
  }

  static List<SubjectDefinition> availableElectives({
    required StudyGrade grade,
    required AcademicGroup group,
  }) {
    return allSubjects
        .where(
          (s) =>
              s.programmeId == ProgrammeId.sscHssc &&
              s.grade == grade.number &&
              s.groupIds.contains(group.id) &&
              !s.isCompulsory,
        )
        .toList(growable: false);
  }

  static List<SubjectDefinition> subjectsForProgramme(ProgrammeId programmeId) {
    return allSubjects
        .where((s) => s.programmeId == programmeId)
        .toList(growable: false);
  }
}
