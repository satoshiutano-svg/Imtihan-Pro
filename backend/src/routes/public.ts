import { Hono } from 'hono';
import type { Env } from '../types';
import {
  ExamScoreSubmissionSchema,
  ProgrammeIdSchema,
  SyncAttemptBatchSchema,
} from '../validators/content_schema';

export const publicRoutes = new Hono<{ Bindings: Env }>();

publicRoutes.get('/health', (c) => {
  return c.json({
    ok: true,
    service: 'roshan-study-api',
    environment: c.env.ENVIRONMENT,
  });
});

/**
 * Returns published chapter packs & metadata filtered by programme/grade/subject.
 * Uses KV edge cache when available to minimize D1 read usage.
 */
publicRoutes.get('/catalog', async (c) => {
  const programmeRaw = c.req.query('programme') ?? 'ssc_hssc';
  const progParsed = ProgrammeIdSchema.safeParse(programmeRaw);
  if (!progParsed.success) {
    return c.json({ error: 'Invalid programme parameter.' }, 400);
  }
  const programme = progParsed.data;
  const gradeRaw = c.req.query('grade');
  let gradeNum: number | null = null;
  if (gradeRaw !== undefined && gradeRaw !== '') {
    if (!/^(9|10|11|12)$/.test(gradeRaw)) {
      return c.json({ error: 'Invalid grade parameter (must be 9, 10, 11, or 12).' }, 400);
    }
    gradeNum = Number(gradeRaw);
  }
  const subjectId = c.req.query('subjectId');
  const cacheKey = `catalog:${programme}:${gradeNum ?? 'all'}:${subjectId ?? 'all'}`;

  const cached = await c.env.CATALOG_KV.get(cacheKey, 'json');
  if (cached) {
    c.header('Cache-Control', 'public, max-age=300');
    return c.json(cached);
  }

  const conditions = [`c.publication_status = 'published'`, `c.programme_id = ?`];
  const bindings: Array<string | number> = [programme];

  if (gradeNum !== null) {
    conditions.push('c.grade = ?');
    bindings.push(gradeNum);
  }
  if (subjectId) {
    conditions.push('c.subject_id = ?');
    bindings.push(subjectId);
  }

  const query = `
    SELECT
      c.id AS chapter_id,
      c.subject_id,
      c.grade,
      c.chapter_number,
      c.title,
      c.current_pack_version,
      p.r2_key,
      p.checksum_sha256,
      p.size_bytes,
      p.published_at
    FROM chapters c
    JOIN chapter_packs p
      ON p.chapter_id = c.id AND p.version = c.current_pack_version
    WHERE ${conditions.join(' AND ')}
    ORDER BY c.grade ASC, c.subject_id ASC, c.chapter_number ASC
  `;

  const result = await c.env.DB.prepare(query).bind(...bindings).all();
  const payload = {
    programme,
    generatedAt: new Date().toISOString(),
    chapters: result.results ?? [],
  };

  await c.env.CATALOG_KV.put(cacheKey, JSON.stringify(payload), {
    expirationTtl: 300,
  });

  c.header('Cache-Control', 'public, max-age=300');
  return c.json(payload);
});

/**
 * Streams an immutable versioned JSON chapter pack directly from R2.
 */
publicRoutes.get('/packs/:chapterId/:version', async (c) => {
  const chapterId = c.req.param('chapterId');
  const versionRaw = c.req.param('version').replace(/\.json$/, '');
  if (!/^[a-zA-Z0-9_-]+$/.test(chapterId) || !/^\d+$/.test(versionRaw)) {
    return c.json({ error: 'Invalid chapter pack identifier or version.' }, 400);
  }
  const key = `packs/${chapterId}/v${versionRaw}.json`;

  const obj = await c.env.CONTENT_BUCKET.get(key);
  if (!obj) {
    return c.json({ error: 'Chapter pack not found' }, 404);
  }

  return new Response(obj.body, {
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': 'public, max-age=31536000, immutable',
      ETag: obj.httpEtag,
    },
  });
});

/**
 * Idempotent optional attempt sync endpoint.
 * Prevents duplicate submissions via PRIMARY KEY (attempt_uuid) + INSERT OR IGNORE.
 */
publicRoutes.post('/sync/attempts', async (c) => {
  const body = await c.req.json().catch(() => null);
  const parsed = SyncAttemptBatchSchema.safeParse(body);

  if (!parsed.success) {
    return c.json(
      { error: 'Invalid sync payload', details: parsed.error.flatten() },
      400,
    );
  }

  const now = new Date().toISOString();
  const stmt = c.env.DB.prepare(`
    INSERT OR IGNORE INTO sync_attempts (
      attempt_uuid, device_uuid, question_id, is_correct,
      hints_used, time_spent_sec, attempted_at, synced_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `);

  const batch = parsed.data.attempts.map((a) =>
    stmt.bind(
      a.attemptUuid,
      parsed.data.deviceUuid,
      a.questionId,
      a.isCorrect ? 1 : 0,
      a.hintsUsed,
      a.timeSpentSec,
      a.attemptedAt,
      now,
    ),
  );

  await c.env.DB.batch(batch);

  return c.json({
    acceptedCount: parsed.data.attempts.length,
    acceptedUuids: parsed.data.attempts.map((a) => a.attemptUuid),
    syncedAt: now,
  });
});

