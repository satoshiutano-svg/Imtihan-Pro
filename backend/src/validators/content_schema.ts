import { z } from 'zod';

export const ProgrammeIdSchema = z.enum([
  'ssc_hssc',
  'mdcat',
  'etea_eng',
  'uni_entrance',
]);

export const QuestionTypeSchema = z.enum([
  'mcq',
  'multi_select',
  'true_false',
  'fill_in',
  'matching',
  'conceptual',
  'recall',
  'numerical',
  'short_answer',
  'long_answer',
  'diagram_based',
  'application',
]);

export const SourceTypeSchema = z.enum([
  'official_past_paper',
  'official_model_paper',
  'practice_original',
]);

export const NumericalStepsSchema = z.object({
  given: z.array(z.string().min(1)).min(1),
  required: z.string().min(1),
  formula: z.string().min(1),
  substitution: z.string().min(1),
  calculation: z.string().min(1),
  answerWithUnit: z.string().min(1),
});

export const VideoLinkSchema = z.object({
  title: z.string().min(2),
  channelName: z.string().min(2),
  youtubeUrl: z
    .string()
    .url()
    .refine(
      (u) =>
        u.startsWith('https://www.youtube.com/') ||
        u.startsWith('https://youtube.com/') ||
        u.startsWith('https://youtu.be/'),
      'Only valid YouTube HTTPS links are allowed.',
    ),
  durationLabel: z.string().min(1),
  language: z.enum(['en', 'ur']).default('ur'),
});

export const GlossaryHintSchema = z.object({
  term: z.string().min(1),
  urduMeaning: z.string().min(1),
  simpleHint: z.string().min(1),
});

export const VisualColorTokenSchema = z.enum([
  'primary',
  'secondary',
  'warning',
  'danger',
]);

export const MotionActorSchema = z.object({
  id: z.string().min(1),
  label: z.string().min(1),
  shape: z.enum(['circle', 'box', 'arrow', 'molecule', 'wave']),
  colorToken: VisualColorTokenSchema.default('primary'),
  startX: z.number().min(0).max(100),
  startY: z.number().min(0).max(100),
  endX: z.number().min(0).max(100),
  endY: z.number().min(0).max(100),
  size: z.number().min(4).max(40).optional(),
});

export const MotionStageSchema = z.object({
  atPercent: z.number().min(0).max(100),
  label: z.string().min(1),
  formulaLatex: z.string().optional(),
  callout: z.string().min(2),
});

export const MotionGraphicSpecSchema = z.object({
  id: z.string().min(1),
  title: z.string().min(2),
  caption: z.string().min(2),
  durationSec: z.number().min(1).max(30).default(5),
  sceneType: z.enum([
    'kinematics_track',
    'vector_motion',
    'reaction_flow',
    'wave_oscillation',
    'orbit_cycle',
  ]),
  actors: z.array(MotionActorSchema).min(1),
  stages: z.array(MotionStageSchema).min(1),
});

export const GraphSpecSchema = z
  .object({
    id: z.string().min(1),
    title: z.string().min(2),
    caption: z.string().min(2),
    xLabel: z.string().min(1),
    yLabel: z.string().min(1),
    xMin: z.number().finite(),
    xMax: z.number().finite(),
    yMin: z.number().finite(),
    yMax: z.number().finite(),
    series: z
      .array(
        z.object({
          name: z.string().min(1),
          colorToken: VisualColorTokenSchema.default('primary'),
          points: z
            .array(z.object({ x: z.number().finite(), y: z.number().finite() }))
            .min(2),
          showArea: z.boolean().optional(),
        }),
      )
      .min(1),
    highlights: z
      .array(
        z.object({
          x: z.number().finite(),
          y: z.number().finite(),
          label: z.string().min(1),
        }),
      )
      .default([]),
  })
  .refine((g) => g.xMax > g.xMin && g.yMax > g.yMin, {
    message: 'Graph bounds must satisfy xMax > xMin and yMax > yMin.',
  });

export const MicroCardSchema = z.object({
  stageTitle: z.string().min(2),
  body: z.string().min(5),
  quickCheckQuestion: z.string().optional(),
  quickCheckOptions: z.array(z.string()).default([]),
  quickCheckAnswer: z.string().optional(),
});

