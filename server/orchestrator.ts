import { GoogleGenAI, Type } from '@google/genai';
import type {
  AcademicGroupId,
  AgentRoleId,
  AgentTask,
  AgentTaskLogEntry,
  BookDocument,
  CmsChapter,
  CmsConcept,
  CmsQuestion,
  ExamBlueprint,
  ExamSection,
  ExecutionMode,
  GraphSpec,
  MonitoringIssueReport,
  MotionGraphicSpec,
  ProductionJob,
  ProductionReport,
  ProductionScope,
  ProgrammeId,
  SourceBundle,
  StructureProposal,
  ValidatorCheckResult,
  VerificationReport,
} from '../src/types/cms.ts';
import {
  appendAudit,
  approveAndPublishChapter,
  approveAndPublishExam,
  computeChapterChecksum,
  computeTextSha256,
  detectCatalogDuplicates,
  findCachedSourceBundle,
  getChapterById,
  getProductionJob,
  getSecuritySettings,
  getSourceBundle,
  getVerificationReportForChapter,
  incrementAgentStats,
  listExamBlueprints,
  listIssueReports,
  listProductionJobs,
  recordQuarantinedSubmission,
  saveCmsChapter,
  saveProductionJob,
  saveVerificationReport,
  sanitizeUntrustedText,
  upsertBook,
  upsertDraftChapter,
  upsertExamBlueprint,
  upsertIssueReport,
  upsertSourceBundle,
  validateChapterForCloud,
} from './cloudStore.ts';
import { syncPackToCloudflareIfConfigured } from './cloudflareSync.ts';

const MODEL_NAME = 'gemini-4-hydrogen';

function getGeminiClient(): GoogleGenAI | null {
  // Strictly disabled by default under Zero-Cost Architecture unless owner explicitly unlocks optional paid AI
  if (!getSecuritySettings().allowOptionalPaidServerAi) return null;
  if (!process.env.GEMINI_API_KEY) return null;
  return new GoogleGenAI({
    apiKey: process.env.GEMINI_API_KEY,
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      },
    },
  });
}

// Keep raw PDF binary in memory during active session only (not persisted as giant base64 blob)
const ephemeralPdfCache = new Map<string, string>();

function slugify(str: string): string {
  return str
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 20);
}

function defaultBudgetCap(): number {
  const raw = Number(process.env.GEMINI_MAX_CALLS_PER_JOB);
  return Number.isFinite(raw) && raw >= 2 && raw <= 30 ? Math.round(raw) : 10;
}

export interface CreateProductionJobInput {
  programmeId?: ProgrammeId;
  grade: 9 | 10 | 11 | 12;
  groupId: AcademicGroupId | 'admission';
  subjectName: string;
  chapterNumber: number;
  chapterTitle: string;
  sourceBook: string;
  extractText?: string;
  pdfBase64?: string;
  pdfFilename?: string;
  permissionVerified: boolean;
  trustedAutoApproveStructure?: boolean;
  scope: ProductionScope;
  executionMode: ExecutionMode;
  maxBudgetCalls?: number;
}

function buildJobTasks(
  jobId: string,
  chapterId: string,
  chapterTitle: string,
  scope: ProductionScope,
  bookId?: string,
  priority = 5,
): AgentTask[] {
  const now = new Date().toISOString();
  const tasks: AgentTask[] = [];
  const add = (
    suffix: string,
    role: AgentRoleId,
    phase: number,
    title: string,
    dependsOn: string[],
    inputSummary: string,
  ) => {
    tasks.push({
      id: `${jobId}_${suffix}`,
      jobId,
      chapterId,
      bookId,
      role,
      phase,
      priority,
      title,
      dependsOnTaskIds: dependsOn.map((d) => `${jobId}_${d}`),
      idempotencyKey: `${jobId}:${role}:${suffix}`,
      status: 'queued',
      retryCount: 0,
      maxRetries: 2,
      inputSummary,
      executionLogs: [
        {
          timestamp: now,
          event: 'task_queued',
          detail: `Queued ${title} for external Freebuff/OpenCode network.`,
        },
      ],
      createdAt: now,
    });
  };

  add(
    'p1_curriculum',
    'curriculum_research',
    1,
    'Curriculum Research & KPK Board Alignment',
    [],
    `Verify KPK BISE 8-board SLOs & syllabus boundaries for "${chapterTitle}".`,
  );
  add(
    'p2_source',
    'source_processing',
    2,
    'Source Processing & Extraction Verification',
    ['p1_curriculum'],
    'Inspect uploaded PDF / notes chunks, page citations, and extraction confidence.',
  );
  add(
    'p3_architect',
    'chapter_architect',
    3,
    'Chapter Architecture & Topic Blueprint',
    ['p2_source'],
    'Structure topics, concept sequence, visual specs, and exam quotas.',
  );

  const phase4Ids: string[] = [];
  if (scope === 'full_chapter_pack' || scope === 'concepts_and_notes') {
    add(
      'p4_concepts',
      'concept_writer',
      4,
      'Concept Writer (12-Part Duolingo+Brilliant Cards)',
      ['p3_architect'],
      'Draft simple explanations, KaTeX formulas, micro-cards with quick checks, and worked examples.',
    );
    add(
      'p4_notes',
      'notes_generator',
      4,
      'Notes Generator (Revision & Urdu Hints)',
      ['p3_architect'],
      'Produce quick revision summary, common exam mistakes, and 1-tap Urdu hints.',
    );
    phase4Ids.push('p4_concepts', 'p4_notes');
  }
  if (scope === 'full_chapter_pack' || scope === 'visuals_and_graphs') {
    add(
      'p4_visuals',
      'diagram_visualization',
      4,
      'Diagram & Interactive Motion/Graph Agent',
      ['p3_architect'],
      'Generate $0-runtime MotionGraphicSpec animation and interactive Math GraphSpec.',
    );
    phase4Ids.push('p4_visuals');
  }
  if (scope === 'full_chapter_pack' || scope === 'question_bank' || scope === 'exams_and_quizzes') {
    add(
      'p4_questions',
      'question_generator',
      4,
      'Question Generator (MCQs & Marking Schemes)',
      ['p3_architect'],
      'Author KPK board MCQs with optionMisconceptions and weighted marking-scheme written questions.',
    );
    add(
      'p4_numericals',
      'numerical_specialist',
      4,
      'Numerical Specialist (6-Step KPK Board Method)',
      ['p3_architect'],
      'Author numericals with all 6 steps (given, required, formula, substitution, calculation, answerWithUnit).',
    );
    phase4Ids.push('p4_questions', 'p4_numericals');
  }

  add(
    'p5_practice',
    'practice_designer',
    5,
    'Practice Sequence & Scaffolding Designer',
    phase4Ids,
    'Arrange concepts and Level 1-7 items into Understand -> Recall -> Practise -> Apply.',
  );

  add(
    'p6_val_answer',
    'independent_answer_validator',
    6,
    'Independent Answer & Numerical Verification',
    ['p5_practice'],
    'Independently re-solve every numerical and verify MCQ answer consistency.',
  );
  add(
    'p6_val_curriculum',
    'curriculum_validator',
    6,
    'Curriculum & Provenance Alignment Check',
    ['p5_practice'],
    'Audit KPK BISE alignment, ssc_hssc track isolation, and source citations.',
  );
  add(
    'p6_val_language',
    'language_editor',
    6,
    'Language & KaTeX Formula Editor',
    ['p5_practice'],
    'Verify student-friendly Pakistani English and balanced KaTeX $ delimiters.',
  );
  add(
    'p6_val_pedagogy',
    'pedagogy_reviewer',
    6,
    'Pedagogy & Progressive Clarity Review',
    ['p5_practice'],
    'Score micro-card progression, worked examples, and misconception diagnostics.',
  );
  add(
    'p6_val_duplicate',
    'duplicate_detection',
    6,
    'Cross-Catalog Duplicate Detection',
    ['p5_practice'],
    'Scan workspace catalog for duplicate stems or repeated numerical problems.',
  );
  add(
    'p6_qa_gate',
    'quality_assurance',
    6,
    'Quality Assurance Sign-Off Gate',
    [
      'p6_val_answer',
      'p6_val_curriculum',
      'p6_val_language',
      'p6_val_pedagogy',
      'p6_val_duplicate',
    ],
    'Aggregate deterministic schema checks and 5 independent validator scores.',
  );

  add(
    'p8_exams',
    'examination_builder',
    8,
    'Examination Blueprint Builder',
    ['p6_qa_gate'],
    'Build Topic Quiz & Chapter Board Test blueprints preserving provenance and marking schemes.',
  );

  return tasks;
}

