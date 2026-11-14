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
  | 'multi_select'
  | 'true_false'
  | 'fill_in'
  | 'matching'
  | 'numerical'
  | 'short_answer'
  | 'long_answer'
  | 'conceptual'
  | 'recall'
  | 'diagram_based'
  | 'application';

export type SourceType =
  | 'practice_original'
  | 'official_past_paper'
  | 'official_model_paper';

export type QuestionOrigin =
  | 'human_authored'
  | 'ai_generated_draft'
  | 'ai_reviewed'
  | 'agent_uploaded_draft';

export type VisualColorToken = 'primary' | 'secondary' | 'warning' | 'danger';

export interface MotionActor {
  id: string;
  label: string;
  shape: 'circle' | 'box' | 'arrow' | 'molecule' | 'wave';
  colorToken: VisualColorToken;
  startX: number;
  startY: number;
  endX: number;
  endY: number;
  size?: number;
}

export interface MotionStage {
  atPercent: number;
  label: string;
  formulaLatex?: string;
  callout: string;
}

export interface MotionGraphicSpec {
  id: string;
  title: string;
  caption: string;
  durationSec: number;
  sceneType:
    | 'kinematics_track'
    | 'vector_motion'
    | 'reaction_flow'
    | 'wave_oscillation'
    | 'orbit_cycle';
  actors: MotionActor[];
  stages: MotionStage[];
}

export interface GraphPoint {
  x: number;
  y: number;
}

export interface GraphSeries {
  name: string;
  colorToken: VisualColorToken;
  points: GraphPoint[];
  showArea?: boolean;
}

export interface GraphHighlight {
  x: number;
  y: number;
  label: string;
}

export interface GraphSpec {
  id: string;
  title: string;
  caption: string;
  xLabel: string;
  yLabel: string;
  xMin: number;
  xMax: number;
  yMin: number;
  yMax: number;
  series: GraphSeries[];
  highlights: GraphHighlight[];
}

export interface ChapterAdConfig {
  placement: 'respectful_default';
  showCatalogBanner: boolean;
  showPostSessionInterstitial: boolean;
  suppressDuringReadingAndExam: true;
}

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
  learningObjectives?: string[];
  simpleExplanation: string;
  detailedExplanation?: string;
  definitions: { term: string; definition: string }[];
  importantPoints: string[];
  formulas: { expression: string; description: string; unit?: string }[];
  diagramCaption: string;
  diagramSvg: string;
  motionGraphics?: MotionGraphicSpec[];
  graphs?: GraphSpec[];
  workedExamplePrompt: string;
  workedExampleSteps: string[];
  workedExampleAnswer: string;
  applications: string[];
  commonMistake: string;
  commonMistakeCorrection: string;
  quickRevisionSummary: string[];
  flashcards?: { front: string; back: string }[];
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
  multiSelectAnswers?: string[];
  matchingPairs?: { left: string; right: string }[];
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

export type AgentRoleId =
  | 'project_manager'
  | 'curriculum_research'
  | 'curriculum_architect'
  | 'textbook_researcher'
  | 'pdf_extraction'
  | 'source_processing'
  | 'chapter_architect'
  | 'chapter_structure'
  | 'topic_mapping'
  | 'concept_writer'
  | 'explanation_writer'
  | 'simplification_specialist'
  | 'notes_generator'
  | 'example_generator'
  | 'question_generator'
  | 'mcq_specialist'
  | 'short_question_specialist'
  | 'long_question_specialist'
  | 'numerical_specialist'
  | 'diagram_visualization'
  | 'practice_designer'
  | 'quiz_creator'
  | 'examination_builder'
  | 'board_paper_specialist'
  | 'answer_key_specialist'
  | 'marking_scheme_specialist'
  | 'independent_answer_validator'
  | 'math_verification'
  | 'science_verification'
  | 'curriculum_validator'
  | 'language_editor'
  | 'pedagogy_reviewer'
  | 'duplicate_detection'
  | 'formatting_specialist'
  | 'quality_assurance'
  | 'final_quality_auditor'
  | 'revision_material'
  | 'content_packaging'
  | 'publishing'
  | 'monitoring';