export const ConceptPayloadSchema = z.object({
  id: z.string().min(1),
  chapterId: z.string().min(1),
  topicId: z.string().min(1),
  orderIndex: z.number().int().nonnegative(),
  title: z.string().min(2),
  locale: z.enum(['en', 'ur']).default('en'),
  textDirection: z.enum(['ltr', 'rtl']).default('ltr'),
  simpleExplanation: z.string().min(10),
  definitions: z.array(z.object({ term: z.string(), definition: z.string() })).default([]),
  importantPoints: z.array(z.string()).default([]),
  formulas: z.array(z.object({
    expression: z.string(),
    description: z.string(),
    unit: z.string().optional(),
  })).default([]),
  diagrams: z.array(z.object({
    id: z.string(),
    caption: z.string(),
    svgMarkup: z.string().optional(),
    assetKey: z.string().optional(),
  })).default([]),
  workedExamples: z.array(z.object({
    prompt: z.string(),
    steps: z.array(z.string()),
    finalAnswer: z.string(),
  })).default([]),
  applications: z.array(z.string()).default([]),
  commonMistakes: z.array(z.object({
    mistake: z.string(),
    correction: z.string(),
  })).default([]),
  quickRevisionSummary: z.array(z.string()).min(1),
  relatedQuestionIds: z.array(z.string()).default([]),
  motionGraphics: z.array(MotionGraphicSpecSchema).default([]),
  graphs: z.array(GraphSpecSchema).default([]),
  videoLinks: z.array(VideoLinkSchema).default([]),
  glossaryHints: z.array(GlossaryHintSchema).default([]),
  microCards: z.array(MicroCardSchema).default([]),
  sourceBook: z.string().min(2),
  sourceEdition: z.string().default(''),
  sourcePage: z.string().min(1),
});

export const QuestionInputSchema = z.object({
  id: z.string().min(1),
  programmeId: ProgrammeIdSchema.default('ssc_hssc'),
  grade: z.number().int().min(9).max(12),
  groupId: z.string().min(1),
  subjectId: z.string().min(1),
  chapterId: z.string().min(1),
  topicId: z.string().min(1),
  conceptId: z.string().optional(),
  questionType: QuestionTypeSchema,
  difficulty: z.number().int().min(1).max(7),
  statement: z.string().min(5),
  locale: z.enum(['en', 'ur']).default('en'),
  textDirection: z.enum(['ltr', 'rtl']).default('ltr'),
  options: z.array(z.string()).default([]),
  multiSelectAnswers: z.array(z.string()).optional(),
  matchingPairs: z.array(z.object({ left: z.string().min(1), right: z.string().min(1) })).optional(),
  optionMisconceptions: z.record(z.string()).default({}),
  hints: z.array(z.string()).default([]),
  numericalSteps: NumericalStepsSchema.optional(),
  markingPoints: z.array(z.string()).default([]),
  correctAnswer: z.string().min(1),
  explanation: z.string().min(5),
  marks: z.number().int().min(1).max(20).default(1),
  sourceType: SourceTypeSchema.default('practice_original'),
  sourceBoardId: z.string().optional(),
  sourceYear: z.number().int().min(1990).max(2035).optional(),
  sourcePaperRef: z.string().optional(),
  sourcePageRef: z.string().optional(),
  origin: z
    .enum([
      'human_authored',
      'ai_generated_draft',
      'ai_reviewed',
      'agent_uploaded_draft',
    ])
    .default('human_authored'),
  reviewedBy: z.string().optional(),
}).superRefine((data, ctx) => {
  if (data.questionType === 'mcq' && data.options.length < 2) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'MCQ questions must include at least 2 options.',
      path: ['options'],
    });
  }
  if (data.questionType === 'numerical' && !data.numericalSteps) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'Numerical questions must provide the 6-step solution template.',
      path: ['numericalSteps'],
    });
  }
  if (
    (data.sourceType === 'official_past_paper' ||
      data.sourceType === 'official_model_paper') &&
    (!data.sourceBoardId || !data.sourceYear)
  ) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'Official board papers require sourceBoardId and sourceYear.',
      path: ['sourceBoardId'],
    });
  }
});

export const SyncAttemptBatchSchema = z.object({
  deviceUuid: z.string().uuid(),
  attempts: z.array(
    z.object({
      attemptUuid: z.string().uuid(),
      questionId: z.string().min(1),
      isCorrect: z.boolean(),
      hintsUsed: z.number().int().min(0).max(20).default(0),
      timeSpentSec: z.number().int().min(0).max(14400).default(0),
      attemptedAt: z.string().datetime(),
    }),
  ).min(1).max(100),
});