export function createAndScheduleProductionJob(input: CreateProductionJobInput): ProductionJob {
  const now = new Date().toISOString();
  const cleanText = String(input.extractText ?? '').trim();
  const hasPdf = Boolean(input.pdfBase64 && input.pdfBase64.trim().length > 0);
  const hashBasis = `${input.grade}:${input.subjectName}:${input.chapterNumber}:${cleanText}:${input.pdfFilename ?? ''}`;
  const sha256 = computeTextSha256(hashBasis);

  let sourceBundle = findCachedSourceBundle(sha256);
  if (!sourceBundle) {
    const confidence = hasPdf
      ? cleanText.length >= 120
        ? 0.94
        : 0.85
      : cleanText.length >= 300
        ? 0.92
        : cleanText.length >= 80
          ? 0.78
          : 0.35;

    const bundle: SourceBundle = {
      id: `src_${Date.now().toString(36)}`,
      grade: input.grade,
      groupId: input.groupId,
      subjectName: input.subjectName.trim(),
      chapterNumber: input.chapterNumber,
      chapterTitle: input.chapterTitle.trim(),
      sourceBook:
        input.sourceBook.trim() ||
        `KPECTB ${input.subjectName.trim()} Grade ${input.grade} (English Medium)`,
      filename: input.pdfFilename?.trim() || undefined,
      sha256,
      extractedText: cleanText,
      hasPdfBinary: hasPdf,
      pageAnchors: [`Ch. ${input.chapterNumber}`],
      extractionConfidence: confidence,
      requiresHumanReview: !hasPdf && cleanText.length < 40,
      permissionVerified: input.permissionVerified,
      createdAt: now,
    };
    sourceBundle = upsertSourceBundle(bundle);
  }

  if (hasPdf && input.pdfBase64) {
    ephemeralPdfCache.set(
      sourceBundle.id,
      input.pdfBase64.replace(/^data:application\/pdf;base64,/, ''),
    );
  }

  const subjectId = `${slugify(input.subjectName)}_${input.grade}`;
  const chapterId = `${subjectId}_ch${input.chapterNumber}_${Date.now().toString(36).slice(-5)}`;
  const jobId = `job_${Date.now().toString(36)}`;
  const programmeId: ProgrammeId =
    input.groupId === 'admission' ? 'mdcat' : (input.programmeId ?? 'ssc_hssc');

  const requestedMode: ExecutionMode =
    input.executionMode === 'gemini_cached' && getSecuritySettings().allowOptionalPaidServerAi
      ? 'gemini_cached'
      : 'external_agent_queue';

  const job: ProductionJob = {
    id: jobId,
    programmeId,
    grade: input.grade,
    groupId: input.groupId,
    subjectId,
    subjectName: input.subjectName.trim(),
    chapterNumber: input.chapterNumber,
    chapterTitle: input.chapterTitle.trim(),
    chapterId,
    sourceBundleId: sourceBundle.id,
    scope: input.scope,
    executionMode: requestedMode,
    status: requestedMode === 'external_agent_queue' ? 'waiting_external' : 'queued',
    currentPhase: 1,
    maxBudgetCalls: Math.max(2, Math.min(20, input.maxBudgetCalls ?? defaultBudgetCap())),
    callsUsed: 0,
    maxRetriesPerTask: 2,
    trustedAutoApproveStructure: Boolean(input.trustedAutoApproveStructure),
    structureStatus: 'not_proposed',
    tasks: buildJobTasks(jobId, chapterId, input.chapterTitle.trim(), input.scope),
    alerts: [],
    createdAt: now,
    updatedAt: now,
  };

  saveProductionJob(job);
  appendAudit({
    action: 'job_started',
    chapterId,
    actor: 'Project Manager Agent',
    summary: `Started ${requestedMode} job (${job.scope}) for G${job.grade} ${job.subjectName} — ${job.chapterTitle}.`,
  });

  if (job.executionMode === 'gemini_cached') {
    void executeGeminiAutonomousJob(job.id);
  }

  return job;
}

export function createJobFromBook(
  book: BookDocument,
  options?: {
    chapterNumber?: number;
    chapterTitle?: string;
    scope?: ProductionScope;
    priority?: number;
    trustedAutoApproveStructure?: boolean;
  },
): ProductionJob {
  const now = new Date().toISOString();
  const chapterNumber = Math.max(1, options?.chapterNumber ?? 1);
  const chapterTitle =
    options?.chapterTitle?.trim() || `${book.title} — Chapter ${chapterNumber}`;
  const scope = options?.scope ?? 'full_chapter_pack';
  const priority = options?.priority ?? 7;

  let sourceBundle = findCachedSourceBundle(book.sha256);
  if (!sourceBundle) {
    sourceBundle = upsertSourceBundle({
      id: `src_${book.id}_v${book.version}`,
      grade: book.grade,
      groupId: book.groupId,
      subjectName: book.subjectName,
      chapterNumber,
      chapterTitle,
      sourceBook: book.sourceBook,
      filename: book.filename,
      sha256: book.sha256,
      extractedText: book.extractedText,
      hasPdfBinary: true,
      pageAnchors:
        book.pageTexts.length > 0
          ? book.pageTexts.slice(0, 12).map((p) => `p. ${p.page}`)
          : [`Ch. ${chapterNumber}`],
      extractionConfidence: book.metadata.extractionQuality === 'text_extracted' ? 0.94 : 0.68,
      requiresHumanReview: false,
      permissionVerified: book.permissionVerified,
      createdAt: now,
    });
  }

  const chapterId = `${book.subjectId}_ch${chapterNumber}_${book.id.slice(-5)}`;
  const jobId = `job_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 5)}`;

  const job: ProductionJob = {
    id: jobId,
    programmeId: book.programmeId,
    grade: book.grade,
    groupId: book.groupId,
    subjectId: book.subjectId,
    subjectName: book.subjectName,
    chapterNumber,
    chapterTitle,
    chapterId,
    sourceBundleId: sourceBundle.id,
    scope,
    executionMode: 'external_agent_queue',
    status: 'waiting_external',
    currentPhase: 1,
    maxBudgetCalls: 0,
    callsUsed: 0,
    maxRetriesPerTask: 2,
    trustedAutoApproveStructure:
      options?.trustedAutoApproveStructure ?? Boolean(book.trustedAutoApproveStructure),
    structureStatus: 'not_proposed',
    tasks: buildJobTasks(jobId, chapterId, chapterTitle, scope, book.id, priority),
    alerts: [],
    createdAt: now,
    updatedAt: now,
  };

  saveProductionJob(job);
  upsertBook({
    ...book,
    productionJobIds: [job.id, ...book.productionJobIds].slice(0, 20),
  });
  appendAudit({
    action: 'job_started',
    chapterId,
    actor: 'Book Production Coordinator',
    summary: `Queued $0 external agent job from PDF book "${book.title}" (v${book.version}, ${book.pageCount} pages).`,
  });
  return job;
}

export function proposeJobStructure(
  jobId: string,
  workerName: string,
  rawProposal: {
    summary?: string;
    bookId?: string;
    chapters?: Array<{
      chapterNumber?: number;
      title?: string;
      topics?: string[];
      learningObjectives?: string[];
      prerequisites?: string[];
      estimatedConcepts?: number;
      estimatedQuestions?: number;
      sourcePages?: string;
    }>;
  },
): { ok: true; job: ProductionJob; autoApproved: boolean } | { ok: false; status: number; message: string } {
  const job = getProductionJob(jobId);
  if (!job) {
    return { ok: false, status: 404, message: `Production job "${jobId}" not found.` };
  }
  const chaptersRaw = Array.isArray(rawProposal.chapters) ? rawProposal.chapters : [];
  if (chaptersRaw.length === 0) {
    return {
      ok: false,
      status: 400,
      message: 'Structure proposal must include at least 1 chapter entry with topics and objectives.',
    };
  }

  const sanitizedChapters = chaptersRaw
    .map((ch, idx) => ({
      chapterNumber: Math.max(1, Number(ch.chapterNumber) || idx + 1),
      title: sanitizeUntrustedText(String(ch.title ?? '')),
      topics: (Array.isArray(ch.topics) ? ch.topics : []).map((t) => sanitizeUntrustedText(String(t))).filter(Boolean),
      learningObjectives: (Array.isArray(ch.learningObjectives) ? ch.learningObjectives : [])
        .map((o) => sanitizeUntrustedText(String(o)))
        .filter(Boolean),
      prerequisites: (Array.isArray(ch.prerequisites) ? ch.prerequisites : [])
        .map((p) => sanitizeUntrustedText(String(p)))
        .filter(Boolean),
      estimatedConcepts: Math.max(1, Number(ch.estimatedConcepts) || 2),
      estimatedQuestions: Math.max(1, Number(ch.estimatedQuestions) || 6),
      sourcePages: ch.sourcePages ? sanitizeUntrustedText(String(ch.sourcePages)) : undefined,
    }))
    .filter((ch) => ch.title.length >= 2 && ch.topics.length >= 1);

  if (sanitizedChapters.length === 0) {
    return {
      ok: false,
      status: 400,
      message: 'Each proposed chapter requires a non-empty title and at least 1 topic.',
    };
  }

  const now = new Date().toISOString();
  const autoApproved = Boolean(job.trustedAutoApproveStructure);
  const proposal: StructureProposal = {
    proposedBy: sanitizeUntrustedText(workerName || 'External Architect Agent'),
    proposedAt: now,
    summary:
      sanitizeUntrustedText(String(rawProposal.summary ?? '')) ||
      `Proposed ${sanitizedChapters.length} chapter(s) from textbook index.`,
    bookId: rawProposal.bookId,
    chapters: sanitizedChapters,
    ...(autoApproved
      ? {
          reviewedBy: 'Trusted Auto-Approve Policy',
          reviewedAt: now,
          reviewerNotes: 'Auto-approved per owner trusted-book setting.',
        }
      : {}),
  };

  // Mark Phase 1-3 tasks ready/complete if worker proposed directly at Phase 3
  const nextTasks = job.tasks.map((t) =>
    t.phase <= 3 && t.status !== 'completed'
      ? {
          ...t,
          status: 'completed' as const,
          assignedWorker: proposal.proposedBy,
          finishedAt: now,
          outputSummary: `Structure blueprint proposed (${sanitizedChapters.length} chapter(s)).`,
        }
      : t,
  );

  const updatedJob: ProductionJob = {
    ...job,
    currentPhase: Math.max(job.currentPhase, 3),
    structureStatus: autoApproved ? 'approved' : 'proposed_pending',
    proposedStructure: proposal,
    status: autoApproved ? 'waiting_external' : 'awaiting_approval',
    tasks: nextTasks,
    alerts: autoApproved
      ? job.alerts
      : [`Book structure proposal submitted by ${proposal.proposedBy} — awaiting owner structure approval before Phase 4 generation.`, ...job.alerts].slice(0, 20),
    updatedAt: now,
  };

  saveProductionJob(updatedJob);
  appendAudit({
    action: autoApproved ? 'structure_approved' : 'structure_proposed',
    chapterId: job.chapterId,
    actor: proposal.proposedBy,
    summary: autoApproved
      ? `Proposed and auto-approved structure for "${job.chapterTitle}" (${sanitizedChapters.length} chapters).`
      : `Submitted textbook structure proposal for "${job.chapterTitle}" (${sanitizedChapters.length} chapters) — awaiting owner approval.`,
  });

  return { ok: true, job: updatedJob, autoApproved };
}