export type ReviewStage =
  | 'ai_generated'
  | 'auto_validated'
  | 'independently_reviewed'
  | 'human_approved'
  | 'revision_requested'
  | 'rejected'
  | 'published';

export type ValidatorKind =
  | 'answer_accuracy'
  | 'curriculum_alignment'
  | 'language_katex'
  | 'pedagogy_clarity'
  | 'duplicate_check'
  | 'schema_qa';

export interface ValidatorCheckResult {
  kind: ValidatorKind;
  agentRole: AgentRoleId;
  passed: boolean;
  score: number;
  summary: string;
  flaggedItemIds: string[];
  findings: string[];
  checkedAt: string;
}

export interface VerificationReport {
  id: string;
  chapterId: string;
  jobId?: string;
  stage: ReviewStage;
  overallPassed: boolean;
  score: number;
  checks: ValidatorCheckResult[];
  escalationReasons: string[];
  updatedAt: string;
}

export interface SourceBundle {
  id: string;
  grade: 9 | 10 | 11 | 12;
  groupId: AcademicGroupId | 'admission';
  subjectName: string;
  chapterNumber: number;
  chapterTitle: string;
  sourceBook: string;
  filename?: string;
  sha256: string;
  extractedText: string;
  hasPdfBinary?: boolean;
  pageAnchors: string[];
  extractionConfidence: number;
  requiresHumanReview: boolean;
  permissionVerified: boolean;
  createdAt: string;
}

export type ProductionScope =
  | 'full_chapter_pack'
  | 'concepts_and_notes'
  | 'visuals_and_graphs'
  | 'question_bank'
  | 'exams_and_quizzes';

export type ExecutionMode = 'gemini_cached' | 'external_agent_queue';

export type ProductionJobStatus =
  | 'queued'
  | 'running'
  | 'waiting_external'
  | 'paused'
  | 'awaiting_approval'
  | 'escalated'
  | 'completed'
  | 'failed'
  | 'cancelled';

export type AgentTaskStatus =
  | 'queued'
  | 'claimed'
  | 'running'
  | 'completed'
  | 'failed'
  | 'escalated';

export interface AgentTaskLogEntry {
  timestamp: string;
  workerId?: string;
  event: string;
  detail: string;
}

export interface AgentTask {
  id: string;
  jobId: string;
  chapterId: string;
  bookId?: string;
  role: AgentRoleId;
  phase: number;
  priority?: number;
  title: string;
  dependsOnTaskIds: string[];
  idempotencyKey: string;
  status: AgentTaskStatus;
  assignedWorker?: string;
  leaseExpiresAt?: string;
  retryCount: number;
  maxRetries: number;
  lastError?: string;
  feedbackNotes?: string;
  inputSummary: string;
  outputSummary?: string;
  executionLogs?: AgentTaskLogEntry[];
  createdAt: string;
  startedAt?: string;
  finishedAt?: string;
}

export interface ProductionReport {
  jobId: string;
  curriculumConfidence: number;
  sourceExtractionConfidence: number;
  conceptsProduced: number;
  visualsProduced: number;
  questionsProduced: number;
  examsProduced: number;
  validationPassRate: number;
  autoRetriesUsed: number;
  escalatedItems: string[];
  geminiCallsMade: number;
  externalTasksCompleted: number;
  summary: string;
  generatedAt: string;
}

export type StructureApprovalStatus =
  | 'not_proposed'
  | 'proposed_pending'
  | 'approved'
  | 'rejected';

export interface StructureProposalChapter {
  chapterNumber: number;
  title: string;
  topics: string[];
  learningObjectives: string[];
  prerequisites: string[];
  estimatedConcepts: number;
  estimatedQuestions: number;
  sourcePages?: string;
}

export interface StructureProposal {
  proposedBy: string;
  proposedAt: string;
  summary: string;
  bookId?: string;
  chapters: StructureProposalChapter[];
  reviewerNotes?: string;
  reviewedBy?: string;
  reviewedAt?: string;
}

