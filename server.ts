import 'dotenv/config';
import express from 'express';
import type { NextFunction, Request, Response } from 'express';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { GoogleGenAI, Type } from '@google/genai';
import type {
  AcademicGroupId,
  AgentRoleId,
  CmsChapter,
  CmsConcept,
  CmsQuestion,
  ExamBlueprint,
  GraphSpec,
  MonitoringIssueReport,
  MotionGraphicSpec,
  VisualColorToken,
} from './src/types/cms.ts';
import {
  approveAndPublishExam,
  approveChapterComponent,
  buildAgentRulesMarkdown,
  checkIdempotencyKey,
  claimNextExternalTaskDetailed,
  computeAdminOverviewMetrics,
  deleteBook,
  deleteCmsChapter,
  findBookBySha256,
  getAgentAccessToken,
  getAuditLog,
  getBookById,
  getChapterById,
  getProductionJob,
  getPublishedPack,
  getSecuritySettings,
  getVerificationReportForChapter,
  getVerifierAccessToken,
  heartbeatAgent,
  listAllChapters,
  listBooks,
  listCatalog,
  listExamBlueprints,
  listIssueReports,
  listPendingExternalTasks,
  listProductionJobs,
  listPublishedBooks,
  listPublishedExams,
  listPublishHistory,
  listQuarantinedSubmissions,
  listRegisteredAgents,
  listVerificationReports,
  recordQuarantinedSubmission,
  registerOrUpdateAgent,
  rejectOrRequestRevision,
  renewTaskLease,
  resolveQuarantinedSubmission,
  revokeScopedToken,
  rollbackChapterVersion,
  rotateAgentToken,
  rotateVerifierToken,
  saveCmsChapter,
  saveIdempotencyResult,
  saveProductionJob,
  scorePublishedExam,
  setAgentStatus,
  setPaidAiAuthorized,
  updateBookFlags,
  upsertBook,
  upsertDraftChapter,
  upsertExamBlueprint,
  upsertIssueReport,
  validateChapterForCloud,
  verifyAgentBearerToken,
} from './server/cloudStore.ts';
import {
  getCloudflareSyncConfig,
  syncBookToCloudflareIfConfigured,
} from './server/cloudflareSync.ts';
import {
  batchApproveVerifiedChapters,
  createAndScheduleProductionJob,
  createJobFromBook,
  createMonitoringFixDraftFromIssue,
  executeGeminiAutonomousJob,
  proposeJobStructure,
  publishApprovedChapterWithTarget,
  reportTaskErrorOrRetry,
  reviewJobStructure,
  runVerificationPipelineForChapter,
  submitExternalTaskResult,
} from './server/orchestrator.ts';
import {
  deleteStoredBookPdf,
  parsePdfBuffer,
  readStoredBookBuffer,
  saveBookPdfToVault,
} from './server/pdfVault.ts';
import { AGENT_SKILLS_CATALOG, SPECIALIST_ROLES_30 } from './server/skillsCatalog.ts';
import { createRateLimiter, securityHeadersMiddleware } from './server/security.ts';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = Number(process.env.PORT || 3000);
const MODEL_NAME = 'gemini-4-hydrogen';

const ai = process.env.GEMINI_API_KEY
  ? new GoogleGenAI({
      apiKey: process.env.GEMINI_API_KEY,
      httpOptions: {
        headers: {
          'User-Agent': 'aistudio-build',
        },
      },
    })
  : null;

interface GenerateQuestionsBody {
  grade?: number;
  subjectName?: string;
  chapterTitle?: string;
  extractText?: string;
  mcqCount?: number;
  numericalCount?: number;
  writtenCount?: number;
  difficultyMin?: number;
  difficultyMax?: number;
}

interface GenerateChapterFromSourceBody {
  grade?: number;
  groupId?: AcademicGroupId;
  subjectId?: string;
  subjectName?: string;
  chapterNumber?: number;
  chapterTitle?: string;
  sourceBook?: string;
  sourcePage?: string;
  extractText?: string;
  pdfBase64?: string;
  pdfFilename?: string;
}

interface GeminiOptionMisconception {
  option?: string;
  reason?: string;
}

interface GeminiGeneratedQuestion {
  questionType?: string;
  difficulty?: number;
  statement?: string;
  options?: string[];
  optionMisconceptions?: GeminiOptionMisconception[];
  hints?: string[];
  numericalSteps?: {
    given?: string[];
    required?: string;
    formula?: string;
    substitution?: string;
    calculation?: string;
    answerWithUnit?: string;
  };
  markingPoints?: string[];
  correctAnswer?: string;
  explanation?: string;
  marks?: number;
  sourcePageRef?: string;
}

interface GeminiResponsePayload {
  summaryNote?: string;
  questions?: GeminiGeneratedQuestion[];
}

interface GeminiGeneratedChapterPayload {
  learningOutcomes?: string[];
  concept?: {
    title?: string;
    simpleExplanation?: string;
    definitions?: { term?: string; definition?: string }[];
    importantPoints?: string[];
    formulas?: { expression?: string; description?: string; unit?: string }[];
    workedExamplePrompt?: string;
    workedExampleSteps?: string[];
    workedExampleAnswer?: string;
    applications?: string[];
    commonMistake?: string;
    commonMistakeCorrection?: string;
    quickRevisionSummary?: string[];
    glossaryHints?: { term?: string; urduMeaning?: string; simpleHint?: string }[];
    microCards?: { stageTitle?: string; body?: string }[];
    motionGraphic?: MotionGraphicSpec;
    graph?: GraphSpec;
  };
  questions?: GeminiGeneratedQuestion[];
}

function clampInt(value: unknown, fallback: number, min: number, max: number): number {
  const num = Number(value);
  if (!Number.isFinite(num)) return fallback;
  return Math.max(min, Math.min(max, Math.round(num)));
}

function resolveRequestBaseUrl(req: Request): string {
  const forwardedProto = req.headers['x-forwarded-proto'];
  const proto =
    typeof forwardedProto === 'string' && forwardedProto.trim()
      ? forwardedProto.split(',')[0].trim()
      : req.protocol || 'http';
  const host = req.get('host') || `localhost:${PORT}`;
  return `${proto}://${host}`;
}

async function callGeminiWithRetry<T>(fn: () => Promise<T>, maxRetries = 2): Promise<T> {
  let lastError: unknown;
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (err: unknown) {
      lastError = err;
      const msg = err instanceof Error ? err.message : String(err);
      const isNonRetryable =
        msg.includes('400') ||
        msg.includes('401') ||
        msg.includes('403') ||
        msg.includes('404') ||
        msg.includes('API_KEY_INVALID') ||
        msg.includes('PERMISSION_DENIED');
      if (isNonRetryable || attempt === maxRetries) {
        throw err;
      }
      await new Promise((resolve) => setTimeout(resolve, 600 * (attempt + 1)));
    }
  }
  throw lastError;
}

function buildErrorResponse(err: unknown): { status: number; message: string; code: string } {
  const raw = err instanceof Error ? err.message : String(err);
  if (raw.includes('PERMISSION_DENIED') || raw.includes('403') || raw.includes('API_KEY_INVALID')) {
    return {
      status: 403,
      code: 'GEMINI_AUTH_ERROR',
      message:
        'Gemini API access was denied or the configured key is invalid. Please check your API key in Settings > Secrets.',
    };
  }
  if (raw.includes('RESOURCE_EXHAUSTED') || raw.includes('429')) {
    return {
      status: 429,
      code: 'GEMINI_QUOTA_EXCEEDED',
      message:
        'Gemini API rate limit reached. Please wait a moment and try again, or verify your API tier in Settings > Secrets.',
    };
  }
  if (raw.includes('NOT_FOUND') || raw.includes('404')) {
    return {
      status: 502,
      code: 'GEMINI_MODEL_UNAVAILABLE',
      message: 'Configured Gemini model was unavailable. Please retry shortly.',
    };
  }
  return {
    status: 500,
    code: 'GEMINI_GENERATION_FAILED',
    message: 'Could not generate questions from this source. Please check your PDF or text extract and try again.',
  };
}

function sanitizeQuestions(
  rawQuestions: GeminiGeneratedQuestion[],
  defaults: {
    grade: 9 | 10 | 11 | 12;
    groupId: AcademicGroupId;
    subjectId: string;
    chapterId: string;
    topicId: string;
    conceptId: string;
    chapterTitle: string;
    difficultyMin: number;
  },
): CmsQuestion[] {
  const allowedTypes = new Set(['mcq', 'numerical', 'short_answer', 'long_answer']);
  return rawQuestions
    .map((q, idx): CmsQuestion => {
      const qType = allowedTypes.has(String(q.questionType))
        ? (q.questionType as 'mcq' | 'numerical' | 'short_answer' | 'long_answer')
        : q.options && q.options.length >= 2
          ? 'mcq'
          : 'short_answer';

      const options =
        qType === 'mcq'
          ? (q.options ?? [])
              .map((o) => String(o).trim())
              .filter(Boolean)
              .slice(0, 4)
          : [];
      let correctAnswer = String(q.correctAnswer ?? '').trim();
      if (qType === 'mcq' && options.length > 0) {
        const matchedCorrect = options.find((o) => o.toLowerCase() === correctAnswer.toLowerCase());
        correctAnswer = matchedCorrect ?? options[0];
      }

      const optionLookup = new Map(options.map((o) => [o.toLowerCase(), o]));
      const misconceptions: Record<string, string> = {};
      for (const item of q.optionMisconceptions ?? []) {
        const rawOpt = String(item?.option ?? '').trim();
        const rawReason = String(item?.reason ?? '').trim();
        if (!rawOpt || !rawReason) continue;
        const canonicalOpt = optionLookup.get(rawOpt.toLowerCase()) ?? rawOpt;
        if (canonicalOpt.toLowerCase() !== correctAnswer.toLowerCase()) {
          misconceptions[canonicalOpt] = rawReason;
        }
      }

      const steps = q.numericalSteps;
      const hasValidNumerical =
        qType === 'numerical' &&
        steps &&
        Array.isArray(steps.given) &&
        steps.given.length > 0 &&
        String(steps.formula ?? '').trim().length > 0 &&
        String(steps.answerWithUnit ?? '').trim().length > 0;

      const numericalSteps =
        qType === 'numerical'
          ? {
              given: hasValidNumerical
                ? steps!.given!.map((g) => String(g).trim()).filter(Boolean)
                : ['Verify values from problem statement'],
              required: String(steps?.required ?? 'Required physical/mathematical quantity').trim(),
              formula: String(steps?.formula ?? 'Formula from chapter').trim(),
              substitution: String(steps?.substitution ?? 'Substitute given values').trim(),
              calculation: String(steps?.calculation ?? 'Simplify step by step').trim(),
              answerWithUnit: String(steps?.answerWithUnit ?? correctAnswer).trim() || correctAnswer,
            }
          : undefined;

      if (qType === 'numerical' && numericalSteps?.answerWithUnit) {
        correctAnswer = numericalSteps.answerWithUnit;
      }

      const markingPoints =
        qType === 'short_answer' || qType === 'long_answer'
          ? (q.markingPoints ?? []).map((m) => String(m).trim()).filter(Boolean)
          : [];

      return {
        id: `q_${defaults.chapterId}_ai_${Date.now()}_${idx}`,
        programmeId: 'ssc_hssc',
        grade: defaults.grade,
        groupId: defaults.groupId,
        subjectId: defaults.subjectId,
        chapterId: defaults.chapterId,
        topicId: defaults.topicId,
        conceptId: defaults.conceptId,
        questionType: qType,
        difficulty: clampInt(q.difficulty, defaults.difficultyMin, 1, 7) as 1 | 2 | 3 | 4 | 5 | 6 | 7,
        statement: String(q.statement ?? '').trim(),
        options,
        optionMisconceptions: misconceptions,
        hints: (q.hints ?? []).map((h) => String(h).trim()).filter(Boolean),
        numericalSteps,
        markingPoints,
        correctAnswer: correctAnswer || 'Verify answer against textbook',
        explanation: String(q.explanation ?? '').trim() || 'Review textbook explanation and verify units.',
        marks: clampInt(
          q.marks,
          qType === 'mcq' ? 1 : qType === 'numerical' ? 4 : qType === 'long_answer' ? 7 : 3,
          1,
          15,
        ),
        sourceType: 'practice_original',
        sourcePageRef: String(q.sourcePageRef ?? defaults.chapterTitle).trim(),
        origin: 'ai_generated_draft',
        publicationStatus: 'draft',
        reviewedBy: '',
      };
    })
    .filter((q) => q.statement.length >= 8 && (q.questionType !== 'mcq' || q.options.length >= 2));
}

function sanitizeVisualColor(token: unknown): VisualColorToken {
  if (token === 'secondary' || token === 'warning' || token === 'danger') return token;
  return 'primary';
}