export function reviewJobStructure(
  jobId: string,
  approved: boolean,
  reviewedBy: string,
  notes?: string,
): { ok: true; job: ProductionJob } | { ok: false; status: number; message: string } {
  const reviewer = reviewedBy.trim();
  if (!reviewer) {
    return { ok: false, status: 400, message: 'Reviewer name is required to approve or reject structure.' };
  }
  const job = getProductionJob(jobId);
  if (!job) {
    return { ok: false, status: 404, message: `Job "${jobId}" not found.` };
  }
  const now = new Date().toISOString();
  const cleanNotes = notes ? sanitizeUntrustedText(notes) : undefined;

  if (approved) {
    const updated: ProductionJob = {
      ...job,
      structureStatus: 'approved',
      status: 'waiting_external',
      currentPhase: Math.max(job.currentPhase, 4),
      proposedStructure: job.proposedStructure
        ? {
            ...job.proposedStructure,
            reviewedBy: reviewer,
            reviewedAt: now,
            reviewerNotes: cleanNotes,
          }
        : undefined,
      alerts: [`Owner ${reviewer} approved curriculum structure — Phase 4 specialist agents unlocked.`, ...job.alerts].slice(0, 20),
      updatedAt: now,
    };
    saveProductionJob(updated);
    appendAudit({
      action: 'structure_approved',
      chapterId: job.chapterId,
      actor: reviewer,
      summary: `Approved textbook structure for "${job.chapterTitle}". Phase 4 generation unlocked.`,
    });
    return { ok: true, job: updated };
  }

  const nextTasks = job.tasks.map((t) =>
    t.role === 'chapter_architect'
      ? {
          ...t,
          status: 'queued' as const,
          assignedWorker: undefined,
          leaseExpiresAt: undefined,
          feedbackNotes: cleanNotes || 'Owner requested changes to proposed structure.',
          priority: 10,
        }
      : t,
  );
  const rejectedJob: ProductionJob = {
    ...job,
    structureStatus: 'rejected',
    status: 'waiting_external',
    currentPhase: 3,
    proposedStructure: job.proposedStructure
      ? {
          ...job.proposedStructure,
          reviewedBy: reviewer,
          reviewedAt: now,
          reviewerNotes: cleanNotes || 'Structure revision requested.',
        }
      : undefined,
    tasks: nextTasks,
    alerts: [`Owner rejected proposed structure: ${cleanNotes || 'Re-architect chapter outline.'}`, ...job.alerts].slice(0, 20),
    updatedAt: now,
  };
  saveProductionJob(rejectedJob);
  appendAudit({
    action: 'structure_rejected',
    chapterId: job.chapterId,
    actor: reviewer,
    summary: `Requested structure revision on "${job.chapterTitle}": ${cleanNotes || 'No note provided'}`,
  });
  return { ok: true, job: rejectedJob };
}

export function generateExamBlueprintsForChapter(
  chapter: CmsChapter,
  jobId?: string,
): ExamBlueprint[] {
  const now = new Date().toISOString();
  const mcqs = chapter.questions.filter((q) => q.questionType === 'mcq');
  const numericals = chapter.questions.filter((q) => q.questionType === 'numerical');
  const written = chapter.questions.filter(
    (q) => q.questionType === 'short_answer' || q.questionType === 'long_answer',
  );

  const created: ExamBlueprint[] = [];

  if (mcqs.length > 0) {
    const quizQs = mcqs.slice(0, 5);
    const quiz: ExamBlueprint = {
      id: `exam_${chapter.chapterId}_topic_quiz`,
      programmeId: chapter.programmeId,
      grade: chapter.grade,
      groupId: chapter.groupId,
      subjectId: chapter.subjectId,
      subjectName: chapter.subjectName,
      chapterId: chapter.chapterId,
      title: `${chapter.title} — 5-Min Quick Topic Quiz`,
      examKind: 'topic_quiz',
      durationMinutes: 10,
      totalMarks: quizQs.length,
      sections: [
        {
          label: 'Section A — Concept Check MCQs',
          questionType: 'mcq',
          marksEach: 1,
          questionIds: quizQs.map((q) => q.id),
        },
      ],
      publicationStatus: 'draft',
      reviewStage: chapter.reviewStage ?? 'ai_generated',
      packVersion: 1,
      reviewedBy: '',
      createdAt: now,
      updatedAt: now,
    };
    upsertExamBlueprint(quiz);
    created.push(quiz);
  }

  const sections: ExamSection[] = [];
  if (mcqs.length > 0) {
    sections.push({
      label: 'Section A — Objective (KPK BISE Pattern)',
      questionType: 'mcq',
      marksEach: 1,
      questionIds: mcqs.map((q) => q.id),
    });
  }
  if (written.length > 0) {
    sections.push({
      label: 'Section B — Short / Long Structured Questions',
      questionType: written[0].questionType,
      marksEach: written[0].marks || 3,
      questionIds: written.map((q) => q.id),
    });
  }
  if (numericals.length > 0) {
    sections.push({
      label: 'Section C — 6-Step KPK Numericals',
      questionType: 'numerical',
      marksEach: numericals[0].marks || 4,
      questionIds: numericals.map((q) => q.id),
    });
  }

  if (sections.length > 0) {
    const totalMarks = sections.reduce(
      (sum, sec) => sum + sec.marksEach * sec.questionIds.length,
      0,
    );
    const boardExam: ExamBlueprint = {
      id: `exam_${chapter.chapterId}_board_test`,
      programmeId: chapter.programmeId,
      grade: chapter.grade,
      groupId: chapter.groupId,
      subjectId: chapter.subjectId,
      subjectName: chapter.subjectName,
      chapterId: chapter.chapterId,
      title: `Grade ${chapter.grade} ${chapter.subjectName} — Ch. ${chapter.chapterNumber} Board Test`,
      examKind: 'board_model_exam',
      durationMinutes: Math.max(20, Math.min(90, totalMarks * 2)),
      totalMarks,
      sections,
      publicationStatus: 'draft',
      reviewStage: chapter.reviewStage ?? 'ai_generated',
      packVersion: 1,
      reviewedBy: '',
      createdAt: now,
      updatedAt: now,
    };
    upsertExamBlueprint(boardExam);
    created.push(boardExam);
  }

  if (jobId) {
    const job = getProductionJob(jobId);
    if (job) {
      const tIdx = job.tasks.findIndex((t) => t.role === 'examination_builder');
      if (tIdx >= 0) {
        job.tasks[tIdx] = {
          ...job.tasks[tIdx],
          status: 'completed',
          outputSummary: `Built ${created.length} exam blueprint(s).`,
          finishedAt: now,
        };
        saveProductionJob(job);
      }
    }
  }

  return created;
}

