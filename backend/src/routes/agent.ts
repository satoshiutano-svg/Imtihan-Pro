import { Hono } from 'hono';
import type { Env } from '../types';
import {
  AgentClaimTaskSchema,
  AgentRegistrationSchema,
  SyncChapterPackSchema,
} from '../validators/content_schema';

export const agentRoutes = new Hono<{ Bindings: Env }>();

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

agentRoutes.use('*', async (c, next) => {
  const agentToken = c.env.AGENT_API_TOKEN;
  const verifierToken = c.env.VERIFIER_API_TOKEN;
  const adminToken = c.env.ADMIN_API_TOKEN;

  if (!agentToken && !verifierToken && !adminToken) {
    return c.json({ error: 'External Agent API is disabled (no tokens configured).' }, 503);
  }

  const authHeader = c.req.header('Authorization') ?? '';
  const provided = authHeader.startsWith('Bearer ')
    ? authHeader.slice('Bearer '.length).trim()
    : '';

  if (!provided) {
    return c.json({ error: 'Bearer token required.' }, 401);
  }

  const valid =
    (agentToken && (await constantTimeEqual(provided, agentToken))) ||
    (verifierToken && (await constantTimeEqual(provided, verifierToken))) ||
    (adminToken && (await constantTimeEqual(provided, adminToken)));

  if (!valid) {
    return c.json({ error: 'Invalid Agent or Verifier token.' }, 401);
  }

  await next();
});

agentRoutes.post('/register', async (c) => {
  const body = await c.req.json().catch(() => null);
  const parsed = AgentRegistrationSchema.safeParse(body);
  if (!parsed.success) {
    return c.json({ error: 'Invalid agent registration payload', details: parsed.error.flatten() }, 400);
  }
  const now = new Date().toISOString();
  const d = parsed.data;
  await c.env.DB.prepare(`
    INSERT INTO registered_agents (
      worker_id, name, tool_kind, roles_json, capabilities_json, status,
      registered_at, last_heartbeat_at, quota_remaining_note
    ) VALUES (?, ?, ?, ?, ?, 'online', ?, ?, ?)
    ON CONFLICT(worker_id) DO UPDATE SET
      name = excluded.name,
      tool_kind = excluded.tool_kind,
      roles_json = excluded.roles_json,
      capabilities_json = excluded.capabilities_json,
      status = 'online',
      last_heartbeat_at = excluded.last_heartbeat_at,
      quota_remaining_note = COALESCE(excluded.quota_remaining_note, registered_agents.quota_remaining_note)
  `)
    .bind(
      d.workerId,
      d.name,
      d.toolKind,
      JSON.stringify(d.roles),
      JSON.stringify(d.capabilities),
      now,
      now,
      d.quotaRemainingNote ?? null,
    )
    .run();

  return c.json({ registered: true, workerId: d.workerId, registeredAt: now }, 201);
});

agentRoutes.get('/tasks', async (c) => {
  const role = c.req.query('role');
  const query = role
    ? `SELECT * FROM agent_tasks WHERE status = 'queued' AND role = ? ORDER BY phase ASC, created_at ASC LIMIT 40`
    : `SELECT * FROM agent_tasks WHERE status = 'queued' ORDER BY phase ASC, created_at ASC LIMIT 40`;
  const result = role
    ? await c.env.DB.prepare(query).bind(role).all()
    : await c.env.DB.prepare(query).all();
  return c.json({ tasks: result.results ?? [] });
});

agentRoutes.post('/tasks/claim-next', async (c) => {
  const body = await c.req.json().catch(() => null);
  const parsed = AgentClaimTaskSchema.safeParse(body);
  if (!parsed.success) {
    return c.json({ error: 'Invalid claim payload', details: parsed.error.flatten() }, 400);
  }
  const { workerId, leaseMinutes, role } = parsed.data;
  const now = new Date();
  const leaseIso = new Date(now.getTime() + leaseMinutes * 60 * 1000).toISOString();

  const candidate = role
    ? await c.env.DB.prepare(
        `SELECT * FROM agent_tasks WHERE status = 'queued' AND role = ? ORDER BY phase ASC, created_at ASC LIMIT 1`,
      )
        .bind(role)
        .first<{ id: string; job_id: string; chapter_id: string; phase: number; assigned_worker: string | null }>()
    : await c.env.DB.prepare(
        `SELECT * FROM agent_tasks WHERE status = 'queued' ORDER BY phase ASC, created_at ASC LIMIT 1`,
      ).first<{ id: string; job_id: string; chapter_id: string; phase: number; assigned_worker: string | null }>();

  if (!candidate) {
    return c.json({ claimed: false, task: null, message: 'No queued tasks.' });
  }

  // Enforce strict Author != Verifier separation
  if (candidate.phase === 6) {
    const priorAuthor = await c.env.DB.prepare(
      `SELECT assigned_worker FROM agent_tasks WHERE job_id = ? AND phase = 4 AND assigned_worker IS NOT NULL LIMIT 1`,
    )
      .bind(candidate.job_id)
      .first<{ assigned_worker: string }>();

    if (
      priorAuthor?.assigned_worker &&
      priorAuthor.assigned_worker.trim().toLowerCase() === workerId.trim().toLowerCase()
    ) {
      return c.json(
        {
          claimed: false,
          code: 'AUTHOR_VERIFIER_CONFLICT',
          message: `Worker "${workerId}" authored this chapter and cannot claim its verification task.`,
        },
        403,
      );
    }
  }

  await c.env.DB.prepare(
    `UPDATE agent_tasks SET status = 'claimed', assigned_worker = ?, lease_expires_at = ?, started_at = COALESCE(started_at, ?) WHERE id = ?`,
  )
    .bind(workerId, leaseIso, now.toISOString(), candidate.id)
    .run();

  return c.json({ claimed: true, taskId: candidate.id, leaseExpiresAt: leaseIso });
});

agentRoutes.get('/books/:bookId/source', async (c) => {
  const bookId = c.req.param('bookId');
  const book = await c.env.DB.prepare(`SELECT * FROM books WHERE id = ?`)
    .bind(bookId)
    .first<{
      id: string;
      title: string;
      grade: number;
      subject_name: string;
      r2_key: string;
      extracted_text: string;
      page_texts_json: string;
      metadata_json: string;
    }>();
  if (!book) {
    return c.json({ error: 'Book not found.' }, 404);
  }
  if (c.req.query('format') === 'pdf') {
    const obj = await c.env.CONTENT_BUCKET.get(book.r2_key);
    if (!obj) {
      return c.json({ error: 'Book PDF missing in R2.' }, 404);
    }
    return new Response(obj.body, {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `inline; filename="${book.id}.pdf"`,
      },
    });
  }
  return c.json({
    book: { id: book.id, title: book.title, grade: book.grade, subjectName: book.subject_name },
    extractedText: book.extracted_text,
    pageTexts: JSON.parse(book.page_texts_json || '[]'),
    metadata: JSON.parse(book.metadata_json || '{}'),
  });
});

agentRoutes.post('/chapters/draft', async (c) => {
  const body = await c.req.json().catch(() => null);
  const parsed = SyncChapterPackSchema.safeParse({
    reviewedBy: '',
    chapter: body?.chapter ?? body,
    exams: [],
  });
  if (!parsed.success) {
    return c.json({ error: 'Invalid chapter draft', details: parsed.error.flatten() }, 400);
  }
  return c.json({
    status: 'saved_to_draft_queue',
    chapterId: parsed.data.chapter.chapterId,
    publicationStatus: 'draft',
  }, 201);
});
