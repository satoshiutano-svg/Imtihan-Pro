import { Hono } from 'hono';
import type { Env } from '../types';
import { ProgrammeIdSchema, SyncAttemptBatchSchema } from '../validators/content_schema';

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