function sanitizeMotionGraphic(raw: unknown, idPrefix: string): MotionGraphicSpec[] {
  if (!raw || typeof raw !== 'object') return [];
  const mg = raw as Partial<MotionGraphicSpec>;
  const title = String(mg.title ?? '').trim();
  if (!title || !Array.isArray(mg.actors) || mg.actors.length === 0 || !Array.isArray(mg.stages) || mg.stages.length === 0) {
    return [];
  }
  const allowedScenes = new Set([
    'kinematics_track',
    'vector_motion',
    'reaction_flow',
    'wave_oscillation',
    'orbit_cycle',
  ]);
  const allowedShapes = new Set(['circle', 'box', 'arrow', 'molecule', 'wave']);
  const clampCoord = (n: unknown, fb: number) => {
    const v = Number(n);
    return Number.isFinite(v) ? Math.max(4, Math.min(96, v)) : fb;
  };
  return [
    {
      id: `${idPrefix}_mg`,
      title,
      caption: String(mg.caption ?? title).trim(),
      durationSec: Math.max(2, Math.min(20, Number(mg.durationSec) || 5)),
      sceneType: allowedScenes.has(String(mg.sceneType))
        ? (mg.sceneType as MotionGraphicSpec['sceneType'])
        : 'kinematics_track',
      actors: mg.actors.slice(0, 5).map((a, idx) => ({
        id: String(a.id || `actor_${idx}`),
        label: String(a.label || `Object ${idx + 1}`).trim(),
        shape: allowedShapes.has(String(a.shape)) ? (a.shape as MotionGraphicSpec['actors'][0]['shape']) : 'box',
        colorToken: sanitizeVisualColor(a.colorToken),
        startX: clampCoord(a.startX, 15),
        startY: clampCoord(a.startY, 50),
        endX: clampCoord(a.endX, 85),
        endY: clampCoord(a.endY, 50),
        size: Math.max(8, Math.min(24, Number(a.size) || 14)),
      })),
      stages: mg.stages.slice(0, 5).map((s, idx) => ({
        atPercent: Math.max(0, Math.min(100, Number(s.atPercent) || idx * 50)),
        label: String(s.label || `Stage ${idx + 1}`).trim(),
        formulaLatex: s.formulaLatex ? String(s.formulaLatex).trim() : undefined,
        callout: String(s.callout || 'Observe step progression carefully.').trim(),
      })),
    },
  ];
}

function sanitizeGraph(raw: unknown, idPrefix: string): GraphSpec[] {
  if (!raw || typeof raw !== 'object') return [];
  const g = raw as Partial<GraphSpec>;
  const title = String(g.title ?? '').trim();
  if (!title || !Array.isArray(g.series) || g.series.length === 0) return [];

  const validSeries = g.series
    .map((s, idx) => {
      const pts = (Array.isArray(s.points) ? s.points : [])
        .filter((p) => Number.isFinite(Number(p.x)) && Number.isFinite(Number(p.y)))
        .map((p) => ({ x: Number(p.x), y: Number(p.y) }));
      return {
        name: String(s.name || `Series ${idx + 1}`).trim(),
        colorToken: sanitizeVisualColor(s.colorToken),
        showArea: Boolean(s.showArea),
        points: pts,
      };
    })
    .filter((s) => s.points.length >= 2);

  if (validSeries.length === 0) return [];
  const allX = validSeries.flatMap((s) => s.points.map((p) => p.x));
  const allY = validSeries.flatMap((s) => s.points.map((p) => p.y));
  const minX = Math.min(...allX);
  const maxX = Math.max(...allX);
  const minY = Math.min(...allY);
  const maxY = Math.max(...allY);

  const xMin = Number.isFinite(Number(g.xMin)) ? Number(g.xMin) : minX;
  const xMax = Number.isFinite(Number(g.xMax)) && Number(g.xMax) > xMin ? Number(g.xMax) : Math.max(xMin + 1, maxX);
  const yMin = Number.isFinite(Number(g.yMin)) ? Number(g.yMin) : minY;
  const yMax = Number.isFinite(Number(g.yMax)) && Number(g.yMax) > yMin ? Number(g.yMax) : Math.max(yMin + 1, maxY);

  return [
    {
      id: `${idPrefix}_graph`,
      title,
      caption: String(g.caption ?? title).trim(),
      xLabel: String(g.xLabel || 'x').trim(),
      yLabel: String(g.yLabel || 'y').trim(),
      xMin,
      xMax,
      yMin,
      yMax,
      series: validSeries,
      highlights: (Array.isArray(g.highlights) ? g.highlights : [])
        .filter((h) => Number.isFinite(Number(h.x)) && Number.isFinite(Number(h.y)) && String(h.label ?? '').trim())
        .map((h) => ({ x: Number(h.x), y: Number(h.y), label: String(h.label).trim() })),
    },
  ];
}

function requireAgentAuth(req: Request, res: Response, next: NextFunction): void {
  if (!verifyAgentBearerToken(req.headers.authorization)) {
    res.status(401).json({
      code: 'AGENT_UNAUTHORIZED',
      message: 'Valid Bearer Agent Token required. Copy your Agent Token from Studio -> AI Agent & MCP Bridge.',
    });
    return;
  }
  next();
}