/**
 * Returns published exam blueprints (topic quizzes, chapter tests, board model exams).
 * Enforces strict isolation by programmeId.
 */
publicRoutes.get('/exams', async (c) => {
  const programmeRaw = c.req.query('programme') ?? 'ssc_hssc';
  const progParsed = ProgrammeIdSchema.safeParse(programmeRaw);
  if (!progParsed.success) {
    return c.json({ error: 'Invalid programme parameter.' }, 400);
  }
  const programme = progParsed.data;
  const gradeRaw = c.req.query('grade');
  let gradeNum: number | null = null;
  if (gradeRaw !== undefined && gradeRaw !== '') {
    if (!/^(9|10|11|12)$/.test(gradeRaw)) {
      return c.json({ error: 'Invalid grade parameter (must be 9, 10, 11, or 12).' }, 400);
    }
    gradeNum = Number(gradeRaw);
  }

  const conditions = [`publication_status = 'published'`, `programme_id = ?`];
  const bindings: Array<string | number> = [programme];
  if (gradeNum !== null) {
    conditions.push('grade = ?');
    bindings.push(gradeNum);
  }

  const result = await c.env.DB.prepare(
    `SELECT * FROM exam_blueprints WHERE ${conditions.join(' AND ')} ORDER BY grade ASC, updated_at DESC`,
  )
    .bind(...bindings)
    .all();

  return c.json({
    programme,
    generatedAt: new Date().toISOString(),
    exams: result.results ?? [],
  });
});

/**
 * Server-side idempotent exam grading with weak-topic breakdown.
 */