export const ExamBlueprintSchema = z.object({
  id: z.string().min(1),
  programmeId: ProgrammeIdSchema.default('ssc_hssc'),
  grade: z.number().int().min(9).max(12),
  groupId: z.string().min(1),
  subjectId: z.string().min(1),
  subjectName: z.string().min(1),
  chapterId: z.string().optional(),
  title: z.string().min(2),
  examKind: z.enum([
    'topic_quiz',
    'chapter_test',
    'subject_test',
    'board_model_exam',
    'mock_exam',
  ]),
  durationMinutes: z.number().int().min(1).max(240),
  totalMarks: z.number().int().min(1).max(200),
  sections: z
    .array(
      z.object({
        label: z.string().min(1),
        questionType: QuestionTypeSchema,
        marksEach: z.number().int().min(1).max(20),
        questionIds: z.array(z.string().min(1)),
      }),
    )
    .min(1),
  publicationStatus: z
    .enum(['draft', 'in_review', 'approved', 'published', 'unpublished'])
    .default('draft'),
  reviewStage: z
    .enum([
      'ai_generated',
      'auto_validated',
      'independently_reviewed',
      'human_approved',
      'published',
    ])
    .default('ai_generated'),
  packVersion: z.number().int().min(1).default(1),
  reviewedBy: z.string().default(''),
});

export const SyncChapterPackSchema = z.object({
  chapter: z.object({
    chapterId: z.string().min(1),
    programmeId: ProgrammeIdSchema.default('ssc_hssc'),
    grade: z.number().int().min(9).max(12),
    groupId: z.string().min(1),
    subjectId: z.string().min(1),
    subjectName: z.string().min(1),
    chapterNumber: z.number().int().min(1),
    title: z.string().min(2),
    learningOutcomes: z.array(z.string()).default([]),
    permissionVerified: z.boolean(),
    packVersion: z.number().int().min(1).default(1),
    concepts: z.array(z.record(z.unknown())).min(1),
    questions: z.array(z.record(z.unknown())).default([]),
  }),
  reviewedBy: z.string().min(2),
  exams: z.array(ExamBlueprintSchema).default([]),
});

export const BookUploadMetadataSchema = z.object({
  id: z.string().min(1).optional(),
  title: z.string().min(2),
  programmeId: ProgrammeIdSchema.default('ssc_hssc'),
  grade: z.number().int().min(9).max(12),
  groupId: z.string().min(1),
  subjectId: z.string().min(1).optional(),
  subjectName: z.string().min(1),
  curriculum: z.string().default('KPK BISE'),
  sha256: z.string().min(16).optional(),
  fileSizeBytes: z.number().int().nonnegative().optional(),
  pageCount: z.number().int().min(1).default(1),
  filename: z.string().min(1).optional(),
  r2Key: z.string().min(1).optional(),
  permissionVerified: z.boolean().default(true),
  isStudentVisible: z.boolean().default(true),
});

export const AgentRegistrationSchema = z.object({
  workerId: z.string().min(2).max(80),
  name: z.string().min(2).max(120),
  toolKind: z.enum(['freebuff', 'opencode', 'cursor', 'claude_code', 'codex', 'verifier', 'other']).default('other'),
  roles: z.array(z.string().min(1)).default([]),
  capabilities: z.array(z.string().min(1)).default([]),
  quotaRemainingNote: z.string().optional(),
});

export const AgentClaimTaskSchema = z.preprocess(
  (raw) => {
    if (raw && typeof raw === 'object' && !('workerId' in raw) && 'workerName' in raw) {
      return { ...(raw as Record<string, unknown>), workerId: (raw as Record<string, unknown>).workerName };
    }
    return raw;
  },
  z.object({
    workerId: z.string().min(2).max(80),
    role: z.string().optional(),
    leaseMinutes: z.number().int().min(1).max(60).default(15),
  }),
);

export const ExamScoreSubmissionSchema = z.object({
  submissionUuid: z.string().min(6).max(120),
  deviceUuid: z.string().optional(),
  timeSpentSec: z.number().int().min(0).max(28800).default(0),
  answers: z
    .array(
      z.object({
        questionId: z.string().min(1),
        response: z.string().default(''),
        selfScore: z.number().min(0).max(100).optional(),
      }),
    )
    .max(250),
});

export const StructureProposalSchema = z.object({
  workerName: z.string().min(2).max(100).default('external-architect'),
  summary: z.string().min(3).max(1000).optional(),
  bookId: z.string().optional(),
  chapters: z
    .array(
      z.object({
        chapterNumber: z.number().int().min(1),
        title: z.string().min(2),
        topics: z.array(z.string().min(1)).min(1),
        learningObjectives: z.array(z.string()).default([]),
        prerequisites: z.array(z.string()).default([]),
        estimatedConcepts: z.number().int().min(1).max(30).default(2),
        estimatedQuestions: z.number().int().min(1).max(100).default(8),
        sourcePages: z.string().optional(),
      }),
    )
    .min(1),
});
