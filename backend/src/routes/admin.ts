import { Hono } from 'hono';
import type { Env } from '../types';
import { archiveJsonPackToTelegram } from '../services/telegram_archive';
import {
  ConceptPayloadSchema,
  QuestionInputSchema,
} from '../validators/content_schema';

export const adminRoutes = new Hono<{ Bindings: Env }>();

async function constantTimeEqual(a: string, b: string): Promise<boolean> {
  const enc = new TextEncoder();
  const [hashA, hashB] = await Promise.all([
    crypto.subtle.digest('SHA-256', enc.encode(a)),
    crypto.subtle.digest('SHA-256', enc.encode(b)),
  ]);
  const bytesA = new Uint8Array(hashA);
  const bytesB = new Uint8Array(hashB);
  let diff = a.length === b.length ? 0 : 1;
  for (let i = 0; i < bytesA.length; i++) {
    diff |= bytesA[i] ^ bytesB[i];
  }
  return diff === 0;
}

/**
 * Constant-time bearer token check for admin routes.
 * Production deployments should additionally place /v1/admin/* behind Cloudflare Access.
 */
adminRoutes.use('*', async (c, next) => {
  const configuredToken = c.env.ADMIN_API_TOKEN;
  if (!configuredToken) {
    return c.json({ error: 'Admin API is disabled (token not configured).' }, 503);
  }

  const authHeader = c.req.header('Authorization') ?? '';
  const provided = authHeader.startsWith('Bearer ')
    ? authHeader.slice('Bearer '.length).trim()
    : '';

  if (provided.length === 0 || !(await constantTimeEqual(provided, configuredToken))) {
    return c.json({ error: 'Unauthorized' }, 401);
  }

  await next();
});

adminRoutes.post('/concepts', async (c) => {
  const body = await c.req.json().catch(() => null);
  const parsed = ConceptPayloadSchema.safeParse(body);
  if (!parsed.success) {
    return c.json({ error: 'Validation failed', details: parsed.error.flatten() }, 400);
  }

  const d = parsed.data;
  const now = new Date().toISOString();

  await c.env.DB.prepare(`
    INSERT INTO concepts (
      id, chapter_id, topic_id, order_index, title, locale, text_direction,
      payload_json, source_book, source_edition, source_page, review_status, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'draft', ?)
    ON CONFLICT(id) DO UPDATE SET
      topic_id = excluded.topic_id,
      order_index = excluded.order_index,
      title = excluded.title,
      locale = excluded.locale,
      text_direction = excluded.text_direction,
      payload_json = excluded.payload_json,
      source_book = excluded.source_book,
      source_edition = excluded.source_edition,
      source_page = excluded.source_page,
      review_status = 'draft',
      updated_at = excluded.updated_at
  `)
    .bind(
      d.id,
      d.chapterId,
      d.topicId,
      d.orderIndex,
      d.title,
      d.locale,
      d.textDirection,
      JSON.stringify(d),
      d.sourceBook,
      d.sourceEdition,
      d.sourcePage,
      now,
    )
    .run();

  return c.json({ ok: true, id: d.id, reviewStatus: 'draft' });
});