export interface ProductionJob {
  id: string;
  programmeId: ProgrammeId;
  grade: 9 | 10 | 11 | 12;
  groupId: AcademicGroupId | 'admission';
  subjectId: string;
  subjectName: string;
  chapterNumber: number;
  chapterTitle: string;
  chapterId: string;
  sourceBundleId: string;
  scope: ProductionScope;
  executionMode: ExecutionMode;
  status: ProductionJobStatus;
  currentPhase: number;
  maxBudgetCalls: number;
  callsUsed: number;
  maxRetriesPerTask: number;
  trustedAutoApproveStructure?: boolean;
  structureStatus?: StructureApprovalStatus;
  proposedStructure?: StructureProposal;
  tasks: AgentTask[];
  verificationReportId?: string;
  productionReport?: ProductionReport;
  alerts: string[];
  createdAt: string;
  updatedAt: string;
}

export interface QuarantinedSubmission {
  id: string;
  sourceEndpoint: string;
  workerId: string;
  chapterId?: string;
  jobId?: string;
  taskId?: string;
  reason: string;
  validationErrors: string[];
  quarantinedAt: string;
  payloadExcerpt: string;
  status: 'quarantined' | 'resolved';
}

export type ExamKind =
  | 'topic_quiz'
  | 'chapter_test'
  | 'subject_test'
  | 'board_model_exam'
  | 'mock_exam';

export interface ExamSection {
  label: string;
  questionType: QuestionType;
  marksEach: number;
  questionIds: string[];
}

export interface ExamBlueprint {
  id: string;
  programmeId: ProgrammeId;
  grade: 9 | 10 | 11 | 12;
  groupId: AcademicGroupId | 'admission';
  subjectId: string;
  subjectName: string;
  chapterId?: string;
  title: string;
  examKind: ExamKind;
  durationMinutes: number;
  totalMarks: number;
  sections: ExamSection[];
  publicationStatus: PublicationStatus;
  reviewStage: ReviewStage;
  packVersion: number;
  reviewedBy: string;
  createdAt: string;
  updatedAt: string;
}

export interface ExamAnswerInput {
  questionId: string;
  response: string;
  selfScore?: number;
}

export interface ExamScoreRequest {
  submissionUuid: string;
  deviceUuid?: string;
  timeSpentSec: number;
  answers: ExamAnswerInput[];
}

export interface WeakTopicInsight {
  topicId: string;
  conceptId: string;
  conceptTitle: string;
  missedCount: number;
  totalCount: number;
  accuracyPercent: number;
}

export interface GradedExamItem {
  questionId: string;
  questionType: QuestionType;
  marksPossible: number;
  marksAwarded: number;
  isCorrect: boolean;
  correctAnswer: string;
  explanation: string;
}

export interface ExamScoreResponse {
  submissionUuid: string;
  examId: string;
  examTitle: string;
  scoreObtained: number;
  totalMarks: number;
  percentage: number;
  gradedCount: number;
  sectionBreakdown: {
    label: string;
    obtained: number;
    possible: number;
  }[];
  weakTopics: WeakTopicInsight[];
  items: GradedExamItem[];
  scoredAt: string;
  idempotentReplay: boolean;
}

export interface MonitoringIssueReport {
  id: string;
  chapterId: string;
  questionId?: string;
  conceptId?: string;
  category:
    | 'answer_error'
    | 'typo_katex'
    | 'syllabus_mismatch'
    | 'unit_error'
    | 'duplicate';
  description: string;
  reportedBy: string;
  status: 'open' | 'draft_fix_created' | 'resolved';
  proposedDraftChapterId?: string;
  createdAt: string;
  updatedAt: string;
}

export interface BookPageText {
  page: number;
  text: string;
}