async function createServer() {
  const app = express();
  app.use(securityHeadersMiddleware);
  app.use(express.json({ limit: '45mb' }));
  app.use((err: unknown, _req: Request, res: Response, next: NextFunction) => {
    if (err instanceof SyntaxError && 'body' in err) {
      res.status(400).json({
        code: 'INVALID_JSON',
        message: 'Invalid JSON request body.',
      });
      return;
    }
    next(err);
  });

  const agentRateLimiter = createRateLimiter({ maxRequests: 180, windowMs: 60_000, keyPrefix: 'agent' });
  const uploadRateLimiter = createRateLimiter({ maxRequests: 30, windowMs: 60_000, keyPrefix: 'upload' });
  app.use('/api/agent', agentRateLimiter);
  app.use('/api/verifier', agentRateLimiter);
  app.use('/api/mcp', agentRateLimiter);

  app.get('/api/health', (_req: Request, res: Response) => {
    const security = getSecuritySettings();
    res.json({
      ok: true,
      model: MODEL_NAME,
      zeroCostDefault: !security.allowOptionalPaidServerAi,
      aiReady: Boolean(ai) && security.allowOptionalPaidServerAi,
      mcpReady: true,
    });
  });

  // ---------------------------------------------------------------------------
  // Public Cloud Catalog & Versioned Chapter Packs (Web Student Preview + Flutter)
  // ---------------------------------------------------------------------------
  app.get('/api/v1/catalog', (req: Request, res: Response) => {
    const gradeNum = req.query.grade ? Number(req.query.grade) : undefined;
    const catalog = listCatalog({
      programme: typeof req.query.programme === 'string' ? req.query.programme : 'ssc_hssc',
      grade: gradeNum && Number.isFinite(gradeNum) ? gradeNum : undefined,
      groupId: typeof req.query.groupId === 'string' ? req.query.groupId : undefined,
      subjectId: typeof req.query.subjectId === 'string' ? req.query.subjectId : undefined,
      q: typeof req.query.q === 'string' ? req.query.q : undefined,
      page: req.query.page ? Number(req.query.page) : 1,
      limit: req.query.limit ? Number(req.query.limit) : 12,
    });
    res.json({
      schemaVersion: '1.1',
      generatedAt: new Date().toISOString(),
      ...catalog,
    });
  });

  app.get('/api/v1/packs/:chapterId/:version', (req: Request, res: Response) => {
    const chapterId = String(req.params.chapterId || '');
    const versionNum = Number(req.params.version);
    const found = getPublishedPack(chapterId, Number.isFinite(versionNum) ? versionNum : undefined);
    if (!found) {
      res.status(404).json({
        code: 'PACK_NOT_FOUND',
        message: 'Published chapter pack version was not found.',
      });
      return;
    }
    res.json({
      schemaVersion: '1.1',
      checksumSha256: found.checksumSha256,
      pack: found.chapter,
    });
  });

  app.get('/api/v1/exams', (req: Request, res: Response) => {
    const programme = typeof req.query.programme === 'string' ? req.query.programme : 'ssc_hssc';
    const grade = req.query.grade ? Number(req.query.grade) : undefined;
    res.json({
      schemaVersion: '1.1',
      generatedAt: new Date().toISOString(),
      exams: listPublishedExams(programme, grade && Number.isFinite(grade) ? grade : undefined),
    });
  });

  app.post('/api/v1/exams/:examId/score', (req: Request, res: Response) => {
    const body = req.body ?? {};
    const answers = Array.isArray(body.answers) ? body.answers : [];
    const outcome = scorePublishedExam(String(req.params.examId || ''), {
      submissionUuid: String(body.submissionUuid ?? ''),
      deviceUuid: typeof body.deviceUuid === 'string' ? body.deviceUuid : undefined,
      timeSpentSec: Math.max(0, Number(body.timeSpentSec) || 0),
      answers,
    });
    if (!outcome.ok) {
      res.status(outcome.status).json({ code: 'EXAM_SCORING_FAILED', message: outcome.message });
      return;
    }
    res.json(outcome.result);
  });

  app.get('/api/v1/books', (req: Request, res: Response) => {
    const programme = typeof req.query.programme === 'string' ? req.query.programme : 'ssc_hssc';
    const grade = req.query.grade ? Number(req.query.grade) : undefined;
    const subjectId = typeof req.query.subjectId === 'string' ? req.query.subjectId : undefined;
    const q = typeof req.query.q === 'string' ? req.query.q : undefined;
    res.json({
      schemaVersion: '1.1',
      generatedAt: new Date().toISOString(),
      books: listPublishedBooks({
        programme,
        grade: grade && Number.isFinite(grade) ? grade : undefined,
        subjectId,
        q,
      }),
    });
  });

  app.get('/api/v1/books/:bookId/pdf', (req: Request, res: Response) => {
    const book = getBookById(String(req.params.bookId || ''));
    if (!book || !book.isStudentVisible || book.publicationStatus === 'archived') {
      res.status(404).json({ code: 'BOOK_NOT_FOUND', message: 'Book PDF is not published for student viewing.' });
      return;
    }
    const buf = readStoredBookBuffer(book.id, book.version);
    if (!buf) {
      res.status(404).json({ code: 'BOOK_BINARY_MISSING', message: 'Stored PDF binary was not found.' });
      return;
    }
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `inline; filename="${book.filename.replace(/"/g, '')}"`);
    res.setHeader('Cache-Control', 'public, max-age=300');
    res.send(buf);
  });

  // ---------------------------------------------------------------------------
  // CMS Cloud Workspace & Draft Approval Queue
  // ---------------------------------------------------------------------------
  app.get('/api/cms/chapters', (_req: Request, res: Response) => {
    res.json({
      chapters: listAllChapters(),
      auditLog: getAuditLog(),
    });
  });

  app.post('/api/cms/chapters/import', (req: Request, res: Response) => {
    const rawList = Array.isArray(req.body?.chapters)
      ? req.body.chapters
      : req.body?.chapter
        ? [req.body.chapter]
        : [];
    if (rawList.length === 0) {
      res.status(400).json({ code: 'EMPTY_IMPORT', message: 'Provide chapter or chapters array.' });
      return;
    }
    const imported: CmsChapter[] = [];
    const failed: { index: number; chapterId?: string; errors: string[] }[] = [];

    rawList.forEach((raw: CmsChapter, index: number) => {
      const origin = raw.origin ?? 'human_authored';
      const result = upsertDraftChapter(raw, origin, 'Book & Content Importer');
      if (result.ok) {
        imported.push(result.chapter);
      } else {
        failed.push({ index, chapterId: raw?.chapterId, errors: result.errors });
      }
    });

    res.status(imported.length > 0 ? 200 : 400).json({
      importedCount: imported.length,
      imported,
      failed,
    });
  });

  app.put('/api/cms/chapters/:chapterId', (req: Request, res: Response) => {
    const candidate = req.body as CmsChapter;
    if (!candidate || candidate.chapterId !== req.params.chapterId) {
      res.status(400).json({ code: 'CHAPTER_ID_MISMATCH', message: 'Body chapterId must match URL parameter.' });
      return;
    }
    const saved = saveCmsChapter(candidate);
    if (!saved.ok) {
      res.status(400).json({ code: 'VALIDATION_FAILED', message: saved.errors.join(' '), errors: saved.errors });
      return;
    }
    res.json({ chapter: saved.chapter });
  });

  app.post('/api/cms/chapters/:chapterId/approve-publish', async (req: Request, res: Response) => {
    const reviewedBy = String(req.body?.reviewedBy ?? '');
    const verifyPermission = req.body?.verifyPermission !== false;
    const result = await publishApprovedChapterWithTarget(
      String(req.params.chapterId),
      reviewedBy,
      verifyPermission,
    );
    if (!result.ok) {
      res.status(result.status).json({
        code: 'PUBLISH_GATE_BLOCKED',
        message: result.errors.join(' '),
        errors: result.errors,
      });
      return;
    }
    res.json({ chapter: result.chapter, syncTarget: result.syncTarget });
  });

  app.post('/api/cms/chapters/batch-approve', async (req: Request, res: Response) => {
    const chapterIds = Array.isArray(req.body?.chapterIds)
      ? req.body.chapterIds.map((id: unknown) => String(id))
      : [];
    const reviewedBy = String(req.body?.reviewedBy ?? '').trim();
    if (!reviewedBy || chapterIds.length === 0) {
      res.status(400).json({
        code: 'INVALID_BATCH_APPROVAL',
        message: 'Provide reviewedBy and at least 1 verified chapterId.',
      });
      return;
    }
    const outcome = await batchApproveVerifiedChapters(chapterIds, reviewedBy);
    res.json(outcome);
  });

  app.post('/api/cms/chapters/:chapterId/verify', async (req: Request, res: Response) => {
    const chapterId = String(req.params.chapterId);
    const report = await runVerificationPipelineForChapter(chapterId);
    if (!report) {
      res.status(404).json({ code: 'NOT_FOUND', message: 'Chapter not found.' });
      return;
    }
    res.json({ report, chapters: listAllChapters() });
  });

  app.get('/api/cms/overview', (_req: Request, res: Response) => {
    res.json({
      metrics: computeAdminOverviewMetrics(),
      securitySettings: getSecuritySettings(),
      registeredAgents: listRegisteredAgents(),
      books: listBooks(),
      publishHistory: listPublishHistory(),
      cloudflare: getCloudflareSyncConfig(),
    });
  });

  app.get('/api/cms/ops-overview', (_req: Request, res: Response) => {
    const securitySettings = getSecuritySettings();
    res.json({
      metrics: computeAdminOverviewMetrics(),
      jobs: listProductionJobs(),
      verificationReports: listVerificationReports(),
      exams: listExamBlueprints(),
      issues: listIssueReports(),
      pendingExternalTasks: listPendingExternalTasks(),
      quarantinedSubmissions: listQuarantinedSubmissions(),
      books: listBooks(),
      registeredAgents: listRegisteredAgents(),
      publishHistory: listPublishHistory(),
      securitySettings,
      cloudflare: getCloudflareSyncConfig(),
      auditLog: getAuditLog(),
      aiReady: Boolean(ai) && securitySettings.allowOptionalPaidServerAi,
    });
  });

  app.get('/api/cms/quarantine', (_req: Request, res: Response) => {
    res.json({ quarantinedSubmissions: listQuarantinedSubmissions() });
  });

  app.post('/api/cms/quarantine/:quarantineId/resolve', (req: Request, res: Response) => {
    const ok = resolveQuarantinedSubmission(String(req.params.quarantineId || ''));
    if (!ok) {
      res.status(404).json({ code: 'NOT_FOUND', message: 'Quarantine entry not found.' });
      return;
    }
    res.json({ resolved: true, quarantinedSubmissions: listQuarantinedSubmissions() });
  });

  app.get('/api/cms/audit', (req: Request, res: Response) => {
    const action = typeof req.query.action === 'string' ? req.query.action.trim() : '';
    const q = typeof req.query.q === 'string' ? req.query.q.trim().toLowerCase() : '';
    const rows = getAuditLog().filter((entry) => {
      if (action && entry.action !== action) return false;
      if (q) {
        const hay = `${entry.actor} ${entry.summary} ${entry.chapterId ?? ''} ${entry.action}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
    res.json({ auditLog: rows });
  });

  app.post('/api/cms/chapters/:chapterId/components/:componentId/approve', (req: Request, res: Response) => {
    const componentType = req.body?.componentType === 'concept' ? 'concept' : 'question';
    const reviewedBy = String(req.body?.reviewedBy ?? 'Owner Reviewer').trim();
    const outcome = approveChapterComponent(
      String(req.params.chapterId || ''),
      componentType,
      String(req.params.componentId || ''),
      reviewedBy,
    );
    if (!outcome.ok) {
      res.status(outcome.status).json({ code: 'COMPONENT_APPROVAL_FAILED', message: outcome.message });
      return;
    }
    res.json({ chapter: outcome.chapter });
  });

  // Persistent Book Upload, Metadata Extraction, Deduplication & Auto-Queue
  app.get('/api/cms/books', (_req: Request, res: Response) => {
    res.json({ books: listBooks() });
  });

  app.post('/api/cms/books/upload', uploadRateLimiter, async (req: Request, res: Response) => {
    const body = req.body ?? {};
    const title = String(body.title ?? '').trim();
    const subjectName = String(body.subjectName ?? '').trim();
    const grade = clampInt(body.grade, 9, 9, 12) as 9 | 10 | 11 | 12;
    const groupId = (body.groupId ?? (grade <= 10 ? 'ssc_science' : 'hssc_pre_engineering')) as AcademicGroupId;
    const programmeId = body.programmeId === 'mdcat' || body.programmeId === 'etea_eng' || body.programmeId === 'uni_entrance' ? body.programmeId : 'ssc_hssc';
    const rawBase64 = String(body.pdfBase64 ?? '').trim();

    if (!title || !subjectName || !rawBase64) {
      res.status(400).json({
        code: 'INVALID_BOOK_UPLOAD',
        message: 'Title, subjectName, and pdfBase64 are required.',
      });
      return;
    }

    const cleanedB64 = rawBase64.replace(/^data:application\/pdf;base64,/, '');
    const buffer = Buffer.from(cleanedB64, 'base64');
    const parsed = parsePdfBuffer(buffer);
    if (!parsed.valid) {
      res.status(400).json({
        code: 'INVALID_PDF_FILE',
        message: parsed.error || 'Uploaded file failed PDF header validation.',
      });
      return;
    }

    const existingDuplicate = findBookBySha256(parsed.sha256);
    if (existingDuplicate && !body.reprocess && !body.createNewVersion) {
      res.status(200).json({
        duplicateDetected: true,
        message: `Exact PDF SHA-256 already exists ("${existingDuplicate.title}" v${existingDuplicate.version}). Reusing cached extraction at $0 cost.`,
        book: existingDuplicate,
        queuedJob: null,
      });
      return;
    }

    const cleanSlug = (str: string) =>
      str
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '_')
        .replace(/^_+|_+$/g, '')
        .slice(0, 18);

    const subjectId = String(body.subjectId ?? '').trim() || `${cleanSlug(subjectName)}_${grade}`;
    const bookId = existingDuplicate
      ? existingDuplicate.id
      : `book_${subjectId}_${Date.now().toString(36).slice(-6)}`;
    const nextVersion = existingDuplicate ? existingDuplicate.version + 1 : 1;
    const filename =
      String(body.filename ?? '').trim().replace(/[^a-zA-Z0-9._-]/g, '_') || `${bookId}.pdf`;
    const now = new Date().toISOString();

    saveBookPdfToVault(bookId, nextVersion, buffer);

    const manualSupplement = String(body.supplementText ?? '').trim();
    const finalExtractedText = manualSupplement
      ? `${parsed.extractedText}\n\n[Owner Notes]\n${manualSupplement}`.trim()
      : parsed.extractedText;

    let bookRecord = upsertBook({
      id: bookId,
      title,
      programmeId,
      grade,
      groupId,
      subjectId,
      subjectName,
      curriculum: String(body.curriculum ?? 'KPK BISE (KPECTB English Medium)').trim(),
      sourceBook: String(body.sourceBook ?? '').trim() || `KPECTB ${subjectName} Grade ${grade} (English Medium)`,
      version: nextVersion,
      sha256: parsed.sha256,
      fileSizeBytes: parsed.fileSizeBytes,
      pageCount: parsed.pageCount,
      filename,
      storageTarget: 'disk_vault',
      extractedText: finalExtractedText,
      pageTexts: parsed.pageTexts,
      metadata: {
        pdfTitle: parsed.pdfTitle || title,
        author: parsed.author,
        extractedAt: now,
        extractionQuality: finalExtractedText.length >= 24 ? 'text_extracted' : parsed.extractionQuality,
      },
      publicationStatus: body.isStudentVisible === false ? 'draft' : 'published',
      isStudentVisible: body.isStudentVisible !== false,
      permissionVerified: body.permissionVerified !== false,
      trustedAutoApproveStructure: Boolean(body.trustedAutoApproveStructure),
      uploadedAt: existingDuplicate?.uploadedAt ?? now,
      updatedAt: now,
      productionJobIds: existingDuplicate?.productionJobIds ?? [],
    });

    const cfBookSync = await syncBookToCloudflareIfConfigured(bookRecord, buffer);
    if (cfBookSync.target === 'cloudflare_d1_r2' && cfBookSync.synced) {
      bookRecord = upsertBook({
        ...bookRecord,
        storageTarget: 'cloudflare_r2',
        r2Key: cfBookSync.r2Key,
      });
    }

    let queuedJob = null;
    if (body.autoQueueJob !== false) {
      queuedJob = createJobFromBook(bookRecord, {
        chapterNumber: clampInt(body.chapterNumber, 1, 1, 30),
        chapterTitle: String(body.chapterTitle ?? '').trim() || `${title} — Chapter ${clampInt(body.chapterNumber, 1, 1, 30)}`,
        scope: body.scope ?? 'full_chapter_pack',
        trustedAutoApproveStructure: Boolean(body.trustedAutoApproveStructure),
      });
      bookRecord = getBookById(bookRecord.id) ?? bookRecord;
    }

    res.status(201).json({
      duplicateDetected: false,
      book: bookRecord,
      queuedJob,
      cloudflareSync: cfBookSync,
    });
  });

  app.post('/api/cms/books/:bookId/reprocess', (req: Request, res: Response) => {
    const book = getBookById(String(req.params.bookId));
    if (!book) {
      res.status(404).json({ code: 'NOT_FOUND', message: 'Book not found.' });
      return;
    }
    const buf = readStoredBookBuffer(book.id, book.version);
    if (!buf) {
      res.status(404).json({ code: 'BINARY_MISSING', message: 'Stored PDF file not found on disk vault.' });
      return;
    }
    const parsed = parsePdfBuffer(buf);
    const updated = upsertBook({
      ...book,
      pageCount: parsed.pageCount,
      extractedText: parsed.extractedText || book.extractedText,
      pageTexts: parsed.pageTexts.length > 0 ? parsed.pageTexts : book.pageTexts,
      metadata: {
        ...book.metadata,
        extractedAt: new Date().toISOString(),
        extractionQuality: parsed.extractionQuality,
      },
    });
    const queuedJob =
      req.body?.queueJob === true
        ? createJobFromBook(updated, {
            chapterNumber: clampInt(req.body?.chapterNumber, 1, 1, 30),
            chapterTitle: String(req.body?.chapterTitle ?? '').trim() || undefined,
          })
        : null;
    res.json({ book: updated, queuedJob });
  });

  app.patch('/api/cms/books/:bookId', (req: Request, res: Response) => {
    const body = req.body ?? {};
    const updated = updateBookFlags(String(req.params.bookId), {
      title: typeof body.title === 'string' ? body.title.trim() : undefined,
      isStudentVisible: typeof body.isStudentVisible === 'boolean' ? body.isStudentVisible : undefined,
      permissionVerified: typeof body.permissionVerified === 'boolean' ? body.permissionVerified : undefined,
      publicationStatus:
        body.publicationStatus === 'draft' ||
        body.publicationStatus === 'published' ||
        body.publicationStatus === 'archived'
          ? body.publicationStatus
          : undefined,
    });
    if (!updated) {
      res.status(404).json({ code: 'NOT_FOUND', message: 'Book not found.' });
      return;
    }
    res.json({ book: updated });
  });

  app.delete('/api/cms/books/:bookId', (req: Request, res: Response) => {
    const bookId = String(req.params.bookId);
    const removed = deleteBook(bookId);
    if (!removed) {
      res.status(404).json({ code: 'NOT_FOUND', message: 'Book not found.' });
      return;
    }
    deleteStoredBookPdf(bookId);
    res.json({ deleted: true });
  });

  // Approval Inbox Reject / Request Revision + Version History Rollback
  app.post('/api/cms/chapters/:chapterId/reject', (req: Request, res: Response) => {
    const action = req.body?.action === 'reject' ? 'reject' : 'request_revision';
    const reason = String(req.body?.reason ?? '');
    const actor = String(req.body?.actor ?? 'Owner Reviewer').trim() || 'Owner Reviewer';
    const outcome = rejectOrRequestRevision(String(req.params.chapterId), action, reason, actor);
    if (!outcome.ok) {
      res.status(outcome.status).json({ code: 'REVIEW_ACTION_FAILED', message: outcome.message });
      return;
    }
    res.json({ chapter: outcome.chapter });
  });

  app.get('/api/cms/chapters/:chapterId/history', (req: Request, res: Response) => {
    res.json({ history: listPublishHistory(String(req.params.chapterId)) });
  });

  app.post('/api/cms/chapters/:chapterId/rollback', (req: Request, res: Response) => {
    const targetVersion = Number(req.body?.targetVersion);
    const actor = String(req.body?.actor ?? 'Owner').trim() || 'Owner';
    if (!Number.isFinite(targetVersion) || targetVersion < 1) {
      res.status(400).json({ code: 'INVALID_VERSION', message: 'Provide valid targetVersion >= 1.' });
      return;
    }
    const outcome = rollbackChapterVersion(String(req.params.chapterId), targetVersion, actor);
    if (!outcome.ok) {
      res.status(outcome.status).json({ code: 'ROLLBACK_FAILED', message: outcome.message });
      return;
    }
    res.json({ chapter: outcome.chapter });
  });

  app.post('/api/cms/security/paid-ai', (req: Request, res: Response) => {
    const enabled = Boolean(req.body?.enabled);
    const actor = String(req.body?.actor ?? 'Owner').trim() || 'Owner';
    const securitySettings = setPaidAiAuthorized(enabled, actor);
    res.json({ securitySettings, aiReady: Boolean(ai) && securitySettings.allowOptionalPaidServerAi });
  });

  app.patch('/api/cms/agents/:workerId/status', (req: Request, res: Response) => {
    const status = req.body?.status;
    if (status !== 'online' && status !== 'paused' && status !== 'offline') {
      res.status(400).json({ code: 'INVALID_STATUS', message: 'Status must be online, paused, or offline.' });
      return;
    }
    const updated = setAgentStatus(String(req.params.workerId), status);
    if (!updated) {
      res.status(404).json({ code: 'AGENT_NOT_FOUND', message: 'Agent worker not registered.' });
      return;
    }
    res.json({ agent: updated });
  });

  app.post('/api/cms/jobs', (req: Request, res: Response) => {
    const body = req.body ?? {};
    const grade = clampInt(body.grade, 9, 9, 12) as 9 | 10 | 11 | 12;
    const subjectName = String(body.subjectName ?? '').trim();
    const chapterTitle = String(body.chapterTitle ?? '').trim();
    if (!subjectName || !chapterTitle) {
      res.status(400).json({
        code: 'INVALID_JOB_INPUT',
        message: 'Subject name and chapter title are required.',
      });
      return;
    }
    const job = createAndScheduleProductionJob({
      programmeId: body.programmeId,
      grade,
      groupId: body.groupId ?? (grade <= 10 ? 'ssc_science' : 'hssc_pre_engineering'),
      subjectName,
      chapterNumber: clampInt(body.chapterNumber, 1, 1, 30),
      chapterTitle,
      sourceBook: String(body.sourceBook ?? '').trim(),
      extractText: String(body.extractText ?? ''),
      pdfBase64: typeof body.pdfBase64 === 'string' ? body.pdfBase64 : undefined,
      pdfFilename: typeof body.pdfFilename === 'string' ? body.pdfFilename : undefined,
      permissionVerified: body.permissionVerified !== false,
      trustedAutoApproveStructure: Boolean(body.trustedAutoApproveStructure),
      scope: body.scope ?? 'full_chapter_pack',
      executionMode: body.executionMode === 'external_agent_queue' ? 'external_agent_queue' : 'gemini_cached',
      maxBudgetCalls: body.maxBudgetCalls ? clampInt(body.maxBudgetCalls, 10, 2, 20) : undefined,
    });
    res.status(201).json({ job });
  });

  app.post('/api/cms/jobs/:jobId/approve-structure', (req: Request, res: Response) => {
    const reviewedBy = String(req.body?.reviewedBy ?? 'Owner Reviewer').trim();
    const notes = typeof req.body?.notes === 'string' ? req.body.notes : undefined;
    const outcome = reviewJobStructure(String(req.params.jobId || ''), true, reviewedBy, notes);
    if (!outcome.ok) {
      res.status(outcome.status).json({ code: 'STRUCTURE_APPROVAL_FAILED', message: outcome.message });
      return;
    }
    res.json({ job: outcome.job });
  });

  app.post('/api/cms/jobs/:jobId/reject-structure', (req: Request, res: Response) => {
    const reviewedBy = String(req.body?.reviewedBy ?? 'Owner Reviewer').trim();
    const notes = String(req.body?.notes ?? 'Please refine chapter topics and objectives.').trim();
    const outcome = reviewJobStructure(String(req.params.jobId || ''), false, reviewedBy, notes);
    if (!outcome.ok) {
      res.status(outcome.status).json({ code: 'STRUCTURE_REJECTION_FAILED', message: outcome.message });
      return;
    }
    res.json({ job: outcome.job });
  });

  app.post('/api/cms/jobs/:jobId/pause', (req: Request, res: Response) => {
    const job = getProductionJob(String(req.params.jobId));
    if (!job) {
      res.status(404).json({ code: 'NOT_FOUND', message: 'Job not found.' });
      return;
    }
    job.status = 'paused';
    saveProductionJob(job);
    res.json({ job });
  });

  app.post('/api/cms/jobs/:jobId/resume', (req: Request, res: Response) => {
    const job = getProductionJob(String(req.params.jobId));
    if (!job) {
      res.status(404).json({ code: 'NOT_FOUND', message: 'Job not found.' });
      return;
    }
    job.status = job.executionMode === 'external_agent_queue' ? 'waiting_external' : 'queued';
    saveProductionJob(job);
    if (job.executionMode === 'gemini_cached') {
      void executeGeminiAutonomousJob(job.id);
    }
    res.json({ job });
  });

  app.post('/api/cms/jobs/:jobId/cancel', (req: Request, res: Response) => {
    const job = getProductionJob(String(req.params.jobId));
    if (!job) {
      res.status(404).json({ code: 'NOT_FOUND', message: 'Job not found.' });
      return;
    }
    job.status = 'cancelled';
    saveProductionJob(job);
    res.json({ job });
  });

  app.post('/api/cms/exams/:examId/approve-publish', (req: Request, res: Response) => {
    const reviewedBy = String(req.body?.reviewedBy ?? '');
    const outcome = approveAndPublishExam(String(req.params.examId), reviewedBy);
    if (!outcome.ok) {
      res.status(outcome.status).json({ code: 'EXAM_PUBLISH_FAILED', message: outcome.error });
      return;
    }
    res.json({ exam: outcome.exam });
  });

  app.post('/api/cms/issues', (req: Request, res: Response) => {
    const body = req.body ?? {};
    const chapterId = String(body.chapterId ?? '').trim();
    const description = String(body.description ?? '').trim();
    if (!chapterId || description.length < 5) {
      res.status(400).json({
        code: 'INVALID_ISSUE',
        message: 'Select a chapter and provide at least 5 characters describing the issue.',
      });
      return;
    }
    const now = new Date().toISOString();
    const issue: MonitoringIssueReport = {
      id: `iss_${Date.now().toString(36)}`,
      chapterId,
      questionId: body.questionId ? String(body.questionId) : undefined,
      conceptId: body.conceptId ? String(body.conceptId) : undefined,
      category: body.category ?? 'answer_error',
      description,
      reportedBy: String(body.reportedBy ?? 'Owner Monitor').trim() || 'Owner Monitor',
      status: 'open',
      createdAt: now,
      updatedAt: now,
    };
    res.status(201).json({ issue: upsertIssueReport(issue) });
  });

  app.post('/api/cms/issues/:issueId/create-fix-draft', (req: Request, res: Response) => {
    const result = createMonitoringFixDraftFromIssue(String(req.params.issueId));
    if (!result.ok) {
      res.status(400).json({ code: 'FIX_DRAFT_FAILED', message: result.message });
      return;
    }
    res.status(201).json(result);
  });

  app.delete('/api/cms/chapters/:chapterId', (req: Request, res: Response) => {
    const deleted = deleteCmsChapter(String(req.params.chapterId));
    if (!deleted) {
      res.status(404).json({ code: 'NOT_FOUND', message: 'Chapter not found.' });
      return;
    }
    res.json({ deleted: true });
  });

  app.get('/api/cms/agent-bridge', (req: Request, res: Response) => {
    const baseUrl = resolveRequestBaseUrl(req);
    res.json({
      baseUrl,
      mcpEndpoint: `${baseUrl}/api/mcp`,
      restDraftEndpoint: `${baseUrl}/api/agent/chapters/draft`,
      agentAccessToken: getAgentAccessToken(),
      verifierAccessToken: getVerifierAccessToken(),
      rolesCount: SPECIALIST_ROLES_30.length,
      skillsCount: AGENT_SKILLS_CATALOG.length,
      registeredAgents: listRegisteredAgents(),
      rulesMarkdown: buildAgentRulesMarkdown(baseUrl),
      auditLog: getAuditLog(),
    });
  });

  app.post('/api/cms/agent-token/rotate', (_req: Request, res: Response) => {
    const { token } = rotateAgentToken('Admin Studio');
    res.json({ agentAccessToken: token });
  });

  app.post('/api/cms/verifier-token/rotate', (_req: Request, res: Response) => {
    const { token } = rotateVerifierToken('Admin Studio');
    res.json({ verifierAccessToken: token });
  });

  app.post('/api/cms/tokens/revoke', (req: Request, res: Response) => {
    const scope = req.body?.scope === 'verifier' ? 'verifier' : 'agent';
    revokeScopedToken(scope, 'Admin Studio');
    res.json({ revoked: scope });
  });

  // ---------------------------------------------------------------------------
  // External AI Agent Gateway REST API (Cursor / Claude Code / OpenCode / Codex)
  // ---------------------------------------------------------------------------
  app.get('/api/agent/rules', requireAgentAuth, (req: Request, res: Response) => {
    const baseUrl = resolveRequestBaseUrl(req);
    res.json({
      platform: 'Roshan Study KPK BISE Grades 9-12',
      mcpEndpoint: `${baseUrl}/api/mcp`,
      rulesMarkdown: buildAgentRulesMarkdown(baseUrl),
    });
  });

  app.post('/api/agent/validate', requireAgentAuth, (req: Request, res: Response) => {
    const candidate = req.body?.chapter ?? req.body;
    const result = validateChapterForCloud(candidate, 'draft');
    res.status(result.valid ? 200 : 400).json(result);
  });

  app.post('/api/agent/chapters/draft', requireAgentAuth, (req: Request, res: Response) => {
    const idemKey =
      (typeof req.headers['idempotency-key'] === 'string' ? req.headers['idempotency-key'] : undefined) ??
      (typeof req.body?.idempotencyKey === 'string' ? req.body.idempotencyKey : undefined);
    const replay = checkIdempotencyKey(idemKey, '/api/agent/chapters/draft');
    if (replay) {
      res.status(replay.status).json({ ...replay.body, idempotentReplay: true });
      return;
    }

    const candidate = (req.body?.chapter ?? req.body) as CmsChapter;
    const actor = String(req.body?.agentName ?? 'External AI Agent').trim() || 'External AI Agent';
    const result = upsertDraftChapter(candidate, 'agent_uploaded_draft', actor);
    if (!result.ok) {
      recordQuarantinedSubmission({
        sourceEndpoint: '/api/agent/chapters/draft',
        workerId: actor,
        chapterId: candidate?.chapterId,
        reason: 'Draft upload failed strict KPK schema validation.',
        validationErrors: result.errors,
        rawPayload: candidate,
      });
      const errBody = {
        code: 'AGENT_DRAFT_INVALID',
        message: 'Chapter draft failed strict KPK board / math / visual validation and was quarantined.',
        errors: result.errors,
        warnings: result.warnings,
      };
      saveIdempotencyResult(idemKey, '/api/agent/chapters/draft', 400, errBody);
      res.status(400).json(errBody);
      return;
    }
    const okBody = {
      status: 'saved_to_draft_queue',
      message: 'Draft saved! Open Roshan Study Studio -> Agent & MCP Bridge to review and Approve & Publish.',
      chapter: result.chapter,
      warnings: result.warnings,
    };
    saveIdempotencyResult(idemKey, '/api/agent/chapters/draft', 201, okBody);
    res.status(201).json(okBody);
  });

  app.post('/api/agent/books/batch', requireAgentAuth, (req: Request, res: Response) => {
    const chapters = Array.isArray(req.body?.chapters) ? (req.body.chapters as CmsChapter[]) : [];
    const actor = String(req.body?.agentName ?? 'External AI Agent Batch').trim();
    if (chapters.length === 0 || chapters.length > 25) {
      res.status(400).json({
        code: 'INVALID_BATCH',
        message: 'Provide between 1 and 25 chapters in chapters array.',
      });
      return;
    }
    const saved: { chapterId: string; title: string; warnings: string[] }[] = [];
    const errors: { index: number; chapterId?: string; errors: string[] }[] = [];
    chapters.forEach((ch, index) => {
      const result = upsertDraftChapter(ch, 'agent_uploaded_draft', actor);
      if (result.ok) {
        saved.push({
          chapterId: result.chapter.chapterId,
          title: result.chapter.title,
          warnings: result.warnings,
        });
      } else {
        errors.push({ index, chapterId: ch?.chapterId, errors: result.errors });
      }
    });
    res.status(saved.length > 0 ? 201 : 400).json({
      savedCount: saved.length,
      failedCount: errors.length,
      saved,
      errors,
    });
  });

  app.post('/api/agent/register', requireAgentAuth, (req: Request, res: Response) => {
    const body = req.body ?? {};
    const workerId = String(body.workerId ?? body.name ?? '').trim();
    const name = String(body.name ?? workerId).trim();
    if (!workerId || !name) {
      res.status(400).json({ code: 'INVALID_AGENT', message: 'workerId and name are required.' });
      return;
    }
    const allowedKinds = new Set(['freebuff', 'opencode', 'cursor', 'claude_code', 'codex', 'verifier', 'other']);
    const toolKind = allowedKinds.has(String(body.toolKind)) ? body.toolKind : 'other';
    const roles = Array.isArray(body.roles) ? body.roles.map((r: unknown) => String(r) as AgentRoleId) : ['concept_writer' as AgentRoleId];
    const capabilities = Array.isArray(body.capabilities) ? body.capabilities.map((c: unknown) => String(c)) : ['kpk_bise_authoring'];
    const agent = registerOrUpdateAgent({
      workerId,
      name,
      toolKind,
      roles,
      capabilities,
      quotaRemainingNote: typeof body.quotaRemainingNote === 'string' ? body.quotaRemainingNote : undefined,
    });
    res.status(201).json({ registered: true, agent });
  });

  app.get('/api/agent/capabilities', requireAgentAuth, (_req: Request, res: Response) => {
    res.json({
      zeroCostDefault: true,
      rolesCount: SPECIALIST_ROLES_30.length,
      skillsCount: AGENT_SKILLS_CATALOG.length,
      roles: SPECIALIST_ROLES_30,
      registeredAgents: listRegisteredAgents(),
      authorVerifierSeparationEnforced: true,
    });
  });

  app.get('/api/agent/skills', requireAgentAuth, (_req: Request, res: Response) => {
    res.json({
      skillsCount: AGENT_SKILLS_CATALOG.length,
      skills: AGENT_SKILLS_CATALOG,
    });
  });

  app.get('/api/agent/instructions', requireAgentAuth, (req: Request, res: Response) => {
    const baseUrl = resolveRequestBaseUrl(req);
    res.json({
      platform: 'Roshan Study KPK BISE Grades 9-12',
      mcpEndpoint: `${baseUrl}/api/mcp`,
      rulesMarkdown: buildAgentRulesMarkdown(baseUrl),
      skillsCount: AGENT_SKILLS_CATALOG.length,
      rolesCount: SPECIALIST_ROLES_30.length,
    });
  });

  app.get('/api/agent/books/:bookId/source', requireAgentAuth, (req: Request, res: Response) => {
    const book = getBookById(String(req.params.bookId || ''));
    if (!book) {
      res.status(404).json({ code: 'BOOK_NOT_FOUND', message: 'Book not found.' });
      return;
    }
    if (req.query.format === 'pdf') {
      const buf = readStoredBookBuffer(book.id, book.version);
      if (!buf) {
        res.status(404).json({ code: 'BOOK_BINARY_MISSING', message: 'PDF binary missing.' });
        return;
      }
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `inline; filename="${book.filename.replace(/"/g, '')}"`);
      res.send(buf);
      return;
    }
    res.json({
      book: {
        id: book.id,
        title: book.title,
        grade: book.grade,
        groupId: book.groupId,
        subjectId: book.subjectId,
        subjectName: book.subjectName,
        sourceBook: book.sourceBook,
        version: book.version,
        sha256: book.sha256,
        pageCount: book.pageCount,
        metadata: book.metadata,
      },
      extractedText: book.extractedText,
      pageTexts: book.pageTexts,
      pdfDownloadUrl: `/api/agent/books/${encodeURIComponent(book.id)}/source?format=pdf`,
    });
  });

  app.get('/api/agent/tasks', requireAgentAuth, (req: Request, res: Response) => {
    const role = typeof req.query.role === 'string' ? (req.query.role as AgentRoleId) : undefined;
    res.json({ tasks: listPendingExternalTasks(role) });
  });

  app.post('/api/agent/tasks/claim-next', requireAgentAuth, (req: Request, res: Response) => {
    const workerName = String(req.body?.workerName ?? req.body?.workerId ?? 'external-agent').trim() || 'external-agent';
    const role = typeof req.query.role === 'string' ? (req.query.role as AgentRoleId) : typeof req.body?.role === 'string' ? (req.body.role as AgentRoleId) : undefined;
    heartbeatAgent(workerName);
    const { claimed, skippedAuthorSeparationCount } = claimNextExternalTaskDetailed(workerName, role);
    if (!claimed) {
      res.json({
        claimed: false,
        task: null,
        authorSeparationSkipped: skippedAuthorSeparationCount,
        message:
          skippedAuthorSeparationCount > 0
            ? `No eligible tasks: ${skippedAuthorSeparationCount} verification task(s) skipped because worker "${workerName}" authored those drafts.`
            : 'No dependency-ready tasks queued right now.',
      });
      return;
    }
    res.json({
      claimed: true,
      task: claimed.task,
      job: {
        id: claimed.job.id,
        grade: claimed.job.grade,
        groupId: claimed.job.groupId,
        subjectId: claimed.job.subjectId,
        subjectName: claimed.job.subjectName,
        chapterNumber: claimed.job.chapterNumber,
        chapterTitle: claimed.job.chapterTitle,
        chapterId: claimed.job.chapterId,
        scope: claimed.job.scope,
      },
    });
  });

  app.post('/api/agent/tasks/:taskId/heartbeat', requireAgentAuth, (req: Request, res: Response) => {
    const workerName = String(req.body?.workerName ?? req.body?.workerId ?? 'external-agent').trim() || 'external-agent';
    const note = typeof req.body?.progressNote === 'string' ? req.body.progressNote : undefined;
    const renewed = renewTaskLease(String(req.params.taskId), workerName, note);
    if (!renewed.ok) {
      res.status(renewed.status).json({ code: 'LEASE_RENEW_FAILED', message: renewed.message });
      return;
    }
    res.json({ ok: true, task: renewed.task });
  });

  app.post('/api/agent/tasks/:taskId/error', requireAgentAuth, async (req: Request, res: Response) => {
    const workerName = String(req.body?.workerName ?? req.body?.workerId ?? 'external-agent').trim() || 'external-agent';
    const errorMessage = String(req.body?.errorMessage ?? 'Worker execution error').trim();
    const outcome = await reportTaskErrorOrRetry(String(req.params.taskId), workerName, errorMessage);
    res.status(outcome.status).json(outcome);
  });

  app.post('/api/agent/tasks/:taskId/retry', requireAgentAuth, async (req: Request, res: Response) => {
    const workerName = String(req.body?.workerName ?? req.body?.workerId ?? 'external-agent').trim() || 'external-agent';
    const reason = String(req.body?.reason ?? 'Retry requested by agent worker').trim();
    const outcome = await reportTaskErrorOrRetry(String(req.params.taskId), workerName, reason);
    res.status(outcome.status).json(outcome);
  });

  app.post('/api/agent/jobs/:jobId/propose-structure', requireAgentAuth, (req: Request, res: Response) => {
    const workerName =
      String(req.body?.workerName ?? req.body?.workerId ?? 'external-architect').trim() || 'external-architect';
    const outcome = proposeJobStructure(String(req.params.jobId || ''), workerName, {
      summary: typeof req.body?.summary === 'string' ? req.body.summary : undefined,
      bookId: typeof req.body?.bookId === 'string' ? req.body.bookId : undefined,
      chapters: Array.isArray(req.body?.chapters) ? req.body.chapters : [],
    });
    if (!outcome.ok) {
      res.status(outcome.status).json({ code: 'STRUCTURE_PROPOSAL_INVALID', message: outcome.message });
      return;
    }
    res.status(201).json({
      status: outcome.autoApproved ? 'structure_auto_approved' : 'structure_pending_owner_approval',
      job: outcome.job,
    });
  });

  app.post('/api/agent/tasks/:taskId/submit', requireAgentAuth, async (req: Request, res: Response) => {
    const taskId = String(req.params.taskId);
    const idemKey =
      (typeof req.headers['idempotency-key'] === 'string' ? req.headers['idempotency-key'] : undefined) ??
      (typeof req.body?.idempotencyKey === 'string' ? req.body.idempotencyKey : undefined);
    const replay = checkIdempotencyKey(idemKey, `/api/agent/tasks/${taskId}/submit`);
    if (replay) {
      res.status(replay.status).json({ ...replay.body, idempotentReplay: true });
      return;
    }

    const workerName = String(req.body?.workerName ?? req.body?.workerId ?? 'external-agent').trim() || 'external-agent';
    const outcome = await submitExternalTaskResult(taskId, {
      workerName,
      chapter: req.body?.chapter as CmsChapter | undefined,
      exam: req.body?.exam as ExamBlueprint | undefined,
      validatorResult: req.body?.validatorResult,
      summary: typeof req.body?.summary === 'string' ? req.body.summary : undefined,
      failed: Boolean(req.body?.failed),
      errorMessage: typeof req.body?.errorMessage === 'string' ? req.body.errorMessage : undefined,
    });
    saveIdempotencyResult(idemKey, `/api/agent/tasks/${taskId}/submit`, outcome.status, outcome as unknown as Record<string, unknown>);
    res.status(outcome.status).json(outcome);
  });

  app.get('/api/agent/chapters/:chapterId/feedback', requireAgentAuth, (req: Request, res: Response) => {
    const chapterId = String(req.params.chapterId || '');
    const chapter = getChapterById(chapterId);
    if (!chapter) {
      res.status(404).json({ code: 'NOT_FOUND', message: 'Chapter not found.' });
      return;
    }
    const report = getVerificationReportForChapter(chapterId);
    res.json({
      chapterId,
      reviewStage: chapter.reviewStage,
      revisionFeedback: chapter.revisionFeedback,
      rejectionReason: chapter.rejectionReason,
      verificationReport: report ?? null,
    });
  });

  app.post('/api/agent/files/upload', requireAgentAuth, (req: Request, res: Response) => {
    const idemKey =
      (typeof req.headers['idempotency-key'] === 'string' ? req.headers['idempotency-key'] : undefined) ??
      (typeof req.body?.idempotencyKey === 'string' ? req.body.idempotencyKey : undefined);
    const replay = checkIdempotencyKey(idemKey, '/api/agent/files/upload');
    if (replay) {
      res.status(replay.status).json({ ...replay.body, idempotentReplay: true });
      return;
    }

    const chapter = req.body?.chapter as CmsChapter | undefined;
    const workerName = String(req.body?.workerName ?? req.body?.workerId ?? 'External AI Agent').trim() || 'External AI Agent';
    if (!chapter) {
      res.status(400).json({ code: 'MISSING_PAYLOAD', message: 'Provide chapter draft JSON payload.' });
      return;
    }
    const result = upsertDraftChapter(
      { ...chapter, authorWorkerId: workerName },
      'agent_uploaded_draft',
      workerName,
      'ai_generated',
    );
    if (!result.ok) {
      recordQuarantinedSubmission({
        sourceEndpoint: '/api/agent/files/upload',
        workerId: workerName,
        chapterId: chapter?.chapterId,
        reason: 'File upload draft failed validation.',
        validationErrors: result.errors,
        rawPayload: chapter,
      });
      const errBody = { code: 'INVALID_DRAFT', errors: result.errors, warnings: result.warnings };
      saveIdempotencyResult(idemKey, '/api/agent/files/upload', 400, errBody);
      res.status(400).json(errBody);
      return;
    }
    const okBody = { status: 'saved_to_draft_queue', chapter: result.chapter };
    saveIdempotencyResult(idemKey, '/api/agent/files/upload', 201, okBody);
    res.status(201).json(okBody);
  });

  app.post('/api/agent/exams/draft', requireAgentAuth, (req: Request, res: Response) => {
    const raw = req.body?.exam ?? req.body;
    if (!raw || !raw.id || !raw.title) {
      res.status(400).json({ code: 'INVALID_EXAM', message: 'Exam blueprint id and title are required.' });
      return;
    }
    const saved = upsertExamBlueprint({
      ...raw,
      publicationStatus: 'draft',
      reviewStage: 'ai_generated',
      updatedAt: new Date().toISOString(),
    } as ExamBlueprint);
    res.status(201).json({ status: 'saved_to_exam_drafts', exam: saved });
  });

  app.get('/api/agent/jobs/:jobId', requireAgentAuth, (req: Request, res: Response) => {
    const job = getProductionJob(String(req.params.jobId));
    if (!job) {
      res.status(404).json({ code: 'NOT_FOUND', message: 'Job not found.' });
      return;
    }
    res.json({ job });
  });

  app.get('/api/agent/jobs/:jobId/report', requireAgentAuth, (req: Request, res: Response) => {
    const job = getProductionJob(String(req.params.jobId));
    if (!job) {
      res.status(404).json({ code: 'NOT_FOUND', message: 'Job not found.' });
      return;
    }
    res.json({
      jobId: job.id,
      status: job.status,
      currentPhase: job.currentPhase,
      tasks: job.tasks,
      alerts: job.alerts,
      productionReport: job.productionReport ?? null,
    });
  });

  // Independent Verifier Endpoints (Enforce Author !== Verifier)
  app.get('/api/verifier/queue', requireAgentAuth, (req: Request, res: Response) => {
    const verifierWorker =
      typeof req.query.workerName === 'string'
        ? req.query.workerName.trim().toLowerCase()
        : typeof req.query.workerId === 'string'
          ? req.query.workerId.trim().toLowerCase()
          : '';
    const tasks = listPendingExternalTasks().filter((t) => {
      if (t.phase !== 6) return false;
      if (!verifierWorker) return true;
      const ch = getChapterById(t.chapterId);
      return !ch?.authorWorkerId || ch.authorWorkerId.trim().toLowerCase() !== verifierWorker;
    });
    res.json({ pendingVerificationCount: tasks.length, tasks });
  });

  app.post('/api/verifier/submit', requireAgentAuth, async (req: Request, res: Response) => {
    const taskId = String(req.body?.taskId ?? '').trim();
    const workerName = String(req.body?.workerName ?? req.body?.workerId ?? '').trim();
    if (!taskId || !workerName) {
      res.status(400).json({ code: 'INVALID_VERIFICATION', message: 'taskId and independent workerName are required.' });
      return;
    }
    const outcome = await submitExternalTaskResult(taskId, {
      workerName,
      validatorResult: req.body?.validatorResult,
      summary: typeof req.body?.summary === 'string' ? req.body.summary : undefined,
      failed: Boolean(req.body?.failed),
      errorMessage: typeof req.body?.errorMessage === 'string' ? req.body.errorMessage : undefined,
    });
    res.status(outcome.status).json(outcome);
  });

  // ---------------------------------------------------------------------------
  // Streamable HTTP JSON-RPC 2.0 MCP Server (POST /api/mcp)
  // ---------------------------------------------------------------------------
  app.post('/api/mcp', requireAgentAuth, async (req: Request, res: Response) => {
    const rpc = req.body as {
      jsonrpc?: string;
      id?: string | number | null;
      method?: string;
      params?: Record<string, unknown>;
    };

    const id = rpc?.id ?? null;
    const method = String(rpc?.method ?? '');
    const params = rpc?.params ?? {};

    if (!method) {
      res.status(400).json({
        jsonrpc: '2.0',
        id,
        error: { code: -32600, message: 'Invalid JSON-RPC request: missing method.' },
      });
      return;
    }

    if (method === 'initialize') {
      res.json({
        jsonrpc: '2.0',
        id,
        result: {
          protocolVersion: '2024-11-05',
          capabilities: { tools: {} },
          serverInfo: {
            name: 'roshan-study-kpk-cms',
            version: '2.0.0',
          },
        },
      });
      return;
    }

    if (method === 'notifications/initialized') {
      res.status(204).end();
      return;
    }

    if (method === 'tools/list') {
      res.json({
        jsonrpc: '2.0',
        id,
        result: {
          tools: [
            {
              name: 'get_kpk_board_rules',
              description:
                'Fetch the complete KPK BISE Grades 9-12 syllabus rules, Freebuff/OpenCode workflow, Duolingo+Brilliant pedagogy rules, 6-step numerical contract, KaTeX math format, and canonical CmsChapter JSON skeleton.',
              inputSchema: { type: 'object', properties: {}, additionalProperties: false },
            },
            {
              name: 'list_cloud_chapters',
              description:
                'List existing published and draft chapters stored in Roshan Study Cloud so chapter IDs and subject groupings never collide.',
              inputSchema: {
                type: 'object',
                properties: {
                  grade: { type: 'number', description: 'Optional grade filter (9-12).' },
                },
              },
            },
            {
              name: 'list_pending_tasks',
              description:
                'List dependency-ready specialist tasks queued across Roshan Study production jobs (supports filtering by agent role).',
              inputSchema: {
                type: 'object',
                properties: {
                  role: { type: 'string', description: 'Optional agent role filter (e.g. concept_writer, numerical_specialist, independent_answer_validator).' },
                },
              },
            },
            {
              name: 'claim_next_task',
              description:
                'Atomically claim the next dependency-ready generation or independent validation task from the autonomous queue (returns task metadata, job context, and chapterId).',
              inputSchema: {
                type: 'object',
                properties: {
                  workerName: { type: 'string', description: 'Agent identifier (e.g. freebuff, opencode, cursor).' },
                  role: { type: 'string', description: 'Optional specific agent role to claim.' },
                },
              },
            },
            {
              name: 'submit_task_result',
              description:
                'Submit the finished artifact for a claimed task (chapter JSON, exam JSON, or independent validator report) or report failure for automatic retry.',
              inputSchema: {
                type: 'object',
                properties: {
                  taskId: { type: 'string' },
                  workerName: { type: 'string' },
                  chapter: { type: 'object' },
                  exam: { type: 'object' },
                  validatorResult: { type: 'object' },
                  summary: { type: 'string' },
                  failed: { type: 'boolean' },
                  errorMessage: { type: 'string' },
                },
                required: ['taskId'],
              },
            },
            {
              name: 'get_job_report',
              description: 'Inspect live task states, retries, alerts, and Production Report for a job.',
              inputSchema: {
                type: 'object',
                properties: {
                  jobId: { type: 'string' },
                },
                required: ['jobId'],
              },
            },
            {
              name: 'validate_chapter_pack',
              description:
                'Dry-run strict validation of a CmsChapter JSON object before uploading (checks KaTeX delimiters, 6-step numericals, MCQs, and visual coordinates).',
              inputSchema: {
                type: 'object',
                properties: {
                  chapter: { type: 'object', description: 'Complete CmsChapter JSON object.' },
                },
                required: ['chapter'],
              },
            },
            {
              name: 'upload_chapter_draft',
              description:
                'Validate and save a CmsChapter directly into the Roshan Study Admin Draft Queue and trigger automated schema + duplicate checks.',
              inputSchema: {
                type: 'object',
                properties: {
                  agentName: { type: 'string', description: 'Name of the AI agent uploading the draft.' },
                  chapter: { type: 'object', description: 'Complete CmsChapter JSON object.' },
                },
                required: ['chapter'],
              },
            },
            {
              name: 'register_agent',
              description: 'Register your Freebuff, OpenCode, Cursor, or independent verifier agent identity and capabilities.',
              inputSchema: {
                type: 'object',
                properties: {
                  workerId: { type: 'string' },
                  name: { type: 'string' },
                  toolKind: { type: 'string' },
                  roles: { type: 'array', items: { type: 'string' } },
                  capabilities: { type: 'array', items: { type: 'string' } },
                },
                required: ['workerId', 'name'],
              },
            },
            {
              name: 'get_agent_skills',
              description: 'Fetch all 18 structured Roshan Study specialist Skill Specs, input/output schemas, and KPK BISE rules.',
              inputSchema: { type: 'object', properties: {}, additionalProperties: false },
            },
            {
              name: 'list_books',
              description: 'List uploaded PDF textbooks in the vault so you can fetch their extracted pages via get_book_source.',
              inputSchema: { type: 'object', properties: {}, additionalProperties: false },
            },
            {
              name: 'get_book_source',
              description: 'Fetch extracted page texts and metadata for an uploaded bookId.',
              inputSchema: {
                type: 'object',
                properties: { bookId: { type: 'string' } },
                required: ['bookId'],
              },
            },
            {
              name: 'renew_task_lease',
              description: 'Send a heartbeat to extend the 15-minute lease on your claimed task.',
              inputSchema: {
                type: 'object',
                properties: {
                  taskId: { type: 'string' },
                  workerName: { type: 'string' },
                  progressNote: { type: 'string' },
                },
                required: ['taskId', 'workerName'],
              },
            },
            {
              name: 'get_chapter_feedback',
              description: 'Inspect owner revision feedback or verification findings for a chapterId.',
              inputSchema: {
                type: 'object',
                properties: { chapterId: { type: 'string' } },
                required: ['chapterId'],
              },
            },
            {
              name: 'upload_exam_draft',
              description:
                'Save an ExamBlueprint draft (Topic Quiz, Chapter Test, KPK Board Model Exam) awaiting human approval.',
              inputSchema: {
                type: 'object',
                properties: {
                  exam: { type: 'object' },
                },
                required: ['exam'],
              },
            },
            {
              name: 'propose_book_structure',
              description:
                'Submit a proposed textbook chapter/topic/learning-objective blueprint for a ProductionJob so the owner can approve structure before Phase 4 generation begins.',
              inputSchema: {
                type: 'object',
                properties: {
                  jobId: { type: 'string' },
                  workerName: { type: 'string' },
                  summary: { type: 'string' },
                  bookId: { type: 'string' },
                  chapters: { type: 'array', items: { type: 'object' } },
                },
                required: ['jobId', 'chapters'],
              },
            },
          ],
        },
      });
      return;
    }

    if (method === 'tools/call') {
      const toolName = String(params.name ?? '');
      const toolArgs = (params.arguments ?? {}) as Record<string, unknown>;
      const baseUrl = resolveRequestBaseUrl(req);

      if (toolName === 'get_kpk_board_rules') {
        res.json({
          jsonrpc: '2.0',
          id,
          result: {
            content: [{ type: 'text', text: buildAgentRulesMarkdown(baseUrl) }],
          },
        });
        return;
      }

      if (toolName === 'list_cloud_chapters') {
        const gradeFilter = typeof toolArgs.grade === 'number' ? toolArgs.grade : undefined;
        const rows = listAllChapters()
          .filter((c) => (!gradeFilter ? true : c.grade === gradeFilter))
          .map((c) => ({
            chapterId: c.chapterId,
            programmeId: c.programmeId,
            grade: c.grade,
            groupId: c.groupId,
            subjectId: c.subjectId,
            subjectName: c.subjectName,
            chapterNumber: c.chapterNumber,
            title: c.title,
            publicationStatus: c.publicationStatus,
            reviewStage: c.reviewStage ?? 'ai_generated',
            packVersion: c.packVersion,
            conceptCount: c.concepts.length,
            questionCount: c.questions.length,
          }));
        res.json({
          jsonrpc: '2.0',
          id,
          result: {
            content: [{ type: 'text', text: JSON.stringify({ chapters: rows }, null, 2) }],
          },
        });
        return;
      }

      if (toolName === 'list_pending_tasks') {
        const role = typeof toolArgs.role === 'string' ? (toolArgs.role as AgentRoleId) : undefined;
        const tasks = listPendingExternalTasks(role);
        res.json({
          jsonrpc: '2.0',
          id,
          result: {
            content: [{ type: 'text', text: JSON.stringify({ pendingCount: tasks.length, tasks }, null, 2) }],
          },
        });
        return;
      }

      if (toolName === 'claim_next_task') {
        const workerName = String(toolArgs.workerName ?? 'freebuff-mcp').trim() || 'freebuff-mcp';
        const role = typeof toolArgs.role === 'string' ? (toolArgs.role as AgentRoleId) : undefined;
        heartbeatAgent(workerName);
        const { claimed, skippedAuthorSeparationCount } = claimNextExternalTaskDetailed(workerName, role);
        res.json({
          jsonrpc: '2.0',
          id,
          result: {
            content: [
              {
                type: 'text',
                text: JSON.stringify(
                  claimed
                    ? {
                        claimed: true,
                        task: claimed.task,
                        jobContext: {
                          id: claimed.job.id,
                          grade: claimed.job.grade,
                          groupId: claimed.job.groupId,
                          subjectId: claimed.job.subjectId,
                          subjectName: claimed.job.subjectName,
                          chapterNumber: claimed.job.chapterNumber,
                          chapterTitle: claimed.job.chapterTitle,
                          chapterId: claimed.job.chapterId,
                          scope: claimed.job.scope,
                        },
                      }
                    : {
                        claimed: false,
                        authorSeparationSkipped: skippedAuthorSeparationCount,
                        message:
                          skippedAuthorSeparationCount > 0
                            ? 'Skipped verification task(s) because this worker authored the draft.'
                            : 'No queued dependency-ready tasks.',
                      },
                  null,
                  2,
                ),
              },
            ],
          },
        });
        return;
      }

      if (toolName === 'register_agent') {
        const agent = registerOrUpdateAgent({
          workerId: String(toolArgs.workerId ?? toolArgs.name ?? 'mcp-worker'),
          name: String(toolArgs.name ?? toolArgs.workerId ?? 'MCP Agent'),
          toolKind: (['freebuff', 'opencode', 'cursor', 'claude_code', 'codex', 'verifier'].includes(String(toolArgs.toolKind))
            ? toolArgs.toolKind
            : 'other') as 'freebuff' | 'opencode' | 'cursor' | 'claude_code' | 'codex' | 'verifier' | 'other',
          roles: Array.isArray(toolArgs.roles) ? (toolArgs.roles as AgentRoleId[]) : ['concept_writer'],
          capabilities: Array.isArray(toolArgs.capabilities) ? (toolArgs.capabilities as string[]) : ['kpk_authoring'],
        });
        res.json({ jsonrpc: '2.0', id, result: { content: [{ type: 'text', text: JSON.stringify(agent, null, 2) }] } });
        return;
      }

      if (toolName === 'get_agent_skills') {
        res.json({
          jsonrpc: '2.0',
          id,
          result: { content: [{ type: 'text', text: JSON.stringify({ skills: AGENT_SKILLS_CATALOG, roles: SPECIALIST_ROLES_30 }, null, 2) }] },
        });
        return;
      }

      if (toolName === 'list_books') {
        const books = listBooks().map((b) => ({
          id: b.id,
          title: b.title,
          grade: b.grade,
          subjectName: b.subjectName,
          pageCount: b.pageCount,
          version: b.version,
          sha256: b.sha256,
        }));
        res.json({ jsonrpc: '2.0', id, result: { content: [{ type: 'text', text: JSON.stringify({ books }, null, 2) }] } });
        return;
      }

      if (toolName === 'get_book_source') {
        const book = getBookById(String(toolArgs.bookId ?? ''));
        res.json({
          jsonrpc: '2.0',
          id,
          result: {
            isError: !book,
            content: [
              {
                type: 'text',
                text: JSON.stringify(
                  book
                    ? { id: book.id, title: book.title, pageCount: book.pageCount, pageTexts: book.pageTexts, extractedText: book.extractedText }
                    : { error: 'Book not found' },
                  null,
                  2,
                ),
              },
            ],
          },
        });
        return;
      }

      if (toolName === 'renew_task_lease') {
        const renewed = renewTaskLease(
          String(toolArgs.taskId ?? ''),
          String(toolArgs.workerName ?? 'mcp-worker'),
          typeof toolArgs.progressNote === 'string' ? toolArgs.progressNote : undefined,
        );
        res.json({
          jsonrpc: '2.0',
          id,
          result: { isError: !renewed.ok, content: [{ type: 'text', text: JSON.stringify(renewed, null, 2) }] },
        });
        return;
      }

      if (toolName === 'get_chapter_feedback') {
        const cid = String(toolArgs.chapterId ?? '');
        const ch = getChapterById(cid);
        const rep = getVerificationReportForChapter(cid);
        res.json({
          jsonrpc: '2.0',
          id,
          result: {
            isError: !ch,
            content: [
              {
                type: 'text',
                text: JSON.stringify(
                  ch
                    ? {
                        chapterId: cid,
                        reviewStage: ch.reviewStage,
                        revisionFeedback: ch.revisionFeedback,
                        rejectionReason: ch.rejectionReason,
                        verificationReport: rep ?? null,
                      }
                    : { error: 'Chapter not found' },
                  null,
                  2,
                ),
              },
            ],
          },
        });
        return;
      }

      if (toolName === 'submit_task_result') {
        const outcome = await submitExternalTaskResult(String(toolArgs.taskId ?? ''), {
          workerName: String(toolArgs.workerName ?? 'freebuff-mcp').trim() || 'freebuff-mcp',
          chapter: toolArgs.chapter as CmsChapter | undefined,
          exam: toolArgs.exam as ExamBlueprint | undefined,
          validatorResult: toolArgs.validatorResult as {
            passed: boolean;
            score?: number;
            findings?: string[];
            flaggedItemIds?: string[];
          } | undefined,
          summary: typeof toolArgs.summary === 'string' ? toolArgs.summary : undefined,
          failed: Boolean(toolArgs.failed),
          errorMessage: typeof toolArgs.errorMessage === 'string' ? toolArgs.errorMessage : undefined,
        });
        res.json({
          jsonrpc: '2.0',
          id,
          result: {
            isError: !outcome.ok,
            content: [{ type: 'text', text: JSON.stringify(outcome, null, 2) }],
          },
        });
        return;
      }

      if (toolName === 'get_job_report') {
        const job = getProductionJob(String(toolArgs.jobId ?? ''));
        res.json({
          jsonrpc: '2.0',
          id,
          result: {
            isError: !job,
            content: [{ type: 'text', text: JSON.stringify(job ?? { error: 'Job not found' }, null, 2) }],
          },
        });
        return;
      }

      if (toolName === 'validate_chapter_pack') {
        const validation = validateChapterForCloud(toolArgs.chapter, 'draft');
        res.json({
          jsonrpc: '2.0',
          id,
          result: {
            isError: !validation.valid,
            content: [{ type: 'text', text: JSON.stringify(validation, null, 2) }],
          },
        });
        return;
      }

      if (toolName === 'upload_chapter_draft') {
        const candidate = toolArgs.chapter as CmsChapter;
        const actor = String(toolArgs.agentName ?? 'MCP Agent').trim() || 'MCP Agent';
        const upload = upsertDraftChapter(candidate, 'agent_uploaded_draft', actor, 'ai_generated');
        if (upload.ok) {
          await runVerificationPipelineForChapter(upload.chapter.chapterId);
        }
        res.json({
          jsonrpc: '2.0',
          id,
          result: {
            isError: !upload.ok,
            content: [
              {
                type: 'text',
                text: JSON.stringify(
                  upload.ok
                    ? {
                        status: 'saved_to_draft_queue',
                        chapterId: upload.chapter.chapterId,
                        title: upload.chapter.title,
                        warnings: upload.warnings,
                      }
                    : { status: 'validation_failed', errors: upload.errors, warnings: upload.warnings },
                  null,
                  2,
                ),
              },
            ],
          },
        });
        return;
      }

      if (toolName === 'upload_exam_draft') {
        const rawExam = toolArgs.exam as ExamBlueprint | undefined;
        if (!rawExam?.id || !rawExam?.title) {
          res.json({
            jsonrpc: '2.0',
            id,
            result: {
              isError: true,
              content: [{ type: 'text', text: 'Exam blueprint requires non-empty id and title.' }],
            },
          });
          return;
        }
        const savedExam = upsertExamBlueprint({
          ...rawExam,
          publicationStatus: 'draft',
          reviewStage: 'ai_generated',
          updatedAt: new Date().toISOString(),
        });
        res.json({
          jsonrpc: '2.0',
          id,
          result: {
            content: [{ type: 'text', text: JSON.stringify({ status: 'saved_exam_draft', exam: savedExam }, null, 2) }],
          },
        });
        return;
      }

      if (toolName === 'propose_book_structure') {
        const outcome = proposeJobStructure(
          String(toolArgs.jobId ?? ''),
          String(toolArgs.workerName ?? 'freebuff-mcp'),
          {
            summary: typeof toolArgs.summary === 'string' ? toolArgs.summary : undefined,
            bookId: typeof toolArgs.bookId === 'string' ? toolArgs.bookId : undefined,
            chapters: Array.isArray(toolArgs.chapters) ? toolArgs.chapters : [],
          },
        );
        res.json({
          jsonrpc: '2.0',
          id,
          result: {
            isError: !outcome.ok,
            content: [{ type: 'text', text: JSON.stringify(outcome, null, 2) }],
          },
        });
        return;
      }

      res.status(404).json({
        jsonrpc: '2.0',
        id,
        error: { code: -32601, message: `Unknown MCP tool: ${toolName}` },
      });
      return;
    }

    res.status(404).json({
      jsonrpc: '2.0',
      id,
      error: { code: -32601, message: `Unsupported MCP method: ${method}` },
    });
  });

  // ---------------------------------------------------------------------------
  // Built-in Server Gemini Smart Question Generator (Single Extract)
  // ---------------------------------------------------------------------------
  app.post('/api/admin/generate-questions', async (req: Request, res: Response) => {
    if (!getSecuritySettings().allowOptionalPaidServerAi) {
      res.status(403).json({
        code: 'PAID_AI_DISABLED',
        message:
          'Zero-Cost Mode is active: Optional Paid Server AI is locked by default. Queue tasks to your free Freebuff/OpenCode Agent Network, or explicitly unlock Optional Server AI in Admin Control.',
      });
      return;
    }
    if (!ai) {
      res.status(500).json({
        code: 'API_KEY_MISSING',
        message:
          'GEMINI_API_KEY is not configured in the server environment. Configure it in Settings > Secrets to use Optional Paid Server AI.',
      });
      return;
    }

    const body = (req.body ?? {}) as GenerateQuestionsBody;
    const grade = clampInt(body.grade, 9, 9, 12);
    const subjectName = String(body.subjectName ?? '').trim();
    const chapterTitle = String(body.chapterTitle ?? '').trim();
    const extractText = String(body.extractText ?? '').trim();
    const mcqCount = clampInt(body.mcqCount, 3, 0, 8);
    const numericalCount = clampInt(body.numericalCount, 1, 0, 5);
    const writtenCount = clampInt(body.writtenCount, 1, 0, 5);
    const difficultyMin = clampInt(body.difficultyMin, 2, 1, 7);
    const difficultyMax = clampInt(body.difficultyMax, 6, difficultyMin, 7);

    if (!subjectName || !chapterTitle) {
      res.status(400).json({
        code: 'INVALID_CHAPTER_METADATA',
        message: 'Subject name and chapter title are required.',
      });
      return;
    }

    if (extractText.length < 40) {
      res.status(400).json({
        code: 'EXTRACT_TOO_SHORT',
        message: 'Please paste at least 40 characters of textbook content so questions stay faithful to the lesson.',
      });
      return;
    }

    if (extractText.length > 15000) {
      res.status(400).json({
        code: 'EXTRACT_TOO_LONG',
        message: 'Textbook extract is too large (max 15,000 characters). Split long chapters by topic.',
      });
      return;
    }

    const totalRequested = mcqCount + numericalCount + writtenCount;
    if (totalRequested < 1 || totalRequested > 12) {
      res.status(400).json({
        code: 'INVALID_QUESTION_COUNTS',
        message: 'Request between 1 and 12 total questions per generation run.',
      });
      return;
    }

    const examTier = grade <= 10 ? `SSC (Grade ${grade})` : `HSSC (Grade ${grade})`;
    const systemInstruction = [
      'You are an experienced KPK BISE (Peshawar, Mardan, Swat, Malakand, Abbottabad, Kohat, Bannu, D.I. Khan) board paper setter and KPECTB English-medium subject specialist.',
      `Target ONLY KPK BISE ${examTier} board examination pattern (SLO-based Section A MCQs, Section B Short Answers / Numericals, Section C Long Questions). Do NOT generate MDCAT, ETEA, or university entrance items.`,
      'Use clear, simple English appropriate for Pakistani Grades 9-12 English-medium students, with strict SI units and balanced KaTeX $...$ math notation when formulas appear.',
      'Rules per question type:',
      '1) For questionType "mcq": provide exactly 4 distinct options, set marks = 1, set correctAnswer verbatim to one of the 4 options, provide 1-2 progressive hints, and provide optionMisconceptions explaining why each wrong distractor is incorrect.',
      '2) For questionType "numerical": provide ALL 6 required numericalSteps fields: given (non-empty array of values with units), required, formula, substitution, calculation, answerWithUnit. Set correctAnswer equal to answerWithUnit, marks between 3 and 5, and 2 progressive hints.',
      '3) For questionType "short_answer" or "long_answer": provide markingPoints with explicit mark weights (e.g. "State the formula F = ma (1 mark)"), marks = 3 for short_answer or 6-8 for long_answer, 1-2 hints, and a clear model correctAnswer.',
      'Never claim an AI-generated draft is an official past paper.',
    ].join('\n');

    const prompt = [
      `Course Context: KPK BISE ${examTier} | Subject: ${subjectName} | Chapter: ${chapterTitle}`,
      `Difficulty Range: Levels ${difficultyMin} to ${difficultyMax} (out of 7).`,
      `Generate exactly:`,
      `- ${mcqCount} MCQ question(s) ("mcq")`,
      `- ${numericalCount} 6-step Numerical problem(s) ("numerical")`,
      `- ${writtenCount} Board Marking-Scheme question(s) ("short_answer" or "long_answer")`,
      '',
      'TEXTBOOK EXTRACT:',
      extractText,
    ].join('\n');

    try {
      const response = await callGeminiWithRetry(() =>
        ai.models.generateContent({
          model: MODEL_NAME,
          contents: prompt,
          config: {
            systemInstruction,
            responseMimeType: 'application/json',
            responseSchema: {
              type: Type.OBJECT,
              properties: {
                summaryNote: { type: Type.STRING },
                questions: {
                  type: Type.ARRAY,
                  items: {
                    type: Type.OBJECT,
                    properties: {
                      questionType: { type: Type.STRING },
                      difficulty: { type: Type.INTEGER },
                      statement: { type: Type.STRING },
                      options: { type: Type.ARRAY, items: { type: Type.STRING } },
                      optionMisconceptions: {
                        type: Type.ARRAY,
                        items: {
                          type: Type.OBJECT,
                          properties: {
                            option: { type: Type.STRING },
                            reason: { type: Type.STRING },
                          },
                          required: ['option', 'reason'],
                        },
                      },
                      hints: { type: Type.ARRAY, items: { type: Type.STRING } },
                      numericalSteps: {
                        type: Type.OBJECT,
                        properties: {
                          given: { type: Type.ARRAY, items: { type: Type.STRING } },
                          required: { type: Type.STRING },
                          formula: { type: Type.STRING },
                          substitution: { type: Type.STRING },
                          calculation: { type: Type.STRING },
                          answerWithUnit: { type: Type.STRING },
                        },
                        required: ['given', 'required', 'formula', 'substitution', 'calculation', 'answerWithUnit'],
                      },
                      markingPoints: { type: Type.ARRAY, items: { type: Type.STRING } },
                      correctAnswer: { type: Type.STRING },
                      explanation: { type: Type.STRING },
                      marks: { type: Type.INTEGER },
                      sourcePageRef: { type: Type.STRING },
                    },
                    required: [
                      'questionType',
                      'difficulty',
                      'statement',
                      'options',
                      'hints',
                      'markingPoints',
                      'correctAnswer',
                      'explanation',
                      'marks',
                    ],
                  },
                },
              },
              required: ['summaryNote', 'questions'],
            },
          },
        }),
      );

      const rawText = (response.text ?? '{}').trim();
      const parsed = JSON.parse(rawText) as GeminiResponsePayload;
      const normalized = sanitizeQuestions(Array.isArray(parsed.questions) ? parsed.questions : [], {
        grade: grade as 9 | 10 | 11 | 12,
        groupId: grade <= 10 ? 'ssc_science' : 'hssc_pre_engineering',
        subjectId: 'gen_sub',
        chapterId: 'gen_ch',
        topicId: 'gen_t1',
        conceptId: 'gen_c1',
        chapterTitle,
        difficultyMin,
      });

      if (normalized.length === 0) {
        res.status(502).json({
          code: 'EMPTY_GENERATION',
          message: 'Model returned no usable questions for that extract. Add a bit more detail and try again.',
        });
        return;
      }

      res.json({
        model: MODEL_NAME,
        summaryNote: String(parsed.summaryNote ?? `Generated ${normalized.length} KPK BISE draft questions.`).trim(),
        questions: normalized,
      });
    } catch (err: unknown) {
      const mapped = buildErrorResponse(err);
      res.status(mapped.status).json({
        code: mapped.code,
        message: mapped.message,
      });
    }
  });

  // ---------------------------------------------------------------------------
  // PDF & Textbook Notes -> Complete Interactive Chapter Draft Generator
  // ---------------------------------------------------------------------------
  app.post('/api/admin/generate-chapter-from-source', async (req: Request, res: Response) => {
    if (!getSecuritySettings().allowOptionalPaidServerAi) {
      res.status(403).json({
        code: 'PAID_AI_DISABLED',
        message:
          'Zero-Cost Mode is active: Optional Paid Server AI is locked by default. Upload books via PDF Vault to queue Freebuff/OpenCode agents at $0 cost.',
      });
      return;
    }
    if (!ai) {
      res.status(500).json({
        code: 'API_KEY_MISSING',
        message:
          'GEMINI_API_KEY is not configured in the server environment. Connect Freebuff / OpenCode via Agent Network at $0 cost.',
      });
      return;
    }

    const body = (req.body ?? {}) as GenerateChapterFromSourceBody;
    const grade = clampInt(body.grade, 9, 9, 12) as 9 | 10 | 11 | 12;
    const groupId: AcademicGroupId =
      body.groupId ?? (grade <= 10 ? 'ssc_science' : 'hssc_pre_engineering');
    const subjectName = String(body.subjectName ?? '').trim();
    const chapterNumber = clampInt(body.chapterNumber, 1, 1, 30);
    const chapterTitle = String(body.chapterTitle ?? '').trim();
    const extractText = String(body.extractText ?? '').trim();
    const pdfBase64 = String(body.pdfBase64 ?? '').trim();
    const sourceBook =
      String(body.sourceBook ?? '').trim() || `KPECTB ${subjectName} Grade ${grade} (English Medium)`;
    const sourcePage = String(body.sourcePage ?? '').trim() || `Ch. ${chapterNumber}`;

    if (!subjectName || !chapterTitle) {
      res.status(400).json({
        code: 'INVALID_CHAPTER_METADATA',
        message: 'Subject name and chapter title are required.',
      });
      return;
    }

    if (!pdfBase64 && extractText.length < 40) {
      res.status(400).json({
        code: 'SOURCE_REQUIRED',
        message: 'Upload a textbook PDF or paste at least 40 characters of notes/extract.',
      });
      return;
    }

    const cleanSlug = (str: string) =>
      str
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '_')
        .replace(/^_+|_+$/g, '')
        .slice(0, 18);

    const subjectId = String(body.subjectId ?? '').trim() || `${cleanSlug(subjectName)}_${grade}`;
    const chapterId = `${subjectId}_ch${chapterNumber}_${Date.now().toString(36)}`;
    const conceptId = `c_${chapterId}_1`;
    const topicId = `${chapterId}_t1`;

    const examTier = grade <= 10 ? `SSC (Grade ${grade})` : `HSSC (Grade ${grade})`;
    const systemInstruction = [
      'You are an expert KPK BISE (Grades 9-12 English Medium) curriculum designer and visual STEM explainer.',
      `Create a complete, ultra-clear, student-friendly ${examTier} chapter draft grounded strictly in the provided textbook PDF or notes.`,
      'Style & Method Rules:',
      '- Use simple, easy-to-remember KPK Board Method explanations with KaTeX $...$ math notation.',
      '- Build an interactive MotionGraphicSpec (actors on a 0..100 canvas with startX/startY/endX/endY and step stages with formulaLatex) AND a GraphSpec (quantitative x-y plot with labeled axes & highlight points) to visually explain the core idea.',
      '- Include 3 board-aligned MCQs (4 distinct options + optionMisconceptions), 1 full 6-step Numerical problem, and 1 board Short Answer with markingPoints.',
      '- Keep every LaTeX $...$ pair balanced and all graph/motion coordinates finite.',
    ].join('\n');

    const userPrompt = [
      `Course: KPK BISE ${examTier} | Subject: ${subjectName} | Chapter ${chapterNumber}: ${chapterTitle}`,
      extractText ? `\nNOTES / TEXT EXTRACT:\n${extractText}` : '\nAnalyze the attached textbook PDF carefully.',
    ].join('\n');

    const parts: Array<{ text: string } | { inlineData: { data: string; mimeType: string } }> = [];
    if (pdfBase64) {
      parts.push({
        inlineData: {
          data: pdfBase64.replace(/^data:application\/pdf;base64,/, ''),
          mimeType: 'application/pdf',
        },
      });
    }
    parts.push({ text: userPrompt });

    try {
      const response = await callGeminiWithRetry(() =>
        ai.models.generateContent({
          model: MODEL_NAME,
          contents: [{ role: 'user', parts }],
          config: {
            systemInstruction,
            responseMimeType: 'application/json',
            responseSchema: {
              type: Type.OBJECT,
              properties: {
                learningOutcomes: { type: Type.ARRAY, items: { type: Type.STRING } },
                concept: {
                  type: Type.OBJECT,
                  properties: {
                    title: { type: Type.STRING },
                    simpleExplanation: { type: Type.STRING },
                    definitions: {
                      type: Type.ARRAY,
                      items: {
                        type: Type.OBJECT,
                        properties: { term: { type: Type.STRING }, definition: { type: Type.STRING } },
                        required: ['term', 'definition'],
                      },
                    },
                    importantPoints: { type: Type.ARRAY, items: { type: Type.STRING } },
                    formulas: {
                      type: Type.ARRAY,
                      items: {
                        type: Type.OBJECT,
                        properties: {
                          expression: { type: Type.STRING },
                          description: { type: Type.STRING },
                          unit: { type: Type.STRING },
                        },
                        required: ['expression', 'description'],
                      },
                    },
                    workedExamplePrompt: { type: Type.STRING },
                    workedExampleSteps: { type: Type.ARRAY, items: { type: Type.STRING } },
                    workedExampleAnswer: { type: Type.STRING },
                    applications: { type: Type.ARRAY, items: { type: Type.STRING } },
                    commonMistake: { type: Type.STRING },
                    commonMistakeCorrection: { type: Type.STRING },
                    quickRevisionSummary: { type: Type.ARRAY, items: { type: Type.STRING } },
                    glossaryHints: {
                      type: Type.ARRAY,
                      items: {
                        type: Type.OBJECT,
                        properties: {
                          term: { type: Type.STRING },
                          urduMeaning: { type: Type.STRING },
                          simpleHint: { type: Type.STRING },
                        },
                        required: ['term', 'urduMeaning', 'simpleHint'],
                      },
                    },
                    microCards: {
                      type: Type.ARRAY,
                      items: {
                        type: Type.OBJECT,
                        properties: {
                          stageTitle: { type: Type.STRING },
                          body: { type: Type.STRING },
                        },
                        required: ['stageTitle', 'body'],
                      },
                    },
                    motionGraphic: {
                      type: Type.OBJECT,
                      properties: {
                        title: { type: Type.STRING },
                        caption: { type: Type.STRING },
                        durationSec: { type: Type.NUMBER },
                        sceneType: { type: Type.STRING },
                        actors: {
                          type: Type.ARRAY,
                          items: {
                            type: Type.OBJECT,
                            properties: {
                              id: { type: Type.STRING },
                              label: { type: Type.STRING },
                              shape: { type: Type.STRING },
                              colorToken: { type: Type.STRING },
                              startX: { type: Type.NUMBER },
                              startY: { type: Type.NUMBER },
                              endX: { type: Type.NUMBER },
                              endY: { type: Type.NUMBER },
                              size: { type: Type.NUMBER },
                            },
                            required: ['id', 'label', 'shape', 'colorToken', 'startX', 'startY', 'endX', 'endY'],
                          },
                        },
                        stages: {
                          type: Type.ARRAY,
                          items: {
                            type: Type.OBJECT,
                            properties: {
                              atPercent: { type: Type.NUMBER },
                              label: { type: Type.STRING },
                              formulaLatex: { type: Type.STRING },
                              callout: { type: Type.STRING },
                            },
                            required: ['atPercent', 'label', 'callout'],
                          },
                        },
                      },
                      required: ['title', 'caption', 'durationSec', 'sceneType', 'actors', 'stages'],
                    },
                    graph: {
                      type: Type.OBJECT,
                      properties: {
                        title: { type: Type.STRING },
                        caption: { type: Type.STRING },
                        xLabel: { type: Type.STRING },
                        yLabel: { type: Type.STRING },
                        xMin: { type: Type.NUMBER },
                        xMax: { type: Type.NUMBER },
                        yMin: { type: Type.NUMBER },
                        yMax: { type: Type.NUMBER },
                        series: {
                          type: Type.ARRAY,
                          items: {
                            type: Type.OBJECT,
                            properties: {
                              name: { type: Type.STRING },
                              colorToken: { type: Type.STRING },
                              showArea: { type: Type.BOOLEAN },
                              points: {
                                type: Type.ARRAY,
                                items: {
                                  type: Type.OBJECT,
                                  properties: { x: { type: Type.NUMBER }, y: { type: Type.NUMBER } },
                                  required: ['x', 'y'],
                                },
                              },
                            },
                            required: ['name', 'colorToken', 'points'],
                          },
                        },
                        highlights: {
                          type: Type.ARRAY,
                          items: {
                            type: Type.OBJECT,
                            properties: {
                              x: { type: Type.NUMBER },
                              y: { type: Type.NUMBER },
                              label: { type: Type.STRING },
                            },
                            required: ['x', 'y', 'label'],
                          },
                        },
                      },
                      required: ['title', 'caption', 'xLabel', 'yLabel', 'xMin', 'xMax', 'yMin', 'yMax', 'series', 'highlights'],
                    },
                  },
                  required: [
                    'title',
                    'simpleExplanation',
                    'importantPoints',
                    'formulas',
                    'workedExamplePrompt',
                    'workedExampleSteps',
                    'workedExampleAnswer',
                    'commonMistake',
                    'commonMistakeCorrection',
                    'quickRevisionSummary',
                  ],
                },
                questions: {
                  type: Type.ARRAY,
                  items: {
                    type: Type.OBJECT,
                    properties: {
                      questionType: { type: Type.STRING },
                      difficulty: { type: Type.INTEGER },
                      statement: { type: Type.STRING },
                      options: { type: Type.ARRAY, items: { type: Type.STRING } },
                      optionMisconceptions: {
                        type: Type.ARRAY,
                        items: {
                          type: Type.OBJECT,
                          properties: { option: { type: Type.STRING }, reason: { type: Type.STRING } },
                          required: ['option', 'reason'],
                        },
                      },
                      hints: { type: Type.ARRAY, items: { type: Type.STRING } },
                      numericalSteps: {
                        type: Type.OBJECT,
                        properties: {
                          given: { type: Type.ARRAY, items: { type: Type.STRING } },
                          required: { type: Type.STRING },
                          formula: { type: Type.STRING },
                          substitution: { type: Type.STRING },
                          calculation: { type: Type.STRING },
                          answerWithUnit: { type: Type.STRING },
                        },
                        required: ['given', 'required', 'formula', 'substitution', 'calculation', 'answerWithUnit'],
                      },
                      markingPoints: { type: Type.ARRAY, items: { type: Type.STRING } },
                      correctAnswer: { type: Type.STRING },
                      explanation: { type: Type.STRING },
                      marks: { type: Type.INTEGER },
                    },
                    required: [
                      'questionType',
                      'difficulty',
                      'statement',
                      'options',
                      'hints',
                      'markingPoints',
                      'correctAnswer',
                      'explanation',
                      'marks',
                    ],
                  },
                },
              },
              required: ['learningOutcomes', 'concept', 'questions'],
            },
          },
        }),
      );

      const parsed = JSON.parse((response.text ?? '{}').trim()) as GeminiGeneratedChapterPayload;
      const cRaw = parsed.concept ?? {};

      const concept: CmsConcept = {
        id: conceptId,
        chapterId,
        topicId,
        orderIndex: 1,
        title: String(cRaw.title || chapterTitle).trim(),
        locale: 'en',
        textDirection: 'ltr',
        simpleExplanation: String(cRaw.simpleExplanation || 'Review textbook explanation.').trim(),
        definitions: (cRaw.definitions ?? [])
          .filter((d) => d.term && d.definition)
          .map((d) => ({ term: String(d.term).trim(), definition: String(d.definition).trim() })),
        importantPoints: (cRaw.importantPoints ?? []).map((p) => String(p).trim()).filter(Boolean),
        formulas: (cRaw.formulas ?? [])
          .filter((f) => f.expression && f.description)
          .map((f) => ({
            expression: String(f.expression).trim(),
            description: String(f.description).trim(),
            unit: f.unit ? String(f.unit).trim() : undefined,
          })),
        diagramCaption: `${chapterTitle} visual overview`,
        diagramSvg: '',
        motionGraphics: sanitizeMotionGraphic(cRaw.motionGraphic, conceptId),
        graphs: sanitizeGraph(cRaw.graph, conceptId),
        workedExamplePrompt: String(cRaw.workedExamplePrompt || `Board example on ${chapterTitle}`).trim(),
        workedExampleSteps: (cRaw.workedExampleSteps ?? []).map((s) => String(s).trim()).filter(Boolean),
        workedExampleAnswer: String(cRaw.workedExampleAnswer || 'See solved step').trim(),
        applications: (cRaw.applications ?? []).map((a) => String(a).trim()).filter(Boolean),
        commonMistake: String(cRaw.commonMistake || 'Mixing up SI units').trim(),
        commonMistakeCorrection: String(cRaw.commonMistakeCorrection || 'Convert all values to SI units first.').trim(),
        quickRevisionSummary: (cRaw.quickRevisionSummary ?? []).map((s) => String(s).trim()).filter(Boolean),
        videoLinks: [],
        glossaryHints: (cRaw.glossaryHints ?? [])
          .filter((g) => g.term && g.simpleHint)
          .map((g) => ({
            term: String(g.term).trim(),
            urduMeaning: String(g.urduMeaning || '').trim(),
            simpleHint: String(g.simpleHint).trim(),
          })),
        microCards: (cRaw.microCards ?? [])
          .filter((m) => m.stageTitle && m.body)
          .map((m) => ({ stageTitle: String(m.stageTitle).trim(), body: String(m.body).trim() })),
        sourceBook,
        sourcePage,
        reviewStatus: 'draft',
        reviewedBy: '',
      };

      const questions = sanitizeQuestions(Array.isArray(parsed.questions) ? parsed.questions : [], {
        grade,
        groupId,
        subjectId,
        chapterId,
        topicId,
        conceptId,
        chapterTitle,
        difficultyMin: 2,
      });

      const chapterDraft: CmsChapter = {
        chapterId,
        programmeId: 'ssc_hssc',
        grade,
        groupId,
        subjectId,
        subjectName,
        chapterNumber,
        title: chapterTitle,
        learningOutcomes: (parsed.learningOutcomes ?? []).map((l) => String(l).trim()).filter(Boolean),
        publicationStatus: 'draft',
        packVersion: 1,
        permissionVerified: true,
        origin: 'ai_generated_draft',
        concepts: [concept],
        questions,
      };

      const saved = upsertDraftChapter(
        chapterDraft,
        'ai_generated_draft',
        body.pdfFilename ? `Gemini PDF Generator (${body.pdfFilename})` : 'Gemini Textbook Generator',
      );
      if (!saved.ok) {
        res.status(400).json({
          code: 'GENERATED_DRAFT_VALIDATION_FAILED',
          message: saved.errors.join(' '),
          errors: saved.errors,
        });
        return;
      }

      res.status(201).json({
        status: 'saved_to_draft_queue',
        chapter: saved.chapter,
        warnings: saved.warnings,
      });
    } catch (err: unknown) {
      const mapped = buildErrorResponse(err);
      res.status(mapped.status).json({
        code: mapped.code,
        message: mapped.message,
      });
    }
  });

  if (process.env.NODE_ENV !== 'production') {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: {
        middlewareMode: true,
        hmr: process.env.ENABLE_HMR === 'true' ? undefined : false,
      },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distDir = path.resolve(__dirname, 'dist');
    app.use(express.static(distDir));
    app.get('*', (_req: Request, res: Response) => {
      const indexHtml = path.join(distDir, 'index.html');
      if (fs.existsSync(indexHtml)) {
        res.sendFile(indexHtml);
      } else {
        res.status(404).send('Build output not found. Run npm run build first.');
      }
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Roshan Study server listening on http://0.0.0.0:${PORT}`);
  });
}

createServer().catch((err) => {
  console.error('Failed to start Roshan Study server:', err);
  process.exit(1);
});