adminRoutes.post('/questions', async (c) => {
  const body = await c.req.json().catch(() => null);
  const parsed = QuestionInputSchema.safeParse(body);
  if (!parsed.success) {
    return c.json({ error: 'Validation failed', details: parsed.error.flatten() }, 400);
  }

  const q = parsed.data;
  const now = new Date().toISOString();

  await c.env.DB.prepare(`
    INSERT INTO questions (
      id, programme_id, grade, group_id, subject_id, chapter_id, topic_id,
      concept_id, question_type, difficulty, statement, locale, text_direction,
      payload_json, answer_json, explanation, marks, source_type,
      source_board_id, source_year, source_paper_ref, source_page_ref,
      publication_status, reviewed_by, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'draft', ?, ?)
    ON CONFLICT(id) DO UPDATE SET
      programme_id = excluded.programme_id,
      grade = excluded.grade,
      group_id = excluded.group_id,
      subject_id = excluded.subject_id,
      chapter_id = excluded.chapter_id,
      topic_id = excluded.topic_id,
      concept_id = excluded.concept_id,
      question_type = excluded.question_type,
      difficulty = excluded.difficulty,
      statement = excluded.statement,
      locale = excluded.locale,
      text_direction = excluded.text_direction,
      payload_json = excluded.payload_json,
      answer_json = excluded.answer_json,
      explanation = excluded.explanation,
      marks = excluded.marks,
      source_type = excluded.source_type,
      source_board_id = excluded.source_board_id,
      source_year = excluded.source_year,
      source_paper_ref = excluded.source_paper_ref,
      source_page_ref = excluded.source_page_ref,
      publication_status = 'draft',
      reviewed_by = excluded.reviewed_by,
      updated_at = excluded.updated_at
  `)
    .bind(
      q.id,
      q.programmeId,
      q.grade,
      q.groupId,
      q.subjectId,
      q.chapterId,
      q.topicId,
      q.conceptId ?? null,
      q.questionType,
      q.difficulty,
      q.statement,
      q.locale,
      q.textDirection,
      JSON.stringify({
        options: q.options,
        optionMisconceptions: q.optionMisconceptions,
        hints: q.hints,
        numericalSteps: q.numericalSteps ?? null,
        markingPoints: q.markingPoints,
      }),
      JSON.stringify({ correctAnswer: q.correctAnswer }),
      q.explanation,
      q.marks,
      q.sourceType,
      q.sourceBoardId ?? null,
      q.sourceYear ?? null,
      q.sourcePaperRef ?? null,
      q.sourcePageRef ?? null,
      q.reviewedBy ?? null,
      now,
    )
    .run();

  return c.json({ ok: true, id: q.id, publicationStatus: 'draft' });
});

/**
 * Validates all concepts & questions in a chapter before publishing.
 * Enforces human reviewer sign-off on important long-answer / official items.
 */
adminRoutes.post('/chapters/:id/validate', async (c) => {
  const chapterId = c.req.param('id');
  const concepts = await c.env.DB.prepare(
    `SELECT id, title, source_book, source_page, review_status FROM concepts WHERE chapter_id = ?`,
  )
    .bind(chapterId)
    .all<{ id: string; title: string; source_book: string; source_page: string; review_status: string }>();

  const questions = await c.env.DB.prepare(
    `SELECT id, question_type, explanation, reviewed_by, source_type FROM questions WHERE chapter_id = ?`,
  )
    .bind(chapterId)
    .all<{ id: string; question_type: string; explanation: string; reviewed_by: string | null; source_type: string }>();

  const issues: string[] = [];
  if ((concepts.results?.length ?? 0) === 0) {
    issues.push('Chapter has zero concepts.');
  }
  for (const concept of concepts.results ?? []) {
    if (!concept.source_book || !concept.source_page) {
      issues.push(`Concept ${concept.id} is missing source book or page reference.`);
    }
  }
  for (const q of questions.results ?? []) {
    if (!q.explanation || q.explanation.trim().length < 5) {
      issues.push(`Question ${q.id} is missing a complete explanation.`);
    }
    if (
      (q.question_type === 'long_answer' || q.source_type === 'official_past_paper') &&
      !q.reviewed_by
    ) {
      issues.push(`Question ${q.id} requires human reviewer sign-off (reviewedBy).`);
    }
  }

  return c.json({
    chapterId,
    valid: issues.length === 0,
    conceptCount: concepts.results?.length ?? 0,
    questionCount: questions.results?.length ?? 0,
    issues,
  });
});

/**
 * Compiles a deterministic versioned JSON pack into R2, updates D1,
 * invalidates KV catalog cache, and archives a snapshot to private Telegram.
 */