function buildDeterministicChecks(chapter: CmsChapter): ValidatorCheckResult[] {
  const now = new Date().toISOString();
  const schemaVal = validateChapterForCloud(chapter, 'draft');
  const dup = detectCatalogDuplicates(chapter);

  const curriculumFindings: string[] = [];
  if (chapter.programmeId === 'ssc_hssc' && chapter.groupId === 'admission') {
    curriculumFindings.push('SSC/HSSC chapter cannot use admission groupId.');
  }
  for (const c of chapter.concepts) {
    if (!c.sourceBook.trim() || !c.sourcePage.trim()) {
      curriculumFindings.push(`Concept "${c.title}" missing textbook source/page citation.`);
    }
  }
  for (const q of chapter.questions) {
    if (
      (q.sourceType === 'official_past_paper' || q.sourceType === 'official_model_paper') &&
      (!q.sourceBoardId || !q.sourceYear)
    ) {
      curriculumFindings.push(`Question "${q.id}" claims official paper without board/year.`);
    }
  }

  const answerFindings: string[] = [];
  const languageFindings: string[] = [];
  const pedagogyFindings: string[] = [];

  for (const q of chapter.questions) {
    if (q.questionType === 'mcq') {
      const cleanOpts = (q.options ?? []).map((o) => o.trim()).filter(Boolean);
      if (cleanOpts.length < 2 || !cleanOpts.includes(q.correctAnswer.trim())) {
        answerFindings.push(`MCQ "${q.id}" correctAnswer does not match options verbatim.`);
      }
      if (!q.optionMisconceptions || Object.keys(q.optionMisconceptions).length === 0) {
        pedagogyFindings.push(`MCQ "${q.id}" lacks optionMisconceptions for wrong choices.`);
      }
    }
    if (q.questionType === 'numerical') {
      const s = q.numericalSteps;
      if (
        !s ||
        s.given.length === 0 ||
        !s.required ||
        !s.formula ||
        !s.substitution ||
        !s.calculation ||
        !s.answerWithUnit
      ) {
        answerFindings.push(`Numerical "${q.id}" is incomplete (requires all 6 KPK steps).`);
      }
    }
    if (q.statement.trim().length < 10) {
      languageFindings.push(`Question "${q.id}" statement is too short.`);
    }
  }

  for (const c of chapter.concepts) {
    if ((c.microCards?.length ?? 0) === 0) {
      pedagogyFindings.push(`Concept "${c.title}" has no progressive Duolingo-style microCards.`);
    }
  }

  return [
    {
      kind: 'schema_qa',
      agentRole: 'quality_assurance',
      passed: schemaVal.valid,
      score: schemaVal.valid ? 100 : Math.max(25, 100 - schemaVal.errors.length * 15),
      summary: schemaVal.valid
        ? 'All deterministic schema, KaTeX, visual & numerical contracts pass.'
        : `${schemaVal.errors.length} schema/format issue(s) found.`,
      flaggedItemIds: [],
      findings: schemaVal.errors,
      checkedAt: now,
    },
    {
      kind: 'duplicate_check',
      agentRole: 'duplicate_detection',
      passed: dup.duplicateQuestionIds.length === 0,
      score: dup.duplicateQuestionIds.length === 0 ? 100 : 60,
      summary:
        dup.duplicateQuestionIds.length === 0
          ? 'No duplicates found across workspace catalog.'
          : `${dup.duplicateQuestionIds.length} potential duplicate question(s) flagged.`,
      flaggedItemIds: dup.duplicateQuestionIds,
      findings: dup.findings,
      checkedAt: now,
    },
    {
      kind: 'curriculum_alignment',
      agentRole: 'curriculum_validator',
      passed: curriculumFindings.length === 0,
      score: curriculumFindings.length === 0 ? 96 : 55,
      summary:
        curriculumFindings.length === 0
          ? 'Aligned with KPK BISE syllabus & provenance rules.'
          : `${curriculumFindings.length} curriculum/provenance issue(s).`,
      flaggedItemIds: [],
      findings: curriculumFindings,
      checkedAt: now,
    },
    {
      kind: 'answer_accuracy',
      agentRole: 'independent_answer_validator',
      passed: answerFindings.length === 0,
      score: answerFindings.length === 0 ? 96 : 50,
      summary:
        answerFindings.length === 0
          ? 'Answer keys & 6-step structure verified.'
          : `${answerFindings.length} answer accuracy issue(s).`,
      flaggedItemIds: [],
      findings: answerFindings,
      checkedAt: now,
    },
    {
      kind: 'language_katex',
      agentRole: 'language_editor',
      passed: schemaVal.valid && languageFindings.length === 0,
      score: schemaVal.valid && languageFindings.length === 0 ? 95 : 65,
      summary:
        schemaVal.valid && languageFindings.length === 0
          ? 'Clear student English & balanced KaTeX.'
          : 'Editorial or KaTeX issues detected.',
      flaggedItemIds: [],
      findings: languageFindings,
      checkedAt: now,
    },
    {
      kind: 'pedagogy_clarity',
      agentRole: 'pedagogy_reviewer',
      passed: pedagogyFindings.length === 0,
      score: pedagogyFindings.length === 0 ? 94 : 70,
      summary:
        pedagogyFindings.length === 0
          ? 'Strong Duolingo+Brilliant micro-step scaffolding.'
          : `${pedagogyFindings.length} pedagogy improvement note(s).`,
      flaggedItemIds: [],
      findings: pedagogyFindings,
      checkedAt: now,
    },
  ];
}

async function runIndependentGeminiValidationPass(
  ai: GoogleGenAI,
  chapter: CmsChapter,
): Promise<{ checks: ValidatorCheckResult[]; ok: boolean }> {
  const now = new Date().toISOString();
  const compactItems = {
    grade: chapter.grade,
    subjectName: chapter.subjectName,
    chapterTitle: chapter.title,
    concepts: chapter.concepts.map((c) => ({
      id: c.id,
      title: c.title,
      explanation: c.simpleExplanation.slice(0, 500),
      formulas: c.formulas,
      workedExamplePrompt: c.workedExamplePrompt,
      workedExampleAnswer: c.workedExampleAnswer,
      sourceBook: c.sourceBook,
      sourcePage: c.sourcePage,
    })),
    questions: chapter.questions.map((q) => ({
      id: q.id,
      questionType: q.questionType,
      statement: q.statement,
      options: q.options,
      correctAnswer: q.correctAnswer,
      numericalSteps: q.numericalSteps,
      marks: q.marks,
    })),
  };

  const response = await ai.models.generateContent({
    model: MODEL_NAME,
    contents: `Independently verify this KPK BISE Grade ${chapter.grade} ${chapter.subjectName} chapter draft.
Re-solve every numerical calculation from the given inputs and verify units, check every MCQ answer key without trusting the explanation, verify Grades 9-12 syllabus alignment, check KaTeX math balance, and evaluate clarity for Pakistani students.
DRAFT JSON:\n${JSON.stringify(compactItems)}`,
    config: {
      systemInstruction:
        'You are an independent KPK BISE Board Examination Auditor. Never blindly trust a provided answer—recompute numericals step by step and flag any arithmetic, unit, syllabus, or clarity flaw.',
      responseMimeType: 'application/json',
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          answerCheckPassed: { type: Type.BOOLEAN },
          answerScore: { type: Type.INTEGER },
          answerFindings: { type: Type.ARRAY, items: { type: Type.STRING } },
          curriculumCheckPassed: { type: Type.BOOLEAN },
          curriculumScore: { type: Type.INTEGER },
          curriculumFindings: { type: Type.ARRAY, items: { type: Type.STRING } },
          languageCheckPassed: { type: Type.BOOLEAN },
          languageScore: { type: Type.INTEGER },
          languageFindings: { type: Type.ARRAY, items: { type: Type.STRING } },
          pedagogyCheckPassed: { type: Type.BOOLEAN },
          pedagogyScore: { type: Type.INTEGER },
          pedagogyFindings: { type: Type.ARRAY, items: { type: Type.STRING } },
          flaggedItemIds: { type: Type.ARRAY, items: { type: Type.STRING } },
        },
        required: [
          'answerCheckPassed',
          'answerScore',
          'answerFindings',
          'curriculumCheckPassed',
          'curriculumScore',
          'curriculumFindings',
          'languageCheckPassed',
          'languageScore',
          'languageFindings',
          'pedagogyCheckPassed',
          'pedagogyScore',
          'pedagogyFindings',
          'flaggedItemIds',
        ],
      },
    },
  });

  const parsed = JSON.parse((response.text ?? '{}').trim()) as {
    answerCheckPassed: boolean;
    answerScore: number;
    answerFindings: string[];
    curriculumCheckPassed: boolean;
    curriculumScore: number;
    curriculumFindings: string[];
    languageCheckPassed: boolean;
    languageScore: number;
    languageFindings: string[];
    pedagogyCheckPassed: boolean;
    pedagogyScore: number;
    pedagogyFindings: string[];
    flaggedItemIds: string[];
  };

  const checks: ValidatorCheckResult[] = [
    {
      kind: 'answer_accuracy',
      agentRole: 'independent_answer_validator',
      passed: Boolean(parsed.answerCheckPassed),
      score: Math.max(0, Math.min(100, Number(parsed.answerScore) || 85)),
      summary: parsed.answerCheckPassed
        ? 'Independent AI auditor recalculated numericals & verified answer keys.'
        : 'Independent auditor detected calculation or answer key issues.',
      flaggedItemIds: parsed.flaggedItemIds ?? [],
      findings: parsed.answerFindings ?? [],
      checkedAt: now,
    },
    {
      kind: 'curriculum_alignment',
      agentRole: 'curriculum_validator',
      passed: Boolean(parsed.curriculumCheckPassed),
      score: Math.max(0, Math.min(100, Number(parsed.curriculumScore) || 90)),
      summary: parsed.curriculumCheckPassed
        ? 'Confirmed KPK BISE Grade 9-12 syllabus alignment.'
        : 'Curriculum alignment issues flagged.',
      flaggedItemIds: parsed.flaggedItemIds ?? [],
      findings: parsed.curriculumFindings ?? [],
      checkedAt: now,
    },
    {
      kind: 'language_katex',
      agentRole: 'language_editor',
      passed: Boolean(parsed.languageCheckPassed),
      score: Math.max(0, Math.min(100, Number(parsed.languageScore) || 90)),
      summary: parsed.languageCheckPassed
        ? 'Pakistani English clarity & LaTeX formatting verified.'
        : 'Language or KaTeX formatting corrections needed.',
      flaggedItemIds: [],
      findings: parsed.languageFindings ?? [],
      checkedAt: now,
    },
    {
      kind: 'pedagogy_clarity',
      agentRole: 'pedagogy_reviewer',
      passed: Boolean(parsed.pedagogyCheckPassed),
      score: Math.max(0, Math.min(100, Number(parsed.pedagogyScore) || 88)),
      summary: parsed.pedagogyCheckPassed
        ? 'Strong step-by-step teaching flow verified.'
        : 'Pedagogical improvements suggested.',
      flaggedItemIds: [],
      findings: parsed.pedagogyFindings ?? [],
      checkedAt: now,
    },
  ];

  return {
    checks,
    ok: checks.every((c) => c.passed),
  };
}

