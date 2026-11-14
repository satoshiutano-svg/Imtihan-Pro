import { describe, expect, it } from 'vitest';
import {
  AgentClaimTaskSchema,
  AgentRegistrationSchema,
  BookUploadMetadataSchema,
  ConceptPayloadSchema,
  ExamBlueprintSchema,
  ExamScoreSubmissionSchema,
  QuestionInputSchema,
  StructureProposalSchema,
  SyncAttemptBatchSchema,
  SyncChapterPackSchema,
} from '../src/validators/content_schema';

describe('Roshan Study Content & Sync Schemas', () => {
  it('requires all 6 steps for numerical questions', () => {
    const invalid = QuestionInputSchema.safeParse({
      id: 'q_phy_9_2_num_1',
      grade: 9,
      groupId: 'ssc_science',
      subjectId: 'physics_9',
      chapterId: 'phy_9_ch2',
      topicId: 'phy_9_ch2_t1',
      questionType: 'numerical',
      difficulty: 4,
      statement: 'A car starts from rest with uniform acceleration 2 m/s^2 for 5 s. Find final velocity.',
      correctAnswer: '10 m/s',
      explanation: 'Using first equation of motion vf = vi + at.',
      sourceType: 'practice_original',
    });

    expect(invalid.success).toBe(false);
  });

  it('requires board and year for official past paper questions', () => {
    const missingSource = QuestionInputSchema.safeParse({
      id: 'q_phy_9_past_1',
      grade: 9,
      groupId: 'ssc_science',
      subjectId: 'physics_9',
      chapterId: 'phy_9_ch2',
      topicId: 'phy_9_ch2_t1',
      questionType: 'short_answer',
      difficulty: 6,
      statement: 'Define uniform velocity.',
      correctAnswer: 'A body covers equal displacements in equal intervals of time.',
      explanation: 'Includes both magnitude and direction constancy.',
      marks: 3,
      sourceType: 'official_past_paper',
    });

    expect(missingSource.success).toBe(false);
  });

  it('validates multi_select, true_false, fill_in, and matching question types', () => {
    const multi = QuestionInputSchema.safeParse({
      id: 'q_multi_1',
      grade: 9,
      groupId: 'ssc_science',
      subjectId: 'phy_9',
      chapterId: 'phy_9_ch2',
      topicId: 'phy_9_ch2_t1',
      questionType: 'multi_select',
      difficulty: 3,
      statement: 'Select all vector quantities from the list below.',
      options: ['Velocity', 'Speed', 'Acceleration', 'Mass'],
      multiSelectAnswers: ['Velocity', 'Acceleration'],
      correctAnswer: 'Velocity||Acceleration',
      explanation: 'Velocity and acceleration have both magnitude and direction.',
    });
    expect(multi.success).toBe(true);

    const tf = QuestionInputSchema.safeParse({
      id: 'q_tf_1',
      grade: 9,
      groupId: 'ssc_science',
      subjectId: 'phy_9',
      chapterId: 'phy_9_ch2',
      topicId: 'phy_9_ch2_t1',
      questionType: 'true_false',
      difficulty: 1,
      statement: 'Displacement can be zero even when total distance covered is non-zero.',
      options: ['True', 'False'],
      correctAnswer: 'True',
      explanation: 'Returning to the starting point produces zero net displacement.',
    });
    expect(tf.success).toBe(true);

    const matching = QuestionInputSchema.safeParse({
      id: 'q_match_1',
      grade: 9,
      groupId: 'ssc_science',
      subjectId: 'phy_9',
      chapterId: 'phy_9_ch2',
      topicId: 'phy_9_ch2_t1',
      questionType: 'matching',
      difficulty: 2,
      statement: 'Match each physical quantity with its SI unit.',
      matchingPairs: [
        { left: 'Force', right: 'Newton (N)' },
        { left: 'Velocity', right: 'm/s' },
      ],
      correctAnswer: 'Force->Newton (N)||Velocity->m/s',
      explanation: 'Standard SI units in KPK Physics Grade 9.',
    });
    expect(matching.success).toBe(true);
  });

  it('validates a complete 12-part concept payload and sync batch', () => {
    const concept = ConceptPayloadSchema.safeParse({
      id: 'c_phy_9_2_1',
      chapterId: 'phy_9_ch2',
      topicId: 'phy_9_ch2_t1',
      orderIndex: 1,
      title: 'Speed and Velocity',
      simpleExplanation: 'Speed tells how fast an object moves; velocity includes direction.',
      quickRevisionSummary: ['Speed is scalar (m/s)', 'Velocity is vector (m/s)'],
      sourceBook: 'KPECTB Physics Grade 9 (English Medium)',
      sourcePage: '35',
    });

    expect(concept.success).toBe(true);

    const sync = SyncAttemptBatchSchema.safeParse({
      deviceUuid: '550e8400-e29b-41d4-a716-446655440000',
      attempts: [
        {
          attemptUuid: '550e8400-e29b-41d4-a716-446655440001',
          questionId: 'q_phy_9_2_1',
          isCorrect: true,
          hintsUsed: 0,
          timeSpentSec: 18,
          attemptedAt: '2026-11-13T10:00:00.000Z',
        },
      ],
    });

    expect(sync.success).toBe(true);
  });

  it('validates motionGraphics and coordinate graphs inside concepts', () => {
    const withVisuals = ConceptPayloadSchema.safeParse({
      id: 'c_phy_9_2_motion',
      chapterId: 'phy_9_ch2',
      topicId: 'phy_9_ch2_t1',
      orderIndex: 1,
      title: 'Uniform Acceleration Motion',
      simpleExplanation: 'Velocity increases equally in equal intervals of time.',
      quickRevisionSummary: ['Slope of v-t graph equals acceleration'],
      motionGraphics: [
        {
          id: 'mg_1',
          title: 'Bus Acceleration Track',
          caption: 'Velocity arrow grows steadily over 4 seconds.',
          durationSec: 4,
          sceneType: 'kinematics_track',
          actors: [
            {
              id: 'bus',
              label: 'Bus',
              shape: 'box',
              colorToken: 'primary',
              startX: 12,
              startY: 60,
              endX: 85,
              endY: 60,
            },
          ],
          stages: [
            {
              atPercent: 0,
              label: 'Start',
              formulaLatex: 'v_i = 0\\text{ m/s}',
              callout: 'Bus starts from rest.',
            },
          ],
        },
      ],
      graphs: [
        {
          id: 'gr_1',
          title: 'Velocity-Time Graph',
          caption: 'Straight line with positive slope.',
          xLabel: 'Time t (s)',
          yLabel: 'Velocity v (m/s)',
          xMin: 0,
          xMax: 5,
          yMin: 0,
          yMax: 15,
          series: [
            {
              name: 'v = 3t',
              colorToken: 'primary',
              points: [
                { x: 0, y: 0 },
                { x: 5, y: 15 },
              ],
            },
          ],
        },
      ],
      sourceBook: 'KPECTB Physics Grade 9 (English Medium)',
      sourcePage: '40',
    });

    expect(withVisuals.success).toBe(true);
  });

  it('validates exam blueprints and full chapter sync payloads', () => {
    const exam = ExamBlueprintSchema.safeParse({
      id: 'exam_phy_9_ch2_board',
      programmeId: 'ssc_hssc',
      grade: 9,
      groupId: 'ssc_science',
      subjectId: 'phy_9',
      subjectName: 'Physics (English Medium)',
      chapterId: 'phy_9_ch2',
      title: 'Kinematics Chapter Test',
      examKind: 'chapter_test',
      durationMinutes: 35,
      totalMarks: 25,
      sections: [
        {
          label: 'Section A — MCQs',
          questionType: 'mcq',
          marksEach: 1,
          questionIds: ['q_1', 'q_2'],
        },
      ],
    });
    expect(exam.success).toBe(true);

    const syncPack = SyncChapterPackSchema.safeParse({
      reviewedBy: 'KPK Subject Reviewer',
      chapter: {
        chapterId: 'phy_9_ch2',
        programmeId: 'ssc_hssc',
        grade: 9,
        groupId: 'ssc_science',
        subjectId: 'phy_9',
        subjectName: 'Physics (English Medium)',
        chapterNumber: 2,
        title: 'Kinematics',
        permissionVerified: true,
        concepts: [{ id: 'c1', title: 'Speed' }],
        questions: [],
      },
      exams: [],
    });
    expect(syncPack.success).toBe(true);
  });

  it('validates book upload metadata and external agent registration/claim payloads', () => {
    const bookMeta = BookUploadMetadataSchema.safeParse({
      title: 'KPECTB Physics Grade 9',
      programmeId: 'ssc_hssc',
      grade: 9,
      groupId: 'ssc_science',
      subjectName: 'Physics (English Medium)',
      curriculum: 'KPK BISE',
      permissionVerified: true,
      isStudentVisible: true,
    });
    expect(bookMeta.success).toBe(true);

    const reg = AgentRegistrationSchema.safeParse({
      workerId: 'freebuff-worker-1',
      name: 'Freebuff STEM Author',
      toolKind: 'freebuff',
      roles: ['concept_writer', 'numerical_specialist'],
      capabilities: ['katex', 'svg_motion', 'kpk_6step'],
    });
    expect(reg.success).toBe(true);

    const claim = AgentClaimTaskSchema.safeParse({
      workerName: 'opencode-verifier-1',
      role: 'independent_answer_validator',
    });
    expect(claim.success).toBe(true);
  });

  it('validates exam score submissions and textbook structure proposals', () => {
    const score = ExamScoreSubmissionSchema.safeParse({
      submissionUuid: 'sub-2026-11-14-0001',
      timeSpentSec: 420,
      answers: [
        { questionId: 'q_1', response: 'm/s' },
        { questionId: 'q_written_1', response: 'Work equals F dot d', selfScore: 2 },
      ],
    });
    expect(score.success).toBe(true);

    const structure = StructureProposalSchema.safeParse({
      workerName: 'freebuff-architect-1',
      summary: 'KPECTB Physics 9 Chapters 1-2 structure proposal',
      chapters: [
        {
          chapterNumber: 1,
          title: 'Physical Quantities and Measurement',
          topics: ['Base and Derived Quantities', 'Vernier Callipers'],
          learningObjectives: ['Distinguish scalar and vector units'],
          prerequisites: ['Basic arithmetic'],
          estimatedConcepts: 3,
          estimatedQuestions: 12,
        },
      ],
    });
    expect(structure.success).toBe(true);
  });
});