publicRoutes.post('/exams/:examId/score', async (c) => {
  const examId = c.req.param('examId');
  const body = await c.req.json().catch(() => null);
  const parsed = ExamScoreSubmissionSchema.safeParse(body);
  if (!parsed.success) {
    return c.json({ error: 'Invalid exam submission', details: parsed.error.flatten() }, 400);
  }

  const cacheKey = `exam_score:${examId}:${parsed.data.submissionUuid}`;
  const cached = await c.env.CATALOG_KV.get(cacheKey, 'json');
  if (cached && typeof cached === 'object') {
    return c.json({ ...(cached as Record<string, unknown>), idempotentReplay: true });
  }

  const exam = await c.env.DB.prepare(
    `SELECT id, title, sections_json, total_marks, publication_status FROM exam_blueprints WHERE id = ?`,
  )
    .bind(examId)
    .first<{
      id: string;
      title: string;
      sections_json: string;
      total_marks: number;
      publication_status: string;
    }>();

  if (!exam || exam.publication_status !== 'published') {
    return c.json({ error: 'Published exam not found.' }, 404);
  }

  const sections = JSON.parse(exam.sections_json || '[]') as Array<{
    label: string;
    questionType: string;
    marksEach: number;
    questionIds: string[];
  }>;
  const answerMap = new Map(parsed.data.answers.map((a) => [a.questionId, a]));

  const allQuestionIds = sections.flatMap((s) => s.questionIds);
  const placeholders = allQuestionIds.map(() => '?').join(',');
  const qRows =
    allQuestionIds.length > 0
      ? await c.env.DB.prepare(
          `SELECT id, topic_id, concept_id, question_type, answer_json, explanation, marks FROM questions WHERE id IN (${placeholders})`,
        )
          .bind(...allQuestionIds)
          .all<{
            id: string;
            topic_id: string;
            concept_id: string | null;
            question_type: string;
            answer_json: string;
            explanation: string;
            marks: number;
          }>()
      : { results: [] };

  const qMap = new Map((qRows.results ?? []).map((q) => [q.id, q]));
  let scoreObtained = 0;
  let totalPossible = 0;
  const sectionBreakdown: Array<{ label: string; obtained: number; possible: number }> = [];
  const items: Array<Record<string, unknown>> = [];
  const topicAgg = new Map<string, { topicId: string; conceptId: string; missed: number; total: number }>();

  for (const sec of sections) {
    let secObtained = 0;
    let secPossible = 0;
    for (const qId of sec.questionIds) {
      const q = qMap.get(qId);
      const possible = sec.marksEach || q?.marks || 1;
      secPossible += possible;
      totalPossible += possible;
      const ans = answerMap.get(qId);
      let awarded = 0;
      let correct = false;
      let expected = '';
      if (q) {
        const parsedAns = JSON.parse(q.answer_json || '{}') as { correctAnswer?: string };
        expected = String(parsedAns.correctAnswer ?? '');
        if (q.question_type === 'short_answer' || q.question_type === 'long_answer') {
          awarded = Math.max(0, Math.min(possible, Number(ans?.selfScore ?? 0)));
          correct = awarded >= possible * 0.5;
        } else {
          const norm = (v: string) => v.trim().toLowerCase().replace(/\s+/g, '');
          correct = norm(ans?.response ?? '') === norm(expected) && norm(expected).length > 0;
          awarded = correct ? possible : 0;
        }
        const tKey = q.concept_id ?? q.topic_id;
        const agg = topicAgg.get(tKey) ?? {
          topicId: q.topic_id,
          conceptId: q.concept_id ?? q.topic_id,
          missed: 0,
          total: 0,
        };
        agg.total += 1;
        if (!correct) agg.missed += 1;
        topicAgg.set(tKey, agg);
      }
      secObtained += awarded;
      scoreObtained += awarded;
      items.push({
        questionId: qId,
        questionType: q?.question_type ?? sec.questionType,
        marksPossible: possible,
        marksAwarded: awarded,
        isCorrect: correct,
        correctAnswer: expected,
        explanation: q?.explanation ?? '',
      });
    }
    sectionBreakdown.push({ label: sec.label, obtained: secObtained, possible: secPossible });
  }

  const denominator = totalPossible > 0 ? totalPossible : exam.total_marks;
  const resultPayload = {
    submissionUuid: parsed.data.submissionUuid,
    examId: exam.id,
    examTitle: exam.title,
    scoreObtained,
    totalMarks: denominator,
    percentage: Math.round((scoreObtained / Math.max(1, denominator)) * 100),
    gradedCount: items.length,
    sectionBreakdown,
    weakTopics: Array.from(topicAgg.values())
      .filter((t) => t.missed > 0)
      .map((t) => ({
        topicId: t.topicId,
        conceptId: t.conceptId,
        conceptTitle: t.topicId,
        missedCount: t.missed,
        totalCount: t.total,
        accuracyPercent: Math.round(((t.total - t.missed) / Math.max(1, t.total)) * 100),
      })),
    items,
    scoredAt: new Date().toISOString(),
    idempotentReplay: false,
  };

  await c.env.CATALOG_KV.put(cacheKey, JSON.stringify(resultPayload), {
    expirationTtl: 86400,
  });

  return c.json(resultPayload);
});

/**
 * Returns student-visible uploaded textbook PDFs with extracted text index.
 * Zero internal tokens or agent metadata exposed.
 */
publicRoutes.get('/books', async (c) => {
  const programmeRaw = c.req.query('programme') ?? 'ssc_hssc';
  const progParsed = ProgrammeIdSchema.safeParse(programmeRaw);
  if (!progParsed.success) {
    return c.json({ error: 'Invalid programme parameter.' }, 400);
  }
  const result = await c.env.DB.prepare(
    `SELECT id, title, programme_id, grade, group_id, subject_id, subject_name, curriculum, source_book, version, sha256, file_size_bytes, page_count, filename, page_texts_json, metadata_json, uploaded_at, updated_at FROM books WHERE is_student_visible = 1 AND publication_status != 'archived' AND programme_id = ? ORDER BY grade ASC, subject_name ASC`,
  )
    .bind(progParsed.data)
    .all();

  return c.json({
    programme: progParsed.data,
    generatedAt: new Date().toISOString(),
    books: (result.results ?? []).map((b: Record<string, unknown>) => ({
      ...b,
      pdfUrl: `/v1/books/${encodeURIComponent(String(b.id))}/pdf`,
    })),
  });
});

publicRoutes.get('/books/:bookId/pdf', async (c) => {
  const bookId = c.req.param('bookId');
  const book = await c.env.DB.prepare(
    `SELECT id, filename, r2_key, is_student_visible, publication_status FROM books WHERE id = ?`,
  )
    .bind(bookId)
    .first<{ id: string; filename: string; r2_key: string; is_student_visible: number; publication_status: string }>();

  if (!book || book.is_student_visible !== 1 || book.publication_status === 'archived') {
    return c.json({ error: 'Book PDF not published' }, 404);
  }

  const obj = await c.env.CONTENT_BUCKET.get(book.r2_key);
  if (!obj) {
    return c.json({ error: 'Book PDF binary not found' }, 404);
  }

  return new Response(obj.body, {
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `inline; filename="${book.filename.replace(/"/g, '')}"`,
      'Cache-Control': 'public, max-age=300',
    },
  });
});