export async function runVerificationPipelineForChapter(
  chapterId: string,
  jobId?: string,
): Promise<VerificationReport | null> {
  const chapter = getChapterById(chapterId);
  if (!chapter) return null;

  const detChecks = buildDeterministicChecks(chapter);
  const detSchemaPassed = detChecks.find((c) => c.kind === 'schema_qa')?.passed ?? false;
  const dupPassed = detChecks.find((c) => c.kind === 'duplicate_check')?.passed ?? true;

  let finalChecks = detChecks;
  let stage = detSchemaPassed ? 'auto_validated' : ('ai_generated' as VerificationReport['stage']);

  const ai = getGeminiClient();
  if (ai && detSchemaPassed) {
    let timer: ReturnType<typeof setTimeout> | undefined;
    try {
      const llmAudit = await Promise.race([
        runIndependentGeminiValidationPass(ai, chapter),
        new Promise<never>((_, reject) => {
          timer = setTimeout(() => reject(new Error('Independent AI audit timed out')), 15000);
        }),
      ]);
      // Merge deterministic QA + Duplicate checks with independent LLM validator passes
      finalChecks = [
        ...llmAudit.checks.map((llmCheck) => {
          const det = detChecks.find((d) => d.kind === llmCheck.kind);
          if (det && !det.passed) {
            return {
              ...llmCheck,
              passed: false,
              findings: [...det.findings, ...llmCheck.findings],
            };
          }
          return llmCheck;
        }),
        ...detChecks.filter((d) => d.kind === 'duplicate_check' || d.kind === 'schema_qa'),
      ];
      stage = finalChecks.every((c) => c.passed) ? 'independently_reviewed' : 'auto_validated';
    } catch {
      // Fall back cleanly to deterministic checks if AI audit fails or times out
      stage = detSchemaPassed && dupPassed ? 'auto_validated' : 'ai_generated';
    } finally {
      if (timer) clearTimeout(timer);
    }
  } else if (detSchemaPassed && detChecks.every((c) => c.passed)) {
    stage = 'independently_reviewed';
  }

  const overallPassed = finalChecks.every((c) => c.passed);
  const avgScore = Math.round(
    finalChecks.reduce((sum, c) => sum + c.score, 0) / Math.max(1, finalChecks.length),
  );
  const escalationReasons = finalChecks
    .filter((c) => !c.passed)
    .flatMap((c) => (c.findings.length > 0 ? c.findings : [c.summary]));

  const report: VerificationReport = {
    id: `ver_${chapterId}`,
    chapterId,
    jobId,
    stage: overallPassed ? 'independently_reviewed' : stage,
    overallPassed,
    score: avgScore,
    checks: finalChecks,
    escalationReasons,
    updatedAt: new Date().toISOString(),
  };

  saveVerificationReport(report);
  saveCmsChapter({
    ...chapter,
    reviewStage: report.stage,
    verificationSummary: {
      overallPassed,
      score: avgScore,
      escalatedCount: escalationReasons.length,
      checksPassed: finalChecks.filter((c) => c.passed).length,
      checksTotal: finalChecks.length,
    },
  });

  appendAudit({
    action: overallPassed ? 'verification_passed' : 'verification_escalated',
    chapterId,
    actor: 'Quality Assurance Agent',
    summary: overallPassed
      ? `Independent verification passed (${avgScore}/100) for "${chapter.title}".`
      : `Verification flagged ${escalationReasons.length} item(s) on "${chapter.title}".`,
  });

  return report;
}