export interface BookDocument {
  id: string;
  title: string;
  programmeId: ProgrammeId;
  grade: 9 | 10 | 11 | 12;
  groupId: AcademicGroupId | 'admission';
  subjectId: string;
  subjectName: string;
  curriculum: string;
  sourceBook: string;
  version: number;
  sha256: string;
  fileSizeBytes: number;
  pageCount: number;
  filename: string;
  storageTarget: 'disk_vault' | 'cloudflare_r2';
  r2Key?: string;
  extractedText: string;
  pageTexts: BookPageText[];
  metadata: {
    pdfTitle?: string;
    author?: string;
    extractedAt: string;
    extractionQuality: 'text_extracted' | 'needs_ocr_or_agent';
  };
  publicationStatus: 'draft' | 'published' | 'archived';
  isStudentVisible: boolean;
  permissionVerified: boolean;
  trustedAutoApproveStructure?: boolean;
  uploadedAt: string;
  updatedAt: string;
  productionJobIds: string[];
}

export interface RegisteredAgent {
  workerId: string;
  name: string;
  toolKind: 'freebuff' | 'opencode' | 'cursor' | 'claude_code' | 'codex' | 'verifier' | 'other';
  roles: AgentRoleId[];
  capabilities: string[];
  status: 'online' | 'busy' | 'paused' | 'offline';
  registeredAt: string;
  lastHeartbeatAt: string;
  tasksCompleted: number;
  tasksFailed: number;
  quotaRemainingNote?: string;
  currentTaskId?: string;
}

export interface PublishHistoryEntry {
  id: string;
  chapterId: string;
  packVersion: number;
  checksumSha256: string;
  publishedBy: string;
  publishedAt: string;
  target: 'cloud_store' | 'cloudflare_d1_r2';
  note?: string;
  snapshot?: CmsChapter;
}

export interface AgentSkillSpec {
  id: string;
  name: string;
  category: string;
  primaryRoles: AgentRoleId[];
  summary: string;
  inputSchema: Record<string, string>;
  outputSchema: Record<string, string>;
  qualityRules: string[];
  exampleSnippet: string;
}

export interface WorkspaceSecuritySettings {
  allowOptionalPaidServerAi: boolean;
  paidAiAuthorizedAt?: string;
  paidAiAuthorizedBy?: string;
  rateLimitPerMinute: number;
}

export interface AdminOverviewMetrics {
  totalSubjects: number;
  totalChapters: number;
  totalConcepts: number;
  totalLessons: number;
  totalQuestions: number;
  totalExams: number;
  uploadedBooks: number;
  pendingProduction: number;
  activeAgents: number;
  completedJobs: number;
  failedJobs: number;
  verifiedDraftsCount: number;
  flaggedDraftsCount: number;
  quarantinedCount: number;
  pendingApprovals: number;
  publishedContent: number;
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
  chapterIntro?: string;
  prerequisites?: string[];
  learningOutcomes: string[];
  publicationStatus: PublicationStatus;
  reviewStage?: ReviewStage;
  approvedConceptIds?: string[];
  approvedQuestionIds?: string[];
  authorWorkerId?: string;
  verifierWorkerId?: string;
  rejectionReason?: string;
  revisionFeedback?: string;
  bookId?: string;
  verificationSummary?: {
    overallPassed: boolean;
    score: number;
    escalatedCount: number;
    checksPassed: number;
    checksTotal: number;
  };
  lastJobId?: string;
  cloudflareSync?: {
    target: 'cloudflare_d1_r2' | 'cloud_store';
    synced: boolean;
    r2Key?: string;
    checksumSha256?: string;
    syncedAt?: string;
    error?: string;
  };
  packVersion: number;
  permissionVerified: boolean;
  isSampleTestPack?: boolean;
  origin?: QuestionOrigin;
  adConfig?: ChapterAdConfig;
  updatedAt?: string;
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

export interface CatalogChapterSummary {
  chapterId: string;
  programmeId: ProgrammeId;
  grade: 9 | 10 | 11 | 12;
  groupId: AcademicGroupId | 'admission';
  subjectId: string;
  subjectName: string;
  chapterNumber: number;
  title: string;
  packVersion: number;
  conceptCount: number;
  questionCount: number;
  hasMotionGraphics: boolean;
  hasGraphs: boolean;
  checksumSha256: string;
  adConfig: ChapterAdConfig;
  updatedAt: string;
}
