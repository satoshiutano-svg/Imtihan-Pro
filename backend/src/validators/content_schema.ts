import { z } from 'zod';

export const ProgrammeIdSchema = z.enum([
  'ssc_hssc',
  'mdcat',
  'etea_eng',
  'uni_entrance',
]);

export const QuestionTypeSchema = z.enum([
  'mcq',
  'conceptual',
  'recall',
  'fill_in',
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
  optionMisconceptions: z.record(z.string()).default({}),
  hints: z.array(z.string()).default([]),
  numericalSteps: NumericalStepsSchema.optional(),
  markingPoints: z.array(z.string()).default([]),
  correctAnswer: z.string().min(1),
  explanation: z.string().min(5),
  marks: z.number().int().min(1).max(20).default(1),
  sourceType: SourceTypeSchema,
  sourceBoardId: z.string().optional(),
  sourceYear: z.number().int().min(1990).max(2035).optional(),
  sourcePaperRef: z.string().optional(),
  sourcePageRef: z.string().optional(),
  origin: z
    .enum(['human_authored', 'ai_generated_draft', 'ai_reviewed'])
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