adminRoutes.post('/chapters/:id/publish', async (c) => {
  const chapterId = c.req.param('id');
  const chapter = await c.env.DB.prepare(`SELECT * FROM chapters WHERE id = ?`)
    .bind(chapterId)
    .first<{
      id: string;
      programme_id: string;
      subject_id: string;
      grade: number;
      title: string;
      current_pack_version: number;
    }>();

  if (!chapter) {
    return c.json({ error: 'Chapter not found' }, 404);
  }

  const topics = await c.env.DB.prepare(
    `SELECT * FROM topics WHERE chapter_id = ? ORDER BY order_index ASC`,
  ).bind(chapterId).all();

  const concepts = await c.env.DB.prepare(
    `SELECT * FROM concepts WHERE chapter_id = ? ORDER BY order_index ASC`,
  ).bind(chapterId).all<{ id: string; source_book: string; source_page: string }>();

  const questions = await c.env.DB.prepare(
    `SELECT * FROM questions WHERE chapter_id = ?`,
  ).bind(chapterId).all<{
    id: string;
    question_type: string;
    explanation: string;
    reviewed_by: string | null;
    source_type: string;
  }>();

  const publishIssues: string[] = [];
  if ((concepts.results?.length ?? 0) === 0) {
    publishIssues.push('Chapter has zero concepts.');
  }
  for (const concept of concepts.results ?? []) {
    if (!concept.source_book || !concept.source_page) {
      publishIssues.push(`Concept ${concept.id} is missing source book or page reference.`);
    }
  }
  for (const q of questions.results ?? []) {
    if (!q.explanation || q.explanation.trim().length < 5) {
      publishIssues.push(`Question ${q.id} is missing a complete explanation.`);
    }
    if (
      (q.question_type === 'long_answer' || q.source_type === 'official_past_paper') &&
      !q.reviewed_by
    ) {
      publishIssues.push(`Question ${q.id} requires human reviewer sign-off (reviewedBy).`);
    }
  }

  if (publishIssues.length > 0) {
    return c.json(
      { error: 'Publish validation failed', issues: publishIssues },
      400,
    );
  }

  const nextVersion = (chapter.current_pack_version ?? 0) + 1;
  const now = new Date().toISOString();

  const packObject = {
    schemaVersion: 1,
    chapterId: chapter.id,
    packVersion: nextVersion,
    publishedAt: now,
    chapter,
    topics: topics.results ?? [],
    concepts: concepts.results ?? [],
    questions: questions.results ?? [],
  };

  const jsonContent = JSON.stringify(packObject);
  const digestBuffer = await crypto.subtle.digest(
    'SHA-256',
    new TextEncoder().encode(jsonContent),
  );
  const checksumSha256 = Array.from(new Uint8Array(digestBuffer))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');

  const r2Key = `packs/${chapterId}/v${nextVersion}.json`;
  await c.env.CONTENT_BUCKET.put(r2Key, jsonContent, {
    httpMetadata: { contentType: 'application/json; charset=utf-8' },
  });

  const archiveRes = await archiveJsonPackToTelegram(
    c.env,
    `${chapterId}_v${nextVersion}.json`,
    jsonContent,
    `Roshan Study pack: ${chapter.title} (Grade ${chapter.grade}, v${nextVersion}, sha256=${checksumSha256.slice(0, 12)})`,
  );

  await c.env.DB.batch([
    c.env.DB.prepare(`
      INSERT INTO chapter_packs (
        id, chapter_id, version, r2_key, checksum_sha256, size_bytes, telegram_message_id, published_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).bind(
      `${chapterId}_v${nextVersion}`,
      chapterId,
      nextVersion,
      r2Key,
      checksumSha256,
      jsonContent.length,
      archiveRes.messageId ?? null,
      now,
    ),
    c.env.DB.prepare(`
      UPDATE chapters
      SET publication_status = 'published',
          current_pack_version = ?,
          updated_at = ?
      WHERE id = ?
    `).bind(nextVersion, now, chapterId),
    c.env.DB.prepare(`
      UPDATE questions SET publication_status = 'published' WHERE chapter_id = ?
    `).bind(chapterId),
  ]);

  if (c.env.CATALOG_KV) {
    const prog = chapter.programme_id ?? 'ssc_hssc';
    await Promise.all([
      c.env.CATALOG_KV.delete(`catalog:${prog}:all:all`),
      c.env.CATALOG_KV.delete(`catalog:${prog}:${chapter.grade}:all`),
      c.env.CATALOG_KV.delete(`catalog:${prog}:all:${chapter.subject_id}`),
      c.env.CATALOG_KV.delete(`catalog:${prog}:${chapter.grade}:${chapter.subject_id}`),
    ]);
  }

  return c.json({
    ok: true,
    chapterId,
    packVersion: nextVersion,
    r2Key,
    checksumSha256,
    telegramArchived: archiveRes.archived,
  });
});