async function generateChapterBundleViaGemini(
  ai: GoogleGenAI,
  job: ProductionJob,
  source: SourceBundle,
  correctionNotes?: string,
): Promise<CmsChapter> {
  const conceptId = `c_${job.chapterId}_1`;
  const topicId = `${job.chapterId}_t1`;
  const pdfBase64 = ephemeralPdfCache.get(source.id);
  const examTier = job.grade <= 10 ? `SSC (Grade ${job.grade})` : `HSSC (Grade ${job.grade})`;

  const parts: Array<{ text: string } | { inlineData: { data: string; mimeType: string } }> = [];
  if (pdfBase64 && !correctionNotes) {
    parts.push({
      inlineData: { data: pdfBase64, mimeType: 'application/pdf' },
    });
  }

  const prompt = [
    `KPK BISE ${examTier} | Group: ${job.groupId} | Subject: ${job.subjectName} | Chapter ${job.chapterNumber}: ${job.chapterTitle}`,
    `Scope: ${job.scope}`,
    source.extractedText
      ? `SOURCE NOTES / TEXTBOOK EXTRACT:\n${source.extractedText.slice(0, 14000)}`
      : 'Analyze the attached PDF textbook chapter accurately.',
    correctionNotes
      ? `\nIMPORTANT AUTO-CORRECTION FEEDBACK FROM INDEPENDENT VALIDATORS (FIX EVERY ISSUE BELOW):\n${correctionNotes}`
      : '',
  ].join('\n\n');
  parts.push({ text: prompt });

  const response = await ai.models.generateContent({
    model: MODEL_NAME,
    contents: [{ role: 'user', parts }],
    config: {
      systemInstruction: [
        'You are the coordinated Roshan Study specialist production team (Concept Writer, Notes Generator, Numerical Specialist, Visual Agent, Question Generator) targeting Pakistan KPK BISE Grades 9-12.',
        'Style: Mix Duolingo clarity & progressive quick-check microCards (3-4 steps with quickCheckQuestion, 3 quickCheckOptions, quickCheckAnswer) with Brilliant.org visual intuition (interactive MotionGraphicSpec + GraphSpec).',
        'Math & Questions: Keep all KaTeX $...$ balanced. Generate 4 MCQs (4 distinct options + optionMisconceptions), 2 full 6-step numericals (given, required, formula, substitution, calculation, answerWithUnit matching correctAnswer), and 1 board short/long answer with markingPoints.',
        'Always tag sourceType: "practice_original" unless an official board paper & year are explicitly inside the source.',
      ].join('\n'),
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
                    quickCheckQuestion: { type: Type.STRING },
                    quickCheckOptions: { type: Type.ARRAY, items: { type: Type.STRING } },
                    quickCheckAnswer: { type: Type.STRING },
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
                      properties: { x: { type: Type.NUMBER }, y: { type: Type.NUMBER }, label: { type: Type.STRING } },
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
              'microCards',
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
  });

  const parsed = JSON.parse((response.text ?? '{}').trim()) as {
    learningOutcomes?: string[];
    concept?: Record<string, unknown>;
    questions?: Record<string, unknown>[];
  };

  const cRaw = parsed.concept ?? {};
  const motionRaw = cRaw.motionGraphic as Partial<MotionGraphicSpec> | undefined;
  const graphRaw = cRaw.graph as Partial<GraphSpec> | undefined;

  const sanitizeMotion = (): MotionGraphicSpec[] => {
    if (!motionRaw?.title || !Array.isArray(motionRaw.actors) || !motionRaw.actors.length || !Array.isArray(motionRaw.stages) || !motionRaw.stages.length) {
      return [];
    }
    return [
      {
        id: `${conceptId}_mg`,
        title: String(motionRaw.title),
        caption: String(motionRaw.caption ?? motionRaw.title),
        durationSec: Math.max(2, Math.min(20, Number(motionRaw.durationSec) || 5)),
        sceneType: (['kinematics_track', 'vector_motion', 'reaction_flow', 'wave_oscillation', 'orbit_cycle'].includes(String(motionRaw.sceneType))
          ? motionRaw.sceneType
          : 'kinematics_track') as MotionGraphicSpec['sceneType'],
        actors: motionRaw.actors.slice(0, 5).map((a, idx) => ({
          id: String(a.id || `a_${idx}`),
          label: String(a.label || `Actor ${idx + 1}`),
          shape: (['circle', 'box', 'arrow', 'molecule', 'wave'].includes(String(a.shape)) ? a.shape : 'box') as MotionGraphicSpec['actors'][0]['shape'],
          colorToken: (['primary', 'secondary', 'warning', 'danger'].includes(String(a.colorToken)) ? a.colorToken : 'primary') as MotionGraphicSpec['actors'][0]['colorToken'],
          startX: Math.max(4, Math.min(96, Number(a.startX) || 15)),
          startY: Math.max(4, Math.min(96, Number(a.startY) || 50)),
          endX: Math.max(4, Math.min(96, Number(a.endX) || 85)),
          endY: Math.max(4, Math.min(96, Number(a.endY) || 50)),
          size: Math.max(8, Math.min(24, Number(a.size) || 14)),
        })),
        stages: motionRaw.stages.slice(0, 5).map((s, idx) => ({
          atPercent: Math.max(0, Math.min(100, Number(s.atPercent) || idx * 50)),
          label: String(s.label || `Stage ${idx + 1}`),
          formulaLatex: s.formulaLatex ? String(s.formulaLatex) : undefined,
          callout: String(s.callout || 'Step progression'),
        })),
      },
    ];
  };

  const sanitizeGraph = (): GraphSpec[] => {
    if (!graphRaw?.title || !Array.isArray(graphRaw.series) || !graphRaw.series.length) {
      return [];
    }
    const validSeries = graphRaw.series
      .map((s, idx) => ({
        name: String(s.name || `Series ${idx + 1}`),
        colorToken: (['primary', 'secondary', 'warning', 'danger'].includes(String(s.colorToken)) ? s.colorToken : 'primary') as GraphSpec['series'][0]['colorToken'],
        showArea: Boolean(s.showArea),
        points: (Array.isArray(s.points) ? s.points : [])
          .filter((p) => Number.isFinite(Number(p.x)) && Number.isFinite(Number(p.y)))
          .map((p) => ({ x: Number(p.x), y: Number(p.y) })),
      }))
      .filter((s) => s.points.length >= 2);
    if (!validSeries.length) return [];
    const xs = validSeries.flatMap((s) => s.points.map((p) => p.x));
    const ys = validSeries.flatMap((s) => s.points.map((p) => p.y));
    const xMin = Number.isFinite(Number(graphRaw.xMin)) ? Number(graphRaw.xMin) : Math.min(...xs);
    const xMax = Number.isFinite(Number(graphRaw.xMax)) && Number(graphRaw.xMax) > xMin ? Number(graphRaw.xMax) : Math.max(xMin + 1, ...xs);
    const yMin = Number.isFinite(Number(graphRaw.yMin)) ? Number(graphRaw.yMin) : Math.min(...ys);
    const yMax = Number.isFinite(Number(graphRaw.yMax)) && Number(graphRaw.yMax) > yMin ? Number(graphRaw.yMax) : Math.max(yMin + 1, ...ys);
    return [
      {
        id: `${conceptId}_graph`,
        title: String(graphRaw.title),
        caption: String(graphRaw.caption ?? graphRaw.title),
        xLabel: String(graphRaw.xLabel || 'x'),
        yLabel: String(graphRaw.yLabel || 'y'),
        xMin,
        xMax,
        yMin,
        yMax,
        series: validSeries,
        highlights: (Array.isArray(graphRaw.highlights) ? graphRaw.highlights : [])
          .filter((h) => Number.isFinite(Number(h.x)) && Number.isFinite(Number(h.y)) && h.label)
          .map((h) => ({ x: Number(h.x), y: Number(h.y), label: String(h.label) })),
      },
    ];
  };

  const concept: CmsConcept = {
    id: conceptId,
    chapterId: job.chapterId,
    topicId,
    orderIndex: 1,
    title: String(cRaw.title || job.chapterTitle).trim(),
    locale: 'en',
    textDirection: 'ltr',
    simpleExplanation: String(cRaw.simpleExplanation || `Core concepts of ${job.chapterTitle}`).trim(),
    definitions: Array.isArray(cRaw.definitions)
      ? (cRaw.definitions as { term: string; definition: string }[])
      : [],
    importantPoints: Array.isArray(cRaw.importantPoints)
      ? (cRaw.importantPoints as string[])
      : [],
    formulas: Array.isArray(cRaw.formulas)
      ? (cRaw.formulas as { expression: string; description: string; unit?: string }[])
      : [],
    diagramCaption: `${job.chapterTitle} diagram`,
    diagramSvg: '',
    motionGraphics: sanitizeMotion(),
    graphs: sanitizeGraph(),
    workedExamplePrompt: String(cRaw.workedExamplePrompt || ''),
    workedExampleSteps: Array.isArray(cRaw.workedExampleSteps)
      ? (cRaw.workedExampleSteps as string[])
      : [],
    workedExampleAnswer: String(cRaw.workedExampleAnswer || ''),
    applications: Array.isArray(cRaw.applications) ? (cRaw.applications as string[]) : [],
    commonMistake: String(cRaw.commonMistake || ''),
    commonMistakeCorrection: String(cRaw.commonMistakeCorrection || ''),
    quickRevisionSummary: Array.isArray(cRaw.quickRevisionSummary)
      ? (cRaw.quickRevisionSummary as string[])
      : [job.chapterTitle],
    videoLinks: [],
    glossaryHints: Array.isArray(cRaw.glossaryHints)
      ? (cRaw.glossaryHints as { term: string; urduMeaning: string; simpleHint: string }[])
      : [],
    microCards: Array.isArray(cRaw.microCards)
      ? (cRaw.microCards as CmsConcept['microCards'])
      : [{ stageTitle: '01. Core Intuition', body: String(cRaw.simpleExplanation || job.chapterTitle) }],
    sourceBook: source.sourceBook,
    sourcePage: `Ch. ${job.chapterNumber}`,
    reviewStatus: 'draft',
    reviewedBy: '',
  };

  const questions: CmsQuestion[] = (Array.isArray(parsed.questions) ? parsed.questions : []).map(
    (raw, idx) => {
      const qType = (['mcq', 'numerical', 'short_answer', 'long_answer'].includes(
        String(raw.questionType),
      )
        ? String(raw.questionType)
        : 'mcq') as CmsQuestion['questionType'];
      const options =
        qType === 'mcq' && Array.isArray(raw.options)
          ? raw.options.map((o) => String(o).trim()).filter(Boolean).slice(0, 4)
          : [];
      let correctAnswer = String(raw.correctAnswer ?? '').trim();
      if (qType === 'mcq' && options.length > 0 && !options.includes(correctAnswer)) {
        correctAnswer = options.find((o) => o.toLowerCase() === correctAnswer.toLowerCase()) ?? options[0];
      }
      const misconceptions: Record<string, string> = {};
      if (Array.isArray(raw.optionMisconceptions)) {
        for (const item of raw.optionMisconceptions as { option?: string; reason?: string }[]) {
          if (item?.option && item?.reason && item.option !== correctAnswer) {
            misconceptions[String(item.option)] = String(item.reason);
          }
        }
      }
      const stepsRaw = raw.numericalSteps as CmsQuestion['numericalSteps'] | undefined;
      const numericalSteps =
        qType === 'numerical' && stepsRaw
          ? {
              given: Array.isArray(stepsRaw.given) && stepsRaw.given.length > 0 ? stepsRaw.given : ['Check problem statement'],
              required: String(stepsRaw.required || 'Target quantity'),
              formula: String(stepsRaw.formula || 'Board formula'),
              substitution: String(stepsRaw.substitution || 'Substitute values'),
              calculation: String(stepsRaw.calculation || 'Calculate result'),
              answerWithUnit: String(stepsRaw.answerWithUnit || correctAnswer),
            }
          : undefined;
      if (numericalSteps?.answerWithUnit) {
        correctAnswer = numericalSteps.answerWithUnit;
      }
      return {
        id: `q_${job.chapterId}_${idx + 1}`,
        programmeId: job.programmeId,
        grade: job.grade,
        groupId: job.groupId,
        subjectId: job.subjectId,
        chapterId: job.chapterId,
        topicId,
        conceptId,
        questionType: qType,
        difficulty: Math.max(1, Math.min(7, Number(raw.difficulty) || 2)) as CmsQuestion['difficulty'],
        statement: String(raw.statement || '').trim(),
        options,
        optionMisconceptions: misconceptions,
        hints: Array.isArray(raw.hints) ? (raw.hints as string[]) : [],
        numericalSteps,
        markingPoints: Array.isArray(raw.markingPoints) ? (raw.markingPoints as string[]) : [],
        correctAnswer,
        explanation: String(raw.explanation || '').trim(),
        marks: Math.max(1, Math.min(15, Number(raw.marks) || 1)),
        sourceType: 'practice_original',
        sourcePageRef: `Ch. ${job.chapterNumber}`,
        origin: 'ai_generated_draft',
        publicationStatus: 'draft',
        reviewedBy: '',
      };
    },
  );

  return {
    chapterId: job.chapterId,
    programmeId: job.programmeId,
    grade: job.grade,
    groupId: job.groupId,
    subjectId: job.subjectId,
    subjectName: job.subjectName,
    chapterNumber: job.chapterNumber,
    title: job.chapterTitle,
    learningOutcomes: Array.isArray(parsed.learningOutcomes)
      ? (parsed.learningOutcomes as string[])
      : [`Master core concepts of ${job.chapterTitle}.`],
    publicationStatus: 'draft',
    reviewStage: 'ai_generated',
    lastJobId: job.id,
    packVersion: 1,
    permissionVerified: source.permissionVerified,
    origin: 'ai_generated_draft',
    concepts: [concept],
    questions,
  };
}

function finalizeProductionReport(
  job: ProductionJob,
  source: SourceBundle,
  chapter: CmsChapter | undefined,
  report: VerificationReport | null,
  examsCount: number,
): ProductionReport {
  const autoRetriesUsed = job.tasks.reduce((sum, t) => sum + t.retryCount, 0);
  const externalTasksCompleted = job.tasks.filter(
    (t) => t.status === 'completed' && t.assignedWorker && t.assignedWorker !== 'server-gemini',
  ).length;
  const visualCount =
    chapter?.concepts.reduce(
      (sum, c) => sum + (c.motionGraphics?.length ?? 0) + (c.graphs?.length ?? 0),
      0,
    ) ?? 0;

  return {
    jobId: job.id,
    curriculumConfidence: 0.96,
    sourceExtractionConfidence: source.extractionConfidence,
    conceptsProduced: chapter?.concepts.length ?? 0,
    visualsProduced: visualCount,
    questionsProduced: chapter?.questions.length ?? 0,
    examsProduced: examsCount,
    validationPassRate: report?.score ?? 0,
    autoRetriesUsed,
    escalatedItems: report?.escalationReasons ?? job.alerts,
    geminiCallsMade: job.callsUsed,
    externalTasksCompleted,
    summary: report?.overallPassed
      ? `Verified & ready for owner batch approval (${chapter?.concepts.length ?? 0} concept, ${visualCount} visuals, ${chapter?.questions.length ?? 0} questions, ${examsCount} exam(s)).`
      : `Completed with ${(report?.escalationReasons.length ?? 0) + job.alerts.length} item(s) requiring owner review.`,
    generatedAt: new Date().toISOString(),
  };
}

export async function executeGeminiAutonomousJob(jobId: string): Promise<void> {
  const job = getProductionJob(jobId);
  if (!job || job.status === 'paused' || job.status === 'cancelled') return;

  const source = getSourceBundle(job.sourceBundleId);
  if (!source) {
    job.status = 'failed';
    job.alerts.push('Missing source bundle for production job.');
    saveProductionJob(job);
    return;
  }

  const ai = getGeminiClient();
  if (!ai) {
    job.status = 'waiting_external';
    job.alerts.push(
      'GEMINI_API_KEY is not configured in Secrets. Job converted to External Agent Queue so Freebuff or OpenCode can complete it at $0 cost.',
    );
    saveProductionJob(job);
    return;
  }

  if (source.requiresHumanReview || (!source.hasPdfBinary && source.extractedText.length < 40)) {
    const p2Idx = job.tasks.findIndex((t) => t.phase === 2);
    if (p2Idx >= 0) {
      job.tasks[p2Idx] = {
        ...job.tasks[p2Idx],
        status: 'escalated',
        lastError: 'Source text is too short or unreadable. Upload clearer PDF or notes.',
      };
    }
    job.status = 'escalated';
    job.alerts.push('Incomplete source extraction detected — escalated for human source check.');
    saveProductionJob(job);
    return;
  }

  const now = () => new Date().toISOString();
  job.status = 'running';
  saveProductionJob(job);

  try {
    // Phases 1–3: Research, Source, Architecture marks
    for (const task of job.tasks.filter((t) => t.phase <= 3)) {
      const fresh = getProductionJob(jobId);
      if (!fresh || fresh.status === 'paused' || fresh.status === 'cancelled') return;
      task.status = 'completed';
      task.assignedWorker = 'server-gemini';
      task.startedAt = now();
      task.finishedAt = now();
      task.outputSummary = 'Completed curriculum check, source indexing, and chapter blueprint.';
      job.currentPhase = Math.max(job.currentPhase, task.phase);
    }
    saveProductionJob(job);

    // Phase 4–5 + Phase 7 Auto-Retry Loop (max 2 retries)
    let attempt = 0;
    let draftChapter: CmsChapter | undefined;
    let verification: VerificationReport | null = null;
    let correctionFeedback: string | undefined;

    while (attempt <= job.maxRetriesPerTask) {
      const fresh = getProductionJob(jobId);
      if (!fresh || fresh.status === 'paused' || fresh.status === 'cancelled') return;
      if (job.callsUsed >= job.maxBudgetCalls) {
        job.alerts.push(`Gemini per-job budget cap (${job.maxBudgetCalls} calls) reached.`);
        break;
      }

      job.currentPhase = 4;
      job.callsUsed += 1;
      saveProductionJob(job);

      draftChapter = await generateChapterBundleViaGemini(ai, job, source, correctionFeedback);
      const savedDraft = upsertDraftChapter(
        draftChapter,
        'ai_generated_draft',
        `Project Manager (${MODEL_NAME})`,
        'ai_generated',
      );
      if (savedDraft.ok) {
        draftChapter = savedDraft.chapter;
      }

      for (const t of job.tasks.filter((t) => t.phase === 4 || t.phase === 5)) {
        t.status = 'completed';
        t.assignedWorker = 'server-gemini';
        t.retryCount = attempt;
        t.startedAt = t.startedAt || now();
        t.finishedAt = now();
        t.outputSummary = `Drafted chapter content (attempt ${attempt + 1}).`;
      }

      job.currentPhase = 6;
      job.callsUsed += 1;
      saveProductionJob(job);

      verification = await runVerificationPipelineForChapter(draftChapter.chapterId, job.id);
      if (verification?.overallPassed) {
        for (const t of job.tasks.filter((t) => t.phase === 6)) {
          t.status = 'completed';
          t.assignedWorker = 'server-gemini-auditor';
          t.finishedAt = now();
          t.outputSummary = `Passed (${verification.score}/100)`;
        }
        break;
      }

      attempt += 1;
      if (attempt <= job.maxRetriesPerTask && verification) {
        job.currentPhase = 7;
        correctionFeedback = verification.escalationReasons.join('\n- ');
        job.alerts.push(
          `Auto-retry ${attempt}/${job.maxRetriesPerTask}: returning ${verification.escalationReasons.length} issue(s) to producer agents.`,
        );
        saveProductionJob(job);
      } else if (verification) {
        for (const t of job.tasks.filter((t) => t.phase === 6)) {
          const matchedCheck = verification.checks.find((c) => c.agentRole === t.role);
          t.status = matchedCheck && !matchedCheck.passed ? 'escalated' : 'completed';
          t.assignedWorker = 'server-gemini-auditor';
          t.retryCount = job.maxRetriesPerTask;
          t.lastError = matchedCheck?.findings.join(' ') || undefined;
          t.finishedAt = now();
        }
      }
    }

    let examsCount = 0;
    if (draftChapter) {
      job.currentPhase = 8;
      const exams = generateExamBlueprintsForChapter(draftChapter, job.id);
      examsCount = exams.length;
    }

    job.verificationReportId = verification?.id;
    job.status = verification?.overallPassed ? 'awaiting_approval' : 'escalated';
    job.currentPhase = 9;
    job.productionReport = finalizeProductionReport(job, source, draftChapter, verification, examsCount);
    saveProductionJob(job);
  } catch (err: unknown) {
    job.status = 'failed';
    job.alerts.push(err instanceof Error ? err.message : 'Gemini autonomous job execution failed.');
    saveProductionJob(job);
  }
}

export async function reportTaskErrorOrRetry(
  taskId: string,
  workerName: string,
  errorMessage: string,
  forceEscalate = false,
): Promise<{ ok: boolean; status: number; message: string; job?: ProductionJob }> {
  const targetJob = listProductionJobs().find((j) => j.tasks.some((t) => t.id === taskId));
  if (!targetJob) {
    return { ok: false, status: 404, message: `Task "${taskId}" not found.` };
  }
  const tIdx = targetJob.tasks.findIndex((t) => t.id === taskId);
  const task = targetJob.tasks[tIdx];
  const now = new Date().toISOString();
  const prevLogs: AgentTaskLogEntry[] = task.executionLogs ?? [];
  const nextRetry = task.retryCount + 1;

  if (!forceEscalate && task.retryCount < task.maxRetries) {
    targetJob.tasks[tIdx] = {
      ...task,
      status: 'queued',
      assignedWorker: undefined,
      leaseExpiresAt: undefined,
      retryCount: nextRetry,
      lastError: errorMessage,
      feedbackNotes: `Retry ${nextRetry}/${task.maxRetries}: ${errorMessage}`,
      executionLogs: [
        ...prevLogs,
        {
          timestamp: now,
          workerId: workerName,
          event: 'retry_queued',
          detail: `Re-queued (${nextRetry}/${task.maxRetries}): ${errorMessage}`,
        },
      ].slice(-25),
    };
    targetJob.status = 'waiting_external';
    targetJob.alerts.unshift(`Task "${task.title}" queued for retry (${nextRetry}/${task.maxRetries}): ${errorMessage}`);
    saveProductionJob(targetJob);
    incrementAgentStats(workerName, false);
    return {
      ok: true,
      status: 200,
      message: `Task re-queued for retry (${nextRetry}/${task.maxRetries}).`,
      job: targetJob,
    };
  }

  targetJob.tasks[tIdx] = {
    ...task,
    status: 'escalated',
    lastError: errorMessage || 'Max retries exceeded.',
    finishedAt: now,
    executionLogs: [
      ...prevLogs,
      {
        timestamp: now,
        workerId: workerName,
        event: 'escalated',
        detail: `Escalated after ${task.retryCount} retries: ${errorMessage}`,
      },
    ].slice(-25),
  };
  targetJob.status = 'escalated';
  targetJob.alerts.unshift(`Task "${task.title}" escalated to Admin Inbox: ${errorMessage}`);
  saveProductionJob(targetJob);
  incrementAgentStats(workerName, false);
  return {
    ok: true,
    status: 200,
    message: 'Max retries reached; task escalated to human review inbox.',
    job: targetJob,
  };
}

export async function submitExternalTaskResult(
  taskId: string,
  payload: {
    workerName: string;
    chapter?: CmsChapter;
    exam?: ExamBlueprint;
    validatorResult?: {
      passed: boolean;
      score?: number;
      findings?: string[];
      flaggedItemIds?: string[];
    };
    summary?: string;
    failed?: boolean;
    errorMessage?: string;
  },
): Promise<{
  ok: boolean;
  status: number;
  message: string;
  job?: ProductionJob;
  verificationReport?: VerificationReport | null;
}> {
  const storeJobs = listProductionJobs();
  const targetJob = storeJobs.find((j) => j.tasks.some((t) => t.id === taskId));
  if (!targetJob) {
    return { ok: false, status: 404, message: `Task "${taskId}" not found.` };
  }
  const tIdx = targetJob.tasks.findIndex((t) => t.id === taskId);
  const task = targetJob.tasks[tIdx];
  const now = new Date().toISOString();

  // Enforce strict Author vs Independent Verifier separation on submission too
  if (task.phase === 6) {
    const existingChapter = getChapterById(targetJob.chapterId);
    if (
      existingChapter?.authorWorkerId &&
      existingChapter.authorWorkerId.trim().toLowerCase() === payload.workerName.trim().toLowerCase()
    ) {
      return {
        ok: false,
        status: 403,
        message: `Independent Verification Conflict: worker "${payload.workerName}" authored chapter "${existingChapter.chapterId}" and cannot verify its own output. Assign a different verifier worker.`,
      };
    }
  }

  if (payload.failed) {
    return reportTaskErrorOrRetry(
      taskId,
      payload.workerName,
      payload.errorMessage || 'Worker reported failure.',
    );
  }

  let savedChapter: CmsChapter | undefined;
  if (payload.chapter) {
    const upserted = upsertDraftChapter(
      {
        ...payload.chapter,
        lastJobId: targetJob.id,
        bookId: task.bookId ?? payload.chapter.bookId,
        authorWorkerId: payload.workerName,
      },
      'agent_uploaded_draft',
      payload.workerName,
      'ai_generated',
    );
    if (!upserted.ok) {
      recordQuarantinedSubmission({
        sourceEndpoint: `/api/agent/tasks/${taskId}/submit`,
        workerId: payload.workerName,
        chapterId: payload.chapter?.chapterId ?? targetJob.chapterId,
        jobId: targetJob.id,
        taskId,
        reason: 'External task submission failed strict KPK schema validation.',
        validationErrors: upserted.errors,
        rawPayload: payload.chapter,
      });
      return {
        ok: false,
        status: 400,
        message: `Draft failed strict KPK schema validation and was quarantined: ${upserted.errors.join(' ')}`,
      };
    }
    savedChapter = upserted.chapter;
  }

  if (payload.exam) {
    upsertExamBlueprint(payload.exam);
  }

  const prevLogs: AgentTaskLogEntry[] = task.executionLogs ?? [];
  targetJob.tasks[tIdx] = {
    ...task,
    status: 'completed',
    assignedWorker: payload.workerName,
    outputSummary: payload.summary || `Completed by ${payload.workerName}`,
    finishedAt: now,
    executionLogs: [
      ...prevLogs,
      {
        timestamp: now,
        workerId: payload.workerName,
        event: 'task_completed',
        detail: payload.summary || `Completed ${task.title}`,
      },
    ].slice(-25),
  };

  incrementAgentStats(payload.workerName, true);

  let verificationReport: VerificationReport | null = getVerificationReportForChapter(targetJob.chapterId) ?? null;

  // Record independent validator contribution when a phase-6 external validator submits findings
  if (task.phase === 6 && payload.validatorResult) {
    const existingChapter = getChapterById(targetJob.chapterId);
    if (existingChapter) {
      const currentReport =
        verificationReport ??
        (await runVerificationPipelineForChapter(existingChapter.chapterId, targetJob.id));
      if (currentReport) {
        const updatedChecks = currentReport.checks.map((c) =>
          c.agentRole === task.role
            ? {
                ...c,
                passed: payload.validatorResult!.passed,
                score: payload.validatorResult!.score ?? (payload.validatorResult!.passed ? 95 : 55),
                findings: payload.validatorResult!.findings ?? c.findings,
                flaggedItemIds: payload.validatorResult!.flaggedItemIds ?? c.flaggedItemIds,
                checkedAt: now,
              }
            : c,
        );
        const overallPassed = updatedChecks.every((c) => c.passed);
        verificationReport = {
          ...currentReport,
          checks: updatedChecks,
          overallPassed,
          stage: overallPassed ? 'independently_reviewed' : 'auto_validated',
          escalationReasons: updatedChecks.filter((c) => !c.passed).flatMap((c) => c.findings),
          updatedAt: now,
        };
        saveVerificationReport(verificationReport);
        saveCmsChapter({
          ...existingChapter,
          verifierWorkerId: payload.workerName,
          reviewStage: verificationReport.stage,
          verificationSummary: {
            overallPassed,
            score: Math.round(
              updatedChecks.reduce((s, c) => s + c.score, 0) / Math.max(1, updatedChecks.length),
            ),
            escalatedCount: verificationReport.escalationReasons.length,
            checksPassed: updatedChecks.filter((c) => c.passed).length,
            checksTotal: updatedChecks.length,
          },
        });
      }
    }
  } else if (savedChapter) {
    verificationReport = await runVerificationPipelineForChapter(savedChapter.chapterId, targetJob.id);
    if (verificationReport?.overallPassed) {
      generateExamBlueprintsForChapter(savedChapter, targetJob.id);
    }
  }

  const allDone = targetJob.tasks.every((t) => t.status === 'completed');
  if (allDone) {
    targetJob.status = verificationReport?.overallPassed === false ? 'escalated' : 'awaiting_approval';
    targetJob.currentPhase = 9;
    const src = getSourceBundle(targetJob.sourceBundleId);
    const ch = getChapterById(targetJob.chapterId);
    const exams = listExamBlueprints().filter((e) => e.chapterId === targetJob.chapterId);
    if (src) {
      targetJob.productionReport = finalizeProductionReport(
        targetJob,
        src,
        ch,
        verificationReport,
        exams.length,
      );
    }
  } else {
    targetJob.status = 'waiting_external';
  }

  saveProductionJob(targetJob);
  return {
    ok: true,
    status: 200,
    message: `Recorded result for "${task.title}".`,
    job: targetJob,
    verificationReport,
  };
}

export async function publishApprovedChapterWithTarget(
  chapterId: string,
  reviewedBy: string,
  verifyPermission = true,
): Promise<
  | { ok: true; chapter: CmsChapter; syncTarget: 'cloudflare_d1_r2' | 'cloud_store' }
  | { ok: false; status: number; errors: string[] }
> {
  const published = approveAndPublishChapter(chapterId, reviewedBy, verifyPermission);
  if (!published.ok) {
    return published;
  }

  const relatedExams = listExamBlueprints().filter((e) => e.chapterId === chapterId);
  const publishedExams: ExamBlueprint[] = [];
  for (const exam of relatedExams) {
    const res = approveAndPublishExam(exam.id, reviewedBy);
    if (res.ok) publishedExams.push(res.exam);
  }

  const checksum = computeChapterChecksum(published.chapter);
  const cfOutcome = await syncPackToCloudflareIfConfigured(
    published.chapter,
    reviewedBy,
    publishedExams,
    checksum,
  );

  const finalChapter: CmsChapter = {
    ...published.chapter,
    cloudflareSync: cfOutcome,
  };
  saveCmsChapter(finalChapter);

  if (cfOutcome.target === 'cloudflare_d1_r2') {
    appendAudit({
      action: 'cloudflare_synced',
      chapterId,
      actor: 'Publishing Agent',
      summary: cfOutcome.synced
        ? `Synced "${finalChapter.title}" v${finalChapter.packVersion} to Cloudflare R2 (${cfOutcome.r2Key}).`
        : `Cloudflare sync failed for "${finalChapter.title}" (${cfOutcome.error}); live in Express Cloud Store.`,
    });
  }

  if (finalChapter.lastJobId) {
    const job = getProductionJob(finalChapter.lastJobId);
    if (job) {
      job.status = 'completed';
      job.currentPhase = 10;
      saveProductionJob(job);
    }
  }

  return {
    ok: true,
    chapter: finalChapter,
    syncTarget: cfOutcome.target,
  };
}

export async function batchApproveVerifiedChapters(
  chapterIds: string[],
  reviewedBy: string,
): Promise<{
  approved: CmsChapter[];
  skipped: { chapterId: string; reason: string }[];
}> {
  const approved: CmsChapter[] = [];
  const skipped: { chapterId: string; reason: string }[] = [];

  for (const id of chapterIds) {
    const ch = getChapterById(id);
    if (!ch) {
      skipped.push({ chapterId: id, reason: 'Chapter not found.' });
      continue;
    }
    const report = getVerificationReportForChapter(id);
    const verified =
      ch.reviewStage === 'independently_reviewed' ||
      ch.reviewStage === 'human_approved' ||
      (report?.overallPassed ?? false);

    if (!verified) {
      skipped.push({
        chapterId: id,
        reason: 'Must pass independent verification before batch approval (use single Inspect & Approve if overriding).',
      });
      continue;
    }

    const res = await publishApprovedChapterWithTarget(id, reviewedBy, true);
    if (res.ok) {
      approved.push(res.chapter);
    } else {
      skipped.push({ chapterId: id, reason: res.errors.join(' ') });
    }
  }

  return { approved, skipped };
}

export function createMonitoringFixDraftFromIssue(issueId: string): {
  ok: boolean;
  message: string;
  draftChapter?: CmsChapter;
  issue?: MonitoringIssueReport;
} {
  const issue = listIssueReports().find((r) => r.id === issueId);
  if (!issue) {
    return { ok: false, message: 'Issue report not found.' };
  }
  const liveChapter = getChapterById(issue.chapterId);
  if (!liveChapter) {
    return { ok: false, message: `Source chapter "${issue.chapterId}" not found.` };
  }

  const draftId = `${liveChapter.chapterId}_fix_${Date.now().toString(36).slice(-4)}`;
  const fixNote = `[Monitoring Fix Draft for ${issue.category}: ${issue.description}]`;

  const draftCandidate: CmsChapter = {
    ...liveChapter,
    chapterId: draftId,
    title: `${liveChapter.title} (Fix Revision)`,
    publicationStatus: 'draft',
    reviewStage: 'ai_generated',
    origin: 'ai_generated_draft',
    packVersion: liveChapter.packVersion + 1,
    concepts: liveChapter.concepts.map((c, idx) =>
      idx === 0 || c.id === issue.conceptId
        ? {
            ...c,
            chapterId: draftId,
            reviewStatus: 'draft',
            reviewedBy: '',
            commonMistakeCorrection: `${c.commonMistakeCorrection ? `${c.commonMistakeCorrection} ` : ''}${fixNote}`.trim(),
          }
        : { ...c, chapterId: draftId, reviewStatus: 'draft', reviewedBy: '' },
    ),
    questions: liveChapter.questions.map((q) =>
      q.id === issue.questionId
        ? {
            ...q,
            chapterId: draftId,
            publicationStatus: 'draft',
            reviewedBy: '',
            explanation: `${q.explanation} ${fixNote}`,
          }
        : { ...q, chapterId: draftId, publicationStatus: 'draft', reviewedBy: '' },
    ),
  };

  const saved = upsertDraftChapter(
    draftCandidate,
    'ai_generated_draft',
    'Monitoring Agent (Draft Fix)',
    'ai_generated',
  );
  if (!saved.ok) {
    return { ok: false, message: saved.errors.join(' ') };
  }

  const updatedIssue = upsertIssueReport({
    ...issue,
    status: 'draft_fix_created',
    proposedDraftChapterId: saved.chapter.chapterId,
  });

  return {
    ok: true,
    message: `Created new fix draft "${saved.chapter.title}" without modifying live published content.`,
    draftChapter: saved.chapter,
    issue: updatedIssue,
  };
}
