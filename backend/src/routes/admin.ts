import { Hono } from 'hono';
import type { Env } from '../types';
import { archiveJsonPackToTelegram } from '../services/telegram_archive';
import {
  ConceptPayloadSchema,
  QuestionInputSchema,
  SyncChapterPackSchema,
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

/**
 * Unified autonomous pack sync route invoked by Roshan Study Publishing Agent
 * when CLOUDFLARE_API_URL + CLOUDFLARE_ADMIN_TOKEN are configured.
 */
adminRoutes.post('/chapters/sync-pack', async (c) => {
  const body = await c.req.json().catch(() => null);
  const parsed = SyncChapterPackSchema.safeParse(body);
  if (!parsed.success) {
    return c.json({ error: 'Invalid sync-pack payload', details: parsed.error.flatten() }, 400);
  }

  const { chapter, reviewedBy, exams } = parsed.data;
  if (!chapter.permissionVerified) {
    return c.json({ error: 'Publisher permissionVerified must be true before syncing.' }, 400);
  }

  const now = new Date().toISOString();
  const nextVersion = Math.max(1, chapter.packVersion);

  const statements: D1PreparedStatement[] = [
    c.env.DB.prepare(`
      INSERT OR IGNORE INTO subjects (id, code, name, medium, text_direction)
      VALUES (?, ?, ?, 'en', 'ltr')
    `).bind(
      chapter.subjectId,
      chapter.subjectId.toUpperCase().slice(0, 12),
      chapter.subjectName,
    ),
    c.env.DB.prepare(`
      INSERT INTO chapters (
        id, subject_id, grade, programme_id, chapter_number, title,
        learning_outcomes_json, publication_status, current_pack_version, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, 'published', ?, ?)
      ON CONFLICT(id) DO UPDATE SET
        subject_id = excluded.subject_id,
        grade = excluded.grade,
        programme_id = excluded.programme_id,
        chapter_number = excluded.chapter_number,
        title = excluded.title,
        learning_outcomes_json = excluded.learning_outcomes_json,
        publication_status = 'published',
        current_pack_version = excluded.current_pack_version,
        updated_at = excluded.updated_at
    `).bind(
      chapter.chapterId,
      chapter.subjectId,
      chapter.grade,
      chapter.programmeId,
      chapter.chapterNumber,
      chapter.title,
      JSON.stringify(chapter.learningOutcomes),
      nextVersion,
      now,
    ),
  ];

  const seenTopics = new Set<string>();
  for (let i = 0; i < chapter.concepts.length; i++) {
    const rawConcept = chapter.concepts[i] as Record<string, unknown>;
    const conceptId = String(rawConcept.id ?? `${chapter.chapterId}_c${i + 1}`);
    const topicId = String(rawConcept.topicId ?? `${chapter.chapterId}_t1`);
    const title = String(rawConcept.title ?? `Concept ${i + 1}`);
    const sourceBook = String(rawConcept.sourceBook ?? `KPECTB ${chapter.subjectName}`);
    const sourcePage = String(rawConcept.sourcePage ?? `Ch. ${chapter.chapterNumber}`);
    const locale = rawConcept.locale === 'ur' ? 'ur' : 'en';
    const textDirection = rawConcept.textDirection === 'rtl' ? 'rtl' : 'ltr';

    if (!seenTopics.has(topicId)) {
      seenTopics.add(topicId);
      statements.push(
        c.env.DB.prepare(`
          INSERT OR IGNORE INTO topics (id, chapter_id, order_index, title)
          VALUES (?, ?, ?, ?)
        `).bind(topicId, chapter.chapterId, seenTopics.size, title),
      );
    }

    statements.push(
      c.env.DB.prepare(`
        INSERT INTO concepts (
          id, chapter_id, topic_id, order_index, title, locale, text_direction,
          payload_json, source_book, source_edition, source_page,
          review_status, reviewed_by, reviewed_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, '', ?, 'published', ?, ?, ?)
        ON CONFLICT(id) DO UPDATE SET
          title = excluded.title,
          payload_json = excluded.payload_json,
          review_status = 'published',
          reviewed_by = excluded.reviewed_by,
          reviewed_at = excluded.reviewed_at,
          updated_at = excluded.updated_at
      `).bind(
        conceptId,
        chapter.chapterId,
        topicId,
        Number(rawConcept.orderIndex ?? i + 1),
        title,
        locale,
        textDirection,
        JSON.stringify(rawConcept),
        sourceBook,
        sourcePage,
        reviewedBy,
        now,
        now,
      ),
    );
  }

  for (let i = 0; i < chapter.questions.length; i++) {
    const rawQ = chapter.questions[i] as Record<string, unknown>;
    const qId = String(rawQ.id ?? `${chapter.chapterId}_q${i + 1}`);
    const topicId = String(rawQ.topicId ?? `${chapter.chapterId}_t1`);
    if (!seenTopics.has(topicId)) {
      seenTopics.add(topicId);
      statements.push(
        c.env.DB.prepare(`
          INSERT OR IGNORE INTO topics (id, chapter_id, order_index, title)
          VALUES (?, ?, ?, ?)
        `).bind(topicId, chapter.chapterId, seenTopics.size, chapter.title),
      );
    }

    statements.push(
      c.env.DB.prepare(`
        INSERT INTO questions (
          id, programme_id, grade, group_id, subject_id, chapter_id, topic_id,
          concept_id, question_type, difficulty, statement, locale, text_direction,
          payload_json, answer_json, explanation, marks, source_type,
          source_board_id, source_year, source_paper_ref, source_page_ref,
          publication_status, reviewed_by, reviewed_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'en', 'ltr', ?, ?, ?, ?, ?, ?, ?, ?, ?, 'published', ?, ?, ?)
        ON CONFLICT(id) DO UPDATE SET
          statement = excluded.statement,
          payload_json = excluded.payload_json,
          answer_json = excluded.answer_json,
          explanation = excluded.explanation,
          publication_status = 'published',
          reviewed_by = excluded.reviewed_by,
          reviewed_at = excluded.reviewed_at,
          updated_at = excluded.updated_at
      `).bind(
        qId,
        chapter.programmeId,
        chapter.grade,
        chapter.groupId,
        chapter.subjectId,
        chapter.chapterId,
        topicId,
        rawQ.conceptId ? String(rawQ.conceptId) : null,
        String(rawQ.questionType ?? 'mcq'),
        Number(rawQ.difficulty ?? 2),
        String(rawQ.statement ?? ''),
        JSON.stringify({
          options: rawQ.options ?? [],
          optionMisconceptions: rawQ.optionMisconceptions ?? {},
          hints: rawQ.hints ?? [],
          numericalSteps: rawQ.numericalSteps ?? null,
          markingPoints: rawQ.markingPoints ?? [],
        }),
        JSON.stringify({ correctAnswer: rawQ.correctAnswer ?? '' }),
        String(rawQ.explanation ?? ''),
        Number(rawQ.marks ?? 1),
        String(rawQ.sourceType ?? 'practice_original'),
        rawQ.sourceBoardId ? String(rawQ.sourceBoardId) : null,
        rawQ.sourceYear ? Number(rawQ.sourceYear) : null,
        rawQ.sourcePaperRef ? String(rawQ.sourcePaperRef) : null,
        rawQ.sourcePageRef ? String(rawQ.sourcePageRef) : null,
        reviewedBy,
        now,
        now,
      ),
    );
  }

  for (const exam of exams) {
    statements.push(
      c.env.DB.prepare(`
        INSERT INTO exam_blueprints (
          id, programme_id, grade, group_id, subject_id, chapter_id, title,
          exam_kind, duration_minutes, total_marks, sections_json,
          publication_status, review_stage, pack_version, reviewed_by,
          created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'published', 'published', ?, ?, ?, ?)
        ON CONFLICT(id) DO UPDATE SET
          title = excluded.title,
          sections_json = excluded.sections_json,
          publication_status = 'published',
          review_stage = 'published',
          pack_version = excluded.pack_version,
          reviewed_by = excluded.reviewed_by,
          updated_at = excluded.updated_at
      `).bind(
        exam.id,
        exam.programmeId,
        exam.grade,
        exam.groupId,
        exam.subjectId,
        exam.chapterId ?? chapter.chapterId,
        exam.title,
        exam.examKind,
        exam.durationMinutes,
        exam.totalMarks,
        JSON.stringify(exam.sections),
        exam.packVersion,
        reviewedBy,
        now,
        now,
      ),
    );
  }

  const packObject = {
    schemaVersion: 1,
    chapterId: chapter.chapterId,
    packVersion: nextVersion,
    publishedAt: now,
    chapter,
    concepts: chapter.concepts,
    questions: chapter.questions,
    exams,
  };
  const jsonContent = JSON.stringify(packObject);
  const digestBuffer = await crypto.subtle.digest(
    'SHA-256',
    new TextEncoder().encode(jsonContent),
  );
  const checksumSha256 = Array.from(new Uint8Array(digestBuffer))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');

  const r2Key = `packs/${chapter.chapterId}/v${nextVersion}.json`;
  await c.env.CONTENT_BUCKET.put(r2Key, jsonContent, {
    httpMetadata: { contentType: 'application/json; charset=utf-8' },
  });

  statements.push(
    c.env.DB.prepare(`
      INSERT INTO chapter_packs (
        id, chapter_id, version, r2_key, checksum_sha256, size_bytes, telegram_message_id, published_at
      ) VALUES (?, ?, ?, ?, ?, ?, NULL, ?)
      ON CONFLICT(chapter_id, version) DO UPDATE SET
        r2_key = excluded.r2_key,
        checksum_sha256 = excluded.checksum_sha256,
        size_bytes = excluded.size_bytes,
        published_at = excluded.published_at
    `).bind(
      `${chapter.chapterId}_v${nextVersion}`,
      chapter.chapterId,
      nextVersion,
      r2Key,
      checksumSha256,
      jsonContent.length,
      now,
    ),
  );

  await c.env.DB.batch(statements);

  if (c.env.CATALOG_KV) {
    await Promise.all([
      c.env.CATALOG_KV.delete(`catalog:${chapter.programmeId}:all:all`),
      c.env.CATALOG_KV.delete(`catalog:${chapter.programmeId}:${chapter.grade}:all`),
      c.env.CATALOG_KV.delete(`catalog:${chapter.programmeId}:all:${chapter.subjectId}`),
      c.env.CATALOG_KV.delete(`catalog:${chapter.programmeId}:${chapter.grade}:${chapter.subjectId}`),
    ]);
  }

  return c.json({
    ok: true,
    chapterId: chapter.chapterId,
    packVersion: nextVersion,
    r2Key,
    checksumSha256,
    syncedAt: now,
  });
});

adminRoutes.post('/books/sync', async (c) => {
  const body = (await c.req.json().catch(() => null)) as {
    book?: Record<string, unknown>;
    pdfBase64?: string;
  } | null;
  if (!body?.book || !body.pdfBase64) {
    return c.json({ error: 'Provide book metadata and pdfBase64.' }, 400);
  }
  const book = body.book;
  const bookId = String(book.id ?? '').trim();
  const version = Math.max(1, Number(book.version ?? 1));
  if (!bookId) {
    return c.json({ error: 'Book id is required.' }, 400);
  }

  const binary = Uint8Array.from(atob(body.pdfBase64), (ch) => ch.charCodeAt(0));
  const r2Key = `books/${bookId}/v${version}.pdf`;
  await c.env.CONTENT_BUCKET.put(r2Key, binary, {
    httpMetadata: { contentType: 'application/pdf' },
  });

  const now = new Date().toISOString();
  await c.env.DB.prepare(`
    INSERT INTO books (
      id, title, programme_id, grade, group_id, subject_id, subject_name,
      curriculum, source_book, version, sha256, file_size_bytes, page_count,
      filename, r2_key, extracted_text, page_texts_json, metadata_json,
      publication_status, is_student_visible, permission_verified, uploaded_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(id) DO UPDATE SET
      version = excluded.version,
      sha256 = excluded.sha256,
      r2_key = excluded.r2_key,
      extracted_text = excluded.extracted_text,
      page_texts_json = excluded.page_texts_json,
      is_student_visible = excluded.is_student_visible,
      updated_at = excluded.updated_at
  `)
    .bind(
      bookId,
      String(book.title ?? 'Textbook PDF'),
      String(book.programmeId ?? 'ssc_hssc'),
      Number(book.grade ?? 9),
      String(book.groupId ?? 'ssc_science'),
      String(book.subjectId ?? 'subject_9'),
      String(book.subjectName ?? 'Science'),
      String(book.curriculum ?? 'KPK BISE'),
      String(book.sourceBook ?? 'KPECTB Textbook'),
      version,
      String(book.sha256 ?? ''),
      Number(book.fileSizeBytes ?? binary.byteLength),
      Number(book.pageCount ?? 1),
      String(book.filename ?? `${bookId}.pdf`),
      r2Key,
      String(book.extractedText ?? ''),
      JSON.stringify(book.pageTexts ?? []),
      JSON.stringify(book.metadata ?? {}),
      String(book.publicationStatus ?? 'published'),
      book.isStudentVisible === false ? 0 : 1,
      book.permissionVerified === false ? 0 : 1,
      String(book.uploadedAt ?? now),
      now,
    )
    .run();

  return c.json({ ok: true, r2Key, syncedAt: now });
});

adminRoutes.post('/chapters/:id/rollback', async (c) => {
  const chapterId = c.req.param('id');
  const body = (await c.req.json().catch(() => null)) as { targetVersion?: number } | null;
  const targetVersion = Number(body?.targetVersion);
  if (!Number.isFinite(targetVersion) || targetVersion < 1) {
    return c.json({ error: 'Provide valid targetVersion >= 1.' }, 400);
  }
  const targetPack = await c.env.DB.prepare(
    `SELECT * FROM chapter_packs WHERE chapter_id = ? AND version = ?`,
  )
    .bind(chapterId, targetVersion)
    .first<{ r2_key: string; checksum_sha256: string }>();

  if (!targetPack) {
    return c.json({ error: `Pack version ${targetVersion} not found.` }, 404);
  }
  const now = new Date().toISOString();
  await c.env.DB.prepare(
    `UPDATE chapters SET current_pack_version = ?, publication_status = 'published', updated_at = ? WHERE id = ?`,
  )
    .bind(targetVersion, now, chapterId)
    .run();

  return c.json({ ok: true, chapterId, restoredVersion: targetVersion, r2Key: targetPack.r2_key });
});

