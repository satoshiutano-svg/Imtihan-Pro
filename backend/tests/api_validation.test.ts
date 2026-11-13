import { describe, expect, it } from 'vitest';
import {
  ConceptPayloadSchema,
  QuestionInputSchema,
  SyncAttemptBatchSchema,
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
});
