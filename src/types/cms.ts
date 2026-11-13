export type ProgrammeId = 'ssc_hssc' | 'mdcat' | 'etea_eng' | 'uni_entrance';

export type AcademicGroupId =
  | 'ssc_science'
  | 'ssc_humanities'
  | 'hssc_pre_medical'
  | 'hssc_pre_engineering'
  | 'hssc_cs';

export type PublicationStatus =
  | 'draft'
  | 'in_review'
  | 'approved'
  | 'published'
  | 'unpublished';

export type QuestionType =
  | 'mcq'
  | 'conceptual'
  | 'recall'
  | 'fill_in'
  | 'numerical'
  | 'short_answer'
  | 'long_answer'
  | 'diagram_based'
  | 'application';

export type SourceType =
  | 'practice_original'
  | 'official_past_paper'
  | 'official_model_paper';

export type QuestionOrigin = 'human_authored' | 'ai_generated_draft' | 'ai_reviewed';

export interface NumericalSteps {
  given: string[];
  required: string;
  formula: string;
  substitution: string;
  calculation: string;
  answerWithUnit: string;
}

export interface VideoLinkItem {
  title: string;
  channelName: string;
  youtubeUrl: string;
  durationLabel: string;
  language: 'en' | 'ur';
}

export interface GlossaryHintItem {
  term: string;
  urduMeaning: string;
  simpleHint: string;
}

export interface MicroLessonCard {
  stageTitle: string;
  body: string;
  quickCheckQuestion?: string;
  quickCheckOptions?: string[];
  quickCheckAnswer?: string;
}

export interface CmsConcept {
  id: string;
  chapterId: string;
  topicId: string;
  orderIndex: number;
  title: string;
  locale: 'en' | 'ur';
  textDirection: 'ltr' | 'rtl';
  simpleExplanation: string;
  definitions: { term: string; definition: string }[];
  importantPoints: string[];
  formulas: { expression: string; description: string; unit?: string }[];
  diagramCaption: string;
  diagramSvg: string;
  workedExamplePrompt: string;
  workedExampleSteps: string[];
  workedExampleAnswer: string;
  applications: string[];
  commonMistake: string;
  commonMistakeCorrection: string;
  quickRevisionSummary: string[];
  videoLinks: VideoLinkItem[];
  glossaryHints: GlossaryHintItem[];
  microCards: MicroLessonCard[];
  sourceBook: string;
  sourcePage: string;
  reviewStatus: PublicationStatus;
  reviewedBy: string;
}

export interface CmsQuestion {
  id: string;
  programmeId: ProgrammeId;
  grade: 9 | 10 | 11 | 12;
  groupId: AcademicGroupId | 'admission';
  subjectId: string;
  chapterId: string;
  topicId: string;
  conceptId: string;
  questionType: QuestionType;
  difficulty: 1 | 2 | 3 | 4 | 5 | 6 | 7;
  statement: string;
  options: string[];
  optionMisconceptions?: Record<string, string>;
  hints: string[];
  numericalSteps?: NumericalSteps;
  markingPoints: string[];
  correctAnswer: string;
  explanation: string;
  marks: number;
  sourceType: SourceType;
  sourceBoardId?: string;
  sourceYear?: number;
  sourcePaperRef?: string;
  sourcePageRef?: string;
  origin?: QuestionOrigin;
  publicationStatus: PublicationStatus;
  reviewedBy: string;
}

export interface CmsChapter {
  chapterId: string;
  programmeId: ProgrammeId;
  grade: 9 | 10 | 11 | 12;
  groupId: AcademicGroupId | 'admission';
  subjectId: string;
  subjectName: string;
  chapterNumber: number;
  title: string;
  learningOutcomes: string[];
  publicationStatus: PublicationStatus;
  packVersion: number;
  permissionVerified: boolean;
  isSampleTestPack?: boolean;
  concepts: CmsConcept[];
  questions: CmsQuestion[];
}

export interface SandboxAttemptRecord {
  id: string;
  programmeId?: ProgrammeId;
  questionId: string;
  chapterId: string;
  subjectName: string;
  conceptTitle: string;
  isCorrect: boolean;
  difficulty: number;
  timestamp: string;
}

export interface DailyGoalState {
  currentStreakDays: number;
  longestStreakDays: number;
  graceFreezesRemaining: number;
  lastActiveDateIso: string | null;
  todayDateIso: string;
  todayQuestionsCompleted: number;
  todayLessonsCompleted: number;
  dailyQuestionTarget: number;
  completedDailyTracks: Record<
    string,
    { score: number; total: number; completedAt: string }
  >;
}
