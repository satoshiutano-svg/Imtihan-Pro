import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import type {
  AcademicGroupId,
  AdminOverviewMetrics,
  AgentRoleId,
  AgentTask,
  AgentTaskLogEntry,
  BookDocument,
  CatalogChapterSummary,
  ChapterAdConfig,
  CmsChapter,
  CmsConcept,
  CmsQuestion,
  ExamBlueprint,
  ExamScoreRequest,
  ExamScoreResponse,
  GradedExamItem,
  GraphSpec,
  MonitoringIssueReport,
  MotionGraphicSpec,
  ProductionJob,
  ProgrammeId,
  PublicationStatus,
  PublishHistoryEntry,
  QuarantinedSubmission,
  QuestionOrigin,
  RegisteredAgent,
  ReviewStage,
  SourceBundle,
  VerificationReport,
  WeakTopicInsight,
  WorkspaceSecuritySettings,
} from '../src/types/cms.ts';
import { INITIAL_CMS_CHAPTERS } from '../src/data/cmsSeed.ts';
import { isAnswerMatch } from '../src/utils/answerMatch.ts';

export interface CloudAuditEntry {
  id: string;
  action:
    | 'draft_uploaded'
    | 'approved_published'
    | 'component_approved'
    | 'structure_proposed'
    | 'structure_approved'
    | 'structure_rejected'
    | 'submission_quarantined'
    | 'updated'
    | 'deleted'
    | 'token_rotated'
    | 'token_revoked'
    | 'job_started'
    | 'verification_passed'
    | 'verification_escalated'
    | 'cloudflare_synced'
    | 'issue_reported'
    | 'book_uploaded'
    | 'revision_requested'
    | 'rejected'
    | 'rolled_back'
    | 'agent_registered'
    | 'security_updated';
  chapterId?: string;
  actor: string;
  timestamp: string;
  summary: string;
}

interface StoredIdempotencyRecord {
  key: string;
  endpoint: string;
  timestamp: string;
  status: number;
  body: Record<string, unknown>;
}

interface CloudStoreDisk {
  version: number;
  agentAccessToken: string;
  verifierAccessToken: string;
  agentTokenRevoked: boolean;
  verifierTokenRevoked: boolean;
  securitySettings: WorkspaceSecuritySettings;
  chapters: CmsChapter[];
  books: BookDocument[];
  registeredAgents: RegisteredAgent[];
  publishHistory: PublishHistoryEntry[];
  sourceBundles: SourceBundle[];
  productionJobs: ProductionJob[];
  verificationReports: VerificationReport[];
  examBlueprints: ExamBlueprint[];
  issueReports: MonitoringIssueReport[];
  quarantinedSubmissions: QuarantinedSubmission[];
  processedIdempotencyKeys: StoredIdempotencyRecord[];
  examSubmissions: ExamScoreResponse[];
  auditLog: CloudAuditEntry[];
}

export interface ValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
}

export interface CatalogQuery {
  programme?: string;
  grade?: number;
  groupId?: string;
  subjectId?: string;
  q?: string;
  page?: number;
  limit?: number;
}

const STORE_FILE = path.resolve(process.cwd(), '.roshan_cloud_store.json');

const VALID_PROGRAMMES = new Set<ProgrammeId>(['ssc_hssc', 'mdcat', 'etea_eng', 'uni_entrance']);
const VALID_GROUPS = new Set<AcademicGroupId | 'admission'>([
  'ssc_science',
  'ssc_humanities',
  'hssc_pre_medical',
  'hssc_pre_engineering',
  'hssc_cs',
  'admission',
]);
const VALID_COLORS = new Set(['primary', 'secondary', 'warning', 'danger']);
const VALID_ACTOR_SHAPES = new Set(['circle', 'box', 'arrow', 'molecule', 'wave']);
const VALID_SCENE_TYPES = new Set([
  'kinematics_track',
  'vector_motion',
  'reaction_flow',
  'wave_oscillation',
  'orbit_cycle',
]);

export function defaultAdConfig(): ChapterAdConfig {
  return {
    placement: 'respectful_default',
    showCatalogBanner: true,
    showPostSessionInterstitial: true,
    suppressDuringReadingAndExam: true,
  };
}

function generateSecureToken(prefix = 'rsh_agent'): string {
  return `${prefix}_${crypto.randomBytes(24).toString('hex')}`;
}

function defaultSecuritySettings(): WorkspaceSecuritySettings {
  return {
    allowOptionalPaidServerAi: false,
    rateLimitPerMinute: 120,
  };
}

export function computeChapterChecksum(chapter: CmsChapter): string {
  const canonical = JSON.stringify({
    chapterId: chapter.chapterId,
    packVersion: chapter.packVersion,
    title: chapter.title,
    concepts: chapter.concepts,
    questions: chapter.questions,
  });
  return crypto.createHash('sha256').update(canonical).digest('hex');
}

export function sanitizeUntrustedText(text: string): string {
  if (!text) return '';
  return text
    .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, '')
    .replace(/<\/?(script|iframe|object|embed|style|link|meta|base|form)\b[^>]*>/gi, '')
    .replace(/\bon[a-z]+\s*=\s*(?:"[^"]*"|'[^']*'|[^\s>]+)/gi, '')
    .replace(/javascript\s*:/gi, '')
    .trim();
}

function hasBalancedLatex(text: string): boolean {
  if (!text) return true;
  // Ignore escaped \$ when counting delimiters
  const stripped = text.replace(/\\\$/g, '');
  let i = 0;
  let inBlock = false;
  let inInline = false;
  while (i < stripped.length) {
    if (stripped[i] === '$' && stripped[i + 1] === '$') {
      if (!inInline) {
        inBlock = !inBlock;
      }
      i += 2;
      continue;
    }
    if (stripped[i] === '$') {
      if (!inBlock) {
        inInline = !inInline;
      }
    }
    i += 1;
  }
  return !inBlock && !inInline;
}

function validateMotionGraphic(mg: MotionGraphicSpec, prefix: string, errors: string[]): void {
  if (!mg.id || !mg.title?.trim()) {
    errors.push(`${prefix}: Motion graphic requires non-empty id and title.`);
  }
  if (!VALID_SCENE_TYPES.has(mg.sceneType)) {
    errors.push(`${prefix}: Unsupported sceneType "${String(mg.sceneType)}".`);
  }
  if (!Number.isFinite(mg.durationSec) || mg.durationSec <= 0 || mg.durationSec > 60) {
    errors.push(`${prefix}: durationSec must be between 0.5 and 60.`);
  }
  if (!Array.isArray(mg.actors) || mg.actors.length === 0) {
    errors.push(`${prefix}: Motion graphic needs at least 1 actor.`);
  } else {
    mg.actors.forEach((actor, idx) => {
      if (!actor.id || !actor.label?.trim()) {
        errors.push(`${prefix} actor[${idx}]: id and label are required.`);
      }
      if (!VALID_ACTOR_SHAPES.has(actor.shape)) {
        errors.push(`${prefix} actor[${idx}]: invalid shape "${String(actor.shape)}".`);
      }
      if (!VALID_COLORS.has(actor.colorToken)) {
        errors.push(`${prefix} actor[${idx}]: invalid colorToken "${String(actor.colorToken)}".`);
      }
      const coords = [actor.startX, actor.startY, actor.endX, actor.endY];
      if (coords.some((n) => !Number.isFinite(n) || n < 0 || n > 100)) {
        errors.push(`${prefix} actor[${idx}]: coordinates must be finite numbers between 0 and 100.`);
      }
    });
  }
  if (!Array.isArray(mg.stages) || mg.stages.length === 0) {
    errors.push(`${prefix}: Motion graphic needs at least 1 stage.`);
  } else {
    mg.stages.forEach((stage, idx) => {
      if (!Number.isFinite(stage.atPercent) || stage.atPercent < 0 || stage.atPercent > 100) {
        errors.push(`${prefix} stage[${idx}]: atPercent must be between 0 and 100.`);
      }
      if (!stage.label?.trim() || !stage.callout?.trim()) {
        errors.push(`${prefix} stage[${idx}]: label and callout are required.`);
      }
      if (stage.formulaLatex && !hasBalancedLatex(stage.formulaLatex)) {
        errors.push(`${prefix} stage[${idx}]: unbalanced $ delimiters in formulaLatex.`);
      }
    });
  }
}

function validateGraph(graph: GraphSpec, prefix: string, errors: string[]): void {
  if (!graph.id || !graph.title?.trim()) {
    errors.push(`${prefix}: Graph requires non-empty id and title.`);
  }
  if (!graph.xLabel?.trim() || !graph.yLabel?.trim()) {
    errors.push(`${prefix}: xLabel and yLabel are required.`);
  }
  if (!Number.isFinite(graph.xMin) || !Number.isFinite(graph.xMax) || graph.xMax <= graph.xMin) {
    errors.push(`${prefix}: xMax must be strictly greater than xMin.`);
  }
  if (!Number.isFinite(graph.yMin) || !Number.isFinite(graph.yMax) || graph.yMax <= graph.yMin) {
    errors.push(`${prefix}: yMax must be strictly greater than yMin.`);
  }
  if (!Array.isArray(graph.series) || graph.series.length === 0) {
    errors.push(`${prefix}: Graph must contain at least 1 data series.`);
  } else {
    graph.series.forEach((series, idx) => {
      if (!series.name?.trim()) {
        errors.push(`${prefix} series[${idx}]: series name is required.`);
      }
      if (!VALID_COLORS.has(series.colorToken)) {
        errors.push(`${prefix} series[${idx}]: invalid colorToken "${String(series.colorToken)}".`);
      }
      if (!Array.isArray(series.points) || series.points.length < 2) {
        errors.push(`${prefix} series[${idx}]: at least 2 (x, y) points are required.`);
      } else if (series.points.some((p) => !Number.isFinite(p.x) || !Number.isFinite(p.y))) {
        errors.push(`${prefix} series[${idx}]: all points must have finite numeric x and y.`);
      }
    });
  }
  if (Array.isArray(graph.highlights)) {
    graph.highlights.forEach((hl, idx) => {
      if (!Number.isFinite(hl.x) || !Number.isFinite(hl.y) || !hl.label?.trim()) {
        errors.push(`${prefix} highlight[${idx}]: finite x, y, and non-empty label are required.`);
      }
    });
  }
}

export function validateChapterForCloud(
  rawChapter: unknown,
  mode: 'draft' | 'publish' = 'draft',
): ValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  if (!rawChapter || typeof rawChapter !== 'object') {
    return { valid: false, errors: ['Chapter payload must be a JSON object.'], warnings };
  }

  const ch = rawChapter as Partial<CmsChapter>;

  if (!ch.chapterId?.trim()) errors.push('chapterId is required.');
  if (!ch.programmeId || !VALID_PROGRAMMES.has(ch.programmeId)) {
    errors.push('programmeId must be one of ssc_hssc, mdcat, etea_eng, uni_entrance.');
  }
  if (typeof ch.grade !== 'number' || ch.grade < 9 || ch.grade > 12) {
    errors.push('grade must be 9, 10, 11, or 12.');
  }
  if (!ch.groupId || !VALID_GROUPS.has(ch.groupId)) {
    errors.push('groupId is invalid.');
  }
  if (ch.programmeId === 'ssc_hssc' && ch.groupId === 'admission') {
    errors.push('SSC/HSSC board chapters cannot use admission groupId (track isolation rule).');
  }
  if (!ch.subjectId?.trim() || !ch.subjectName?.trim()) {
    errors.push('subjectId and subjectName are required.');
  }
  if (typeof ch.chapterNumber !== 'number' || ch.chapterNumber < 1) {
    errors.push('chapterNumber must be >= 1.');
  }
  if (!ch.title?.trim()) {
    errors.push('Chapter title is required.');
  }

  if (mode === 'publish' && !ch.permissionVerified) {
    errors.push('Publisher permission must be verified before publishing.');
  }

  const concepts = Array.isArray(ch.concepts) ? ch.concepts : [];
  if (concepts.length === 0) {
    errors.push('At least 1 concept is required inside a chapter.');
  }

  concepts.forEach((concept: CmsConcept, cIdx: number) => {
    const label = `Concept "${concept.title || concept.id || `#${cIdx + 1}`}"`;
    if (!concept.id?.trim() || !concept.title?.trim()) {
      errors.push(`${label}: id and title are required.`);
    }
    if (!concept.simpleExplanation?.trim()) {
      errors.push(`${label}: simpleExplanation is required.`);
    }
    if (!concept.sourceBook?.trim() || !concept.sourcePage?.trim()) {
      errors.push(`${label}: sourceBook and sourcePage citations are required.`);
    }
    if (!hasBalancedLatex(concept.simpleExplanation || '')) {
      errors.push(`${label}: Unbalanced KaTeX $ delimiters in simpleExplanation.`);
    }
    (concept.formulas ?? []).forEach((f, fIdx) => {
      if (!hasBalancedLatex(f.expression || '')) {
        errors.push(`${label} formula[${fIdx}]: Unbalanced KaTeX $ delimiters.`);
      }
    });
    (concept.workedExampleSteps ?? []).forEach((step, sIdx) => {
      if (!hasBalancedLatex(step)) {
        errors.push(`${label} workedExampleSteps[${sIdx}]: Unbalanced KaTeX $ delimiters.`);
      }
    });
    (concept.motionGraphics ?? []).forEach((mg, mIdx) => {
      validateMotionGraphic(mg, `${label} motionGraphics[${mIdx}]`, errors);
    });
    (concept.graphs ?? []).forEach((graph, gIdx) => {
      validateGraph(graph, `${label} graphs[${gIdx}]`, errors);
    });
    if (mode === 'publish' && !concept.reviewedBy?.trim()) {
      errors.push(`${label}: Human reviewer sign-off (reviewedBy) is required to publish.`);
    }
  });

  const questions = Array.isArray(ch.questions) ? ch.questions : [];
  if (mode === 'publish' && questions.length === 0) {
    warnings.push('Publishing chapter with 0 questions — students will only see reading concepts.');
  }

  questions.forEach((q: CmsQuestion, qIdx: number) => {
    const label = `Question "${q.id || `#${qIdx + 1}`}"`;
    if (!q.id?.trim() || !q.statement?.trim()) {
      errors.push(`${label}: id and statement are required.`);
    }
    if (!hasBalancedLatex(q.statement || '') || !hasBalancedLatex(q.explanation || '')) {
      errors.push(`${label}: Unbalanced KaTeX $ delimiters in statement or explanation.`);
    }
    if (q.questionType === 'mcq' || q.questionType === 'conceptual' || q.questionType === 'recall') {
      const cleanOpts = (q.options ?? []).map((o) => o.trim()).filter(Boolean);
      const uniqueOpts = new Set(cleanOpts.map((o) => o.toLowerCase()));
      if (cleanOpts.length < 2 || uniqueOpts.size !== cleanOpts.length) {
        errors.push(`${label}: MCQ requires at least 2 distinct non-empty options.`);
      }
      if (!q.correctAnswer?.trim() || !cleanOpts.includes(q.correctAnswer.trim())) {
        errors.push(`${label}: correctAnswer must match one of the options verbatim.`);
      }
    }
    if (q.questionType === 'multi_select') {
      const cleanOpts = (q.options ?? []).map((o) => o.trim()).filter(Boolean);
      const answers = (q.multiSelectAnswers ?? []).map((a) => a.trim()).filter(Boolean);
      if (cleanOpts.length < 3) {
        errors.push(`${label}: multi_select requires at least 3 options.`);
      }
      if (answers.length === 0 || !answers.every((a) => cleanOpts.includes(a))) {
        errors.push(`${label}: multiSelectAnswers must all match items inside options.`);
      }
    }
    if (q.questionType === 'true_false') {
      const ans = q.correctAnswer?.trim().toLowerCase();
      if (ans !== 'true' && ans !== 'false') {
        errors.push(`${label}: true_false requires correctAnswer "True" or "False".`);
      }
    }
    if (q.questionType === 'matching') {
      const pairs = q.matchingPairs ?? [];
      if (pairs.length < 2 || pairs.some((p) => !p.left?.trim() || !p.right?.trim())) {
        errors.push(`${label}: matching requires at least 2 valid {left, right} pairs.`);
      }
    }
    if (q.questionType === 'numerical') {
      const steps = q.numericalSteps;
      if (
        !steps ||
        !Array.isArray(steps.given) ||
        steps.given.length === 0 ||
        !steps.required?.trim() ||
        !steps.formula?.trim() ||
        !steps.substitution?.trim() ||
        !steps.calculation?.trim() ||
        !steps.answerWithUnit?.trim()
      ) {
        errors.push(
          `${label}: Numericals must include all 6 steps (given, required, formula, substitution, calculation, answerWithUnit).`,
        );
      }
      if (!q.correctAnswer?.trim()) {
        errors.push(`${label}: Numerical correctAnswer is required.`);
      }
    }
    if (q.sourceType === 'official_past_paper' || q.sourceType === 'official_model_paper') {
      if (!q.sourceBoardId?.trim() || !q.sourceYear) {
        errors.push(`${label}: Official papers require sourceBoardId and sourceYear.`);
      }
      if (mode === 'publish' && !q.reviewedBy?.trim()) {
        errors.push(`${label}: Official paper provenance requires reviewedBy.`);
      }
    }
    if (ch.programmeId && q.programmeId && ch.programmeId !== q.programmeId) {
      errors.push(`${label}: Question programmeId (${q.programmeId}) must match chapter programmeId (${ch.programmeId}).`);
    }
  });

  return {
    valid: errors.length === 0,
    errors,
    warnings,
  };
}

function hydrateSeedChapter(ch: CmsChapter): CmsChapter {
  const now = new Date().toISOString();
  return {
    ...ch,
    origin: ch.origin ?? 'human_authored',
    adConfig: ch.adConfig ?? defaultAdConfig(),
    updatedAt: ch.updatedAt ?? now,
  };
}

function loadStore(): CloudStoreDisk {
  const envToken = process.env.AGENT_ACCESS_TOKEN?.trim();

  if (fs.existsSync(STORE_FILE)) {
    try {
      const raw = fs.readFileSync(STORE_FILE, 'utf8');
      const parsed = JSON.parse(raw) as Partial<CloudStoreDisk>;
      const existingChapters = Array.isArray(parsed.chapters) ? parsed.chapters : [];

      // Merge any missing initial seed chapters by chapterId so fresh visual specs remain available
      const byId = new Map(existingChapters.map((c) => [c.chapterId, c]));
      let dirty = false;
      for (const seed of INITIAL_CMS_CHAPTERS) {
        const existing = byId.get(seed.chapterId);
        if (!existing) {
          byId.set(seed.chapterId, hydrateSeedChapter(seed));
          dirty = true;
        } else {
          // Ensure initial seed visuals populate if an older store lacked motionGraphics/graphs
          const updatedConcepts = existing.concepts.map((c, idx) => {
            const seedConcept = seed.concepts[idx];
            if (!seedConcept) return c;
            return {
              ...c,
              motionGraphics: c.motionGraphics?.length ? c.motionGraphics : seedConcept.motionGraphics,
              graphs: c.graphs?.length ? c.graphs : seedConcept.graphs,
            };
          });
          byId.set(seed.chapterId, {
            ...existing,
            adConfig: existing.adConfig ?? defaultAdConfig(),
            concepts: updatedConcepts,
          });
        }
      }

      const store: CloudStoreDisk = {
        version: Math.max(3, parsed.version ?? 3),
        agentAccessToken: envToken || parsed.agentAccessToken || generateSecureToken('rsh_agent'),
        verifierAccessToken:
          process.env.VERIFIER_ACCESS_TOKEN?.trim() ||
          parsed.verifierAccessToken ||
          generateSecureToken('rsh_verifier'),
        agentTokenRevoked: Boolean(parsed.agentTokenRevoked),
        verifierTokenRevoked: Boolean(parsed.verifierTokenRevoked),
        securitySettings: {
          ...defaultSecuritySettings(),
          ...(parsed.securitySettings ?? {}),
          // Always enforce strict zero-cost default unless explicitly authorized & persisted
          allowOptionalPaidServerAi: Boolean(parsed.securitySettings?.allowOptionalPaidServerAi),
        },
        chapters: Array.isArray(byId.values()) ? Array.from(byId.values()) : Array.from(byId.values()),
        books: Array.isArray(parsed.books) ? parsed.books : [],
        registeredAgents: Array.isArray(parsed.registeredAgents) ? parsed.registeredAgents : [],
        publishHistory: Array.isArray(parsed.publishHistory) ? parsed.publishHistory : [],
        sourceBundles: Array.isArray(parsed.sourceBundles) ? parsed.sourceBundles : [],
        productionJobs: Array.isArray(parsed.productionJobs) ? parsed.productionJobs : [],
        verificationReports: Array.isArray(parsed.verificationReports)
          ? parsed.verificationReports
          : [],
        examBlueprints: Array.isArray(parsed.examBlueprints) ? parsed.examBlueprints : [],
        issueReports: Array.isArray(parsed.issueReports) ? parsed.issueReports : [],
        quarantinedSubmissions: Array.isArray(parsed.quarantinedSubmissions)
          ? parsed.quarantinedSubmissions
          : [],
        processedIdempotencyKeys: Array.isArray(parsed.processedIdempotencyKeys)
          ? parsed.processedIdempotencyKeys.slice(0, 300)
          : [],
        examSubmissions: Array.isArray(parsed.examSubmissions)
          ? parsed.examSubmissions.slice(0, 200)
          : [],
        auditLog: Array.isArray(parsed.auditLog) ? parsed.auditLog.slice(0, 200) : [],
      };
      if (dirty || !parsed.agentAccessToken || !parsed.verifierAccessToken) {
        saveStore(store);
      }
      return store;
    } catch {
      // Fall through to clean re-initialization
    }
  }

  const initialStore: CloudStoreDisk = {
    version: 3,
    agentAccessToken: envToken || generateSecureToken('rsh_agent'),
    verifierAccessToken:
      process.env.VERIFIER_ACCESS_TOKEN?.trim() || generateSecureToken('rsh_verifier'),
    agentTokenRevoked: false,
    verifierTokenRevoked: false,
    securitySettings: defaultSecuritySettings(),
    chapters: INITIAL_CMS_CHAPTERS.map(hydrateSeedChapter),
    books: [],
    registeredAgents: [],
    publishHistory: [],
    sourceBundles: [],
    productionJobs: [],
    verificationReports: [],
    examBlueprints: [],
    issueReports: [],
    quarantinedSubmissions: [],
    processedIdempotencyKeys: [],
    examSubmissions: [],
    auditLog: [],
  };
  saveStore(initialStore);
  return initialStore;
}

function saveStore(store: CloudStoreDisk): void {
  fs.writeFileSync(STORE_FILE, JSON.stringify(store, null, 2), 'utf8');
}

function timingSafeMatches(presented: string, expected: string): boolean {
  if (!presented || !expected) return false;
  const a = Buffer.from(presented, 'utf8');
  const b = Buffer.from(expected, 'utf8');
  if (a.length !== b.length) return false;
  return crypto.timingSafeEqual(a, b);
}

export function getAgentAccessToken(): string {
  const store = loadStore();
  return store.agentTokenRevoked ? '' : store.agentAccessToken;
}

export function getVerifierAccessToken(): string {
  const store = loadStore();
  return store.verifierTokenRevoked ? '' : store.verifierAccessToken;
}

export function verifyAgentBearerToken(authHeader: string | undefined): boolean {
  if (!authHeader || !authHeader.startsWith('Bearer ')) return false;
  const presented = authHeader.slice('Bearer '.length).trim();
  const store = loadStore();
  if (!store.agentTokenRevoked && timingSafeMatches(presented, store.agentAccessToken)) {
    return true;
  }
  if (!store.verifierTokenRevoked && timingSafeMatches(presented, store.verifierAccessToken)) {
    return true;
  }
  return false;
}

export function verifyBearerScope(
  authHeader: string | undefined,
): 'agent' | 'verifier' | null {
  if (!authHeader || !authHeader.startsWith('Bearer ')) return null;
  const presented = authHeader.slice('Bearer '.length).trim();
  const store = loadStore();
  if (!store.verifierTokenRevoked && timingSafeMatches(presented, store.verifierAccessToken)) {
    return 'verifier';
  }
  if (!store.agentTokenRevoked && timingSafeMatches(presented, store.agentAccessToken)) {
    return 'agent';
  }
  return null;
}

export function rotateAgentToken(actor = 'Admin'): { token: string } {
  const store = loadStore();
  const next = generateSecureToken('rsh_agent');
  store.agentAccessToken = next;
  store.agentTokenRevoked = false;
  store.auditLog.unshift({
    id: `audit_${Date.now()}`,
    action: 'token_rotated',
    actor,
    timestamp: new Date().toISOString(),
    summary: 'Rotated external Author Agent / MCP access token.',
  });
  store.auditLog = store.auditLog.slice(0, 150);
  saveStore(store);
  return { token: next };
}

export function rotateVerifierToken(actor = 'Admin'): { token: string } {
  const store = loadStore();
  const next = generateSecureToken('rsh_verifier');
  store.verifierAccessToken = next;
  store.verifierTokenRevoked = false;
  store.auditLog.unshift({
    id: `audit_${Date.now()}`,
    action: 'token_rotated',
    actor,
    timestamp: new Date().toISOString(),
    summary: 'Rotated scoped Independent Verifier access token.',
  });
  store.auditLog = store.auditLog.slice(0, 150);
  saveStore(store);
  return { token: next };
}

export function revokeScopedToken(scope: 'agent' | 'verifier', actor = 'Admin'): void {
  const store = loadStore();
  if (scope === 'agent') {
    store.agentTokenRevoked = true;
  } else {
    store.verifierTokenRevoked = true;
  }
  store.auditLog.unshift({
    id: `audit_${Date.now()}`,
    action: 'token_revoked',
    actor,
    timestamp: new Date().toISOString(),
    summary: `Revoked ${scope} access token.`,
  });
  store.auditLog = store.auditLog.slice(0, 150);
  saveStore(store);
}

export function getSecuritySettings(): WorkspaceSecuritySettings {
  return loadStore().securitySettings;
}

export function setPaidAiAuthorized(
  enabled: boolean,
  actor = 'Owner',
): WorkspaceSecuritySettings {
  const store = loadStore();
  const next: WorkspaceSecuritySettings = {
    ...store.securitySettings,
    allowOptionalPaidServerAi: enabled,
    paidAiAuthorizedAt: enabled ? new Date().toISOString() : undefined,
    paidAiAuthorizedBy: enabled ? actor : undefined,
  };
  store.securitySettings = next;
  store.auditLog.unshift({
    id: `audit_${Date.now()}`,
    action: 'security_updated',
    actor,
    timestamp: new Date().toISOString(),
    summary: enabled
      ? 'Owner explicitly enabled Optional Paid Server AI endpoints.'
      : 'Owner locked Paid Server AI back to $0 External Agent default.',
  });
  store.auditLog = store.auditLog.slice(0, 150);
  saveStore(store);
  return next;
}

export function listAllChapters(): CmsChapter[] {
  return loadStore().chapters;
}

export function getAuditLog(): CloudAuditEntry[] {
  return loadStore().auditLog;
}

export function listCatalog(query: CatalogQuery): {
  items: CatalogChapterSummary[];
  total: number;
  page: number;
  limit: number;
  hasMore: boolean;
  availableGrades: number[];
  availableSubjects: { subjectId: string; subjectName: string; grade: number; count: number }[];
} {
  const store = loadStore();
  const published = store.chapters.filter((ch) => ch.publicationStatus === 'published');

  const programmeFilter = query.programme?.trim() || 'ssc_hssc';
  const baseScoped = published.filter((ch) => ch.programmeId === programmeFilter);

  const availableGrades = Array.from(new Set(baseScoped.map((c) => c.grade))).sort((a, b) => a - b);

  const subjectMap = new Map<string, { subjectId: string; subjectName: string; grade: number; count: number }>();
  for (const ch of baseScoped) {
    const key = `${ch.grade}_${ch.subjectId}`;
    const existing = subjectMap.get(key);
    if (existing) {
      existing.count += 1;
    } else {
      subjectMap.set(key, {
        subjectId: ch.subjectId,
        subjectName: ch.subjectName,
        grade: ch.grade,
        count: 1,
      });
    }
  }

  const searchQ = query.q?.trim().toLowerCase() || '';
  const filtered = baseScoped
    .filter((ch) => {
      if (query.grade && ch.grade !== query.grade) return false;
      if (query.groupId && ch.groupId !== query.groupId) return false;
      if (query.subjectId && ch.subjectId !== query.subjectId) return false;
      if (searchQ) {
        const hay = `${ch.title} ${ch.subjectName} ${ch.grade} ${ch.learningOutcomes.join(' ')}`.toLowerCase();
        if (!hay.includes(searchQ)) return false;
      }
      return true;
    })
    .sort((a, b) => a.grade - b.grade || a.subjectName.localeCompare(b.subjectName) || a.chapterNumber - b.chapterNumber);

  const page = Math.max(1, Math.round(Number(query.page) || 1));
  const limit = Math.max(1, Math.min(50, Math.round(Number(query.limit) || 12)));
  const start = (page - 1) * limit;
  const pageItems = filtered.slice(start, start + limit).map((ch): CatalogChapterSummary => ({
    chapterId: ch.chapterId,
    programmeId: ch.programmeId,
    grade: ch.grade,
    groupId: ch.groupId,
    subjectId: ch.subjectId,
    subjectName: ch.subjectName,
    chapterNumber: ch.chapterNumber,
    title: ch.title,
    packVersion: ch.packVersion,
    conceptCount: ch.concepts.length,
    questionCount: ch.questions.length,
    hasMotionGraphics: ch.concepts.some((c) => (c.motionGraphics?.length ?? 0) > 0),
    hasGraphs: ch.concepts.some((c) => (c.graphs?.length ?? 0) > 0),
    checksumSha256: computeChapterChecksum(ch),
    adConfig: ch.adConfig ?? defaultAdConfig(),
    updatedAt: ch.updatedAt ?? new Date().toISOString(),
  }));

  return {
    items: pageItems,
    total: filtered.length,
    page,
    limit,
    hasMore: start + pageItems.length < filtered.length,
    availableGrades,
    availableSubjects: Array.from(subjectMap.values()).sort(
      (a, b) => a.grade - b.grade || a.subjectName.localeCompare(b.subjectName),
    ),
  };
}

export function getPublishedPack(chapterId: string, version?: number): {
  chapter: CmsChapter;
  checksumSha256: string;
} | null {
  const store = loadStore();
  const chapter = store.chapters.find(
    (c) => c.chapterId === chapterId && c.publicationStatus === 'published',
  );
  if (!chapter) return null;
  if (typeof version === 'number' && Number.isFinite(version) && chapter.packVersion !== version) {
    return null;
  }
  return {
    chapter,
    checksumSha256: computeChapterChecksum(chapter),
  };
}

function normalizeIncomingChapter(
  input: CmsChapter,
  forcedStatus: PublicationStatus,
  origin: QuestionOrigin,
  forcedStage?: ReviewStage,
): CmsChapter {
  const now = new Date().toISOString();
  const { status: _ignoredStatus, ...rest } = input as CmsChapter & { status?: unknown };
  void _ignoredStatus;
  const resolvedStage: ReviewStage =
    forcedStage ?? input.reviewStage ?? (forcedStatus === 'published' ? 'published' : 'ai_generated');
  return {
    ...rest,
    title: sanitizeUntrustedText(input.title || ''),
    chapterIntro: input.chapterIntro ? sanitizeUntrustedText(input.chapterIntro) : undefined,
    prerequisites: (input.prerequisites ?? []).map((p) => sanitizeUntrustedText(p)).filter(Boolean),
    learningOutcomes: (Array.isArray(input.learningOutcomes) ? input.learningOutcomes : []).map((l) =>
      sanitizeUntrustedText(l),
    ),
    publicationStatus: forcedStatus,
    reviewStage: resolvedStage,
    origin,
    packVersion: Math.max(1, Math.round(input.packVersion || 1)),
    permissionVerified: Boolean(input.permissionVerified),
    adConfig: input.adConfig ?? defaultAdConfig(),
    updatedAt: now,
    concepts: (input.concepts ?? []).map((c, idx) => ({
      ...c,
      chapterId: input.chapterId,
      topicId: c.topicId || `${input.chapterId}_t${idx + 1}`,
      orderIndex: c.orderIndex || idx + 1,
      title: sanitizeUntrustedText(c.title || ''),
      simpleExplanation: sanitizeUntrustedText(c.simpleExplanation || ''),
      detailedExplanation: c.detailedExplanation ? sanitizeUntrustedText(c.detailedExplanation) : undefined,
      commonMistake: sanitizeUntrustedText(c.commonMistake || ''),
      commonMistakeCorrection: sanitizeUntrustedText(c.commonMistakeCorrection || ''),
      workedExamplePrompt: sanitizeUntrustedText(c.workedExamplePrompt || ''),
      workedExampleSteps: (c.workedExampleSteps ?? []).map((s) => sanitizeUntrustedText(s)),
      workedExampleAnswer: sanitizeUntrustedText(c.workedExampleAnswer || ''),
      locale: c.locale ?? 'en',
      textDirection: c.textDirection ?? 'ltr',
      definitions: (c.definitions ?? []).map((d) => ({
        term: sanitizeUntrustedText(d.term),
        definition: sanitizeUntrustedText(d.definition),
      })),
      importantPoints: (c.importantPoints ?? []).map((p) => sanitizeUntrustedText(p)),
      formulas: c.formulas ?? [],
      diagramCaption: sanitizeUntrustedText(c.diagramCaption ?? ''),
      diagramSvg: c.diagramSvg ?? '',
      motionGraphics: c.motionGraphics ?? [],
      graphs: c.graphs ?? [],
      applications: (c.applications ?? []).map((a) => sanitizeUntrustedText(a)),
      quickRevisionSummary: (c.quickRevisionSummary ?? []).map((s) => sanitizeUntrustedText(s)),
      videoLinks: c.videoLinks ?? [],
      glossaryHints: c.glossaryHints ?? [],
      microCards: (c.microCards ?? []).map((m) => ({
        ...m,
        stageTitle: sanitizeUntrustedText(m.stageTitle),
        body: sanitizeUntrustedText(m.body),
      })),
      reviewStatus: forcedStatus,
    })),
    questions: (input.questions ?? []).map((q) => ({
      ...q,
      programmeId: input.programmeId,
      grade: input.grade,
      groupId: input.groupId,
      subjectId: input.subjectId,
      chapterId: input.chapterId,
      statement: sanitizeUntrustedText(q.statement || ''),
      explanation: sanitizeUntrustedText(q.explanation || ''),
      correctAnswer: sanitizeUntrustedText(q.correctAnswer || ''),
      options: (q.options ?? []).map((o) => sanitizeUntrustedText(o)),
      hints: (q.hints ?? []).map((h) => sanitizeUntrustedText(h)),
      markingPoints: (q.markingPoints ?? []).map((m) => sanitizeUntrustedText(m)),
      origin,
      publicationStatus: forcedStatus,
    })),
  };
}

export function upsertDraftChapter(
  rawChapter: CmsChapter,
  origin: QuestionOrigin = 'agent_uploaded_draft',
  actor = 'External AI Agent',
  forcedStage: ReviewStage = 'ai_generated',
): { ok: true; chapter: CmsChapter; warnings: string[] } | { ok: false; errors: string[]; warnings: string[] } {
  const normalized = normalizeIncomingChapter(rawChapter, 'draft', origin, forcedStage);
  const validation = validateChapterForCloud(normalized, 'draft');
  if (!validation.valid) {
    return { ok: false, errors: validation.errors, warnings: validation.warnings };
  }

  const store = loadStore();
  const existingIdx = store.chapters.findIndex((c) => c.chapterId === normalized.chapterId);
  if (existingIdx >= 0) {
    const existing = store.chapters[existingIdx];
    normalized.packVersion =
      existing.publicationStatus === 'published'
        ? existing.packVersion + 1
        : Math.max(1, existing.packVersion);
    store.chapters[existingIdx] = normalized;
  } else {
    store.chapters.unshift(normalized);
  }

  store.auditLog.unshift({
    id: `audit_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
    action: 'draft_uploaded',
    chapterId: normalized.chapterId,
    actor,
    timestamp: new Date().toISOString(),
    summary: `Saved draft "${normalized.title}" (${normalized.concepts.length} concepts, ${normalized.questions.length} questions, stage=${normalized.reviewStage}).`,
  });
  store.auditLog = store.auditLog.slice(0, 150);
  saveStore(store);

  return { ok: true, chapter: normalized, warnings: validation.warnings };
}

export function saveCmsChapter(chapter: CmsChapter): { ok: true; chapter: CmsChapter } | { ok: false; errors: string[] } {
  const mode = chapter.publicationStatus === 'published' ? 'publish' : 'draft';
  const validation = validateChapterForCloud(chapter, mode);
  if (!validation.valid) {
    return { ok: false, errors: validation.errors };
  }

  const store = loadStore();
  const nextChapter: CmsChapter = {
    ...chapter,
    adConfig: chapter.adConfig ?? defaultAdConfig(),
    updatedAt: new Date().toISOString(),
  };

  const idx = store.chapters.findIndex((c) => c.chapterId === nextChapter.chapterId);
  if (idx >= 0) {
    store.chapters[idx] = nextChapter;
  } else {
    store.chapters.unshift(nextChapter);
  }
  store.auditLog.unshift({
    id: `audit_${Date.now()}`,
    action: 'updated',
    chapterId: nextChapter.chapterId,
    actor: 'Admin Studio',
    timestamp: new Date().toISOString(),
    summary: `Updated "${nextChapter.title}" (${nextChapter.publicationStatus}).`,
  });
  store.auditLog = store.auditLog.slice(0, 100);
  saveStore(store);
  return { ok: true, chapter: nextChapter };
}

export function approveAndPublishChapter(
  chapterId: string,
  reviewedBy: string,
  verifyPermission = true,
): { ok: true; chapter: CmsChapter } | { ok: false; status: number; errors: string[] } {
  const reviewer = reviewedBy.trim();
  if (!reviewer) {
    return { ok: false, status: 400, errors: ['Reviewer name is required to approve and publish.'] };
  }

  const store = loadStore();
  const idx = store.chapters.findIndex((c) => c.chapterId === chapterId);
  if (idx < 0) {
    return { ok: false, status: 404, errors: [`Chapter "${chapterId}" not found in cloud store.`] };
  }

  const existing = store.chapters[idx];
  const candidate: CmsChapter = {
    ...existing,
    publicationStatus: 'published',
    reviewStage: 'published',
    permissionVerified: verifyPermission ? true : existing.permissionVerified,
    packVersion:
      existing.publicationStatus === 'published' ? existing.packVersion + 1 : Math.max(1, existing.packVersion),
    adConfig: defaultAdConfig(),
    updatedAt: new Date().toISOString(),
    concepts: existing.concepts.map((c) => ({
      ...c,
      reviewStatus: 'published',
      reviewedBy: c.reviewedBy?.trim() || reviewer,
    })),
    questions: existing.questions.map((q) => ({
      ...q,
      publicationStatus: 'published',
      origin: q.origin === 'ai_generated_draft' ? 'ai_reviewed' : q.origin ?? 'human_authored',
      reviewedBy: q.reviewedBy?.trim() || reviewer,
    })),
  };

  const validation = validateChapterForCloud(candidate, 'publish');
  if (!validation.valid) {
    return { ok: false, status: 400, errors: validation.errors };
  }

  store.chapters[idx] = candidate;
  const checksum = computeChapterChecksum(candidate);
  store.publishHistory.unshift({
    id: `pub_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
    chapterId: candidate.chapterId,
    packVersion: candidate.packVersion,
    checksumSha256: checksum,
    publishedBy: reviewer,
    publishedAt: candidate.updatedAt || new Date().toISOString(),
    target: 'cloud_store',
    note: `Published v${candidate.packVersion} (${candidate.questions.length} questions, ${candidate.concepts.length} concepts).`,
    snapshot: JSON.parse(JSON.stringify(candidate)) as CmsChapter,
  });
  store.publishHistory = store.publishHistory.slice(0, 150);
  store.auditLog.unshift({
    id: `audit_${Date.now()}`,
    action: 'approved_published',
    chapterId: candidate.chapterId,
    actor: reviewer,
    timestamp: new Date().toISOString(),
    summary: `Approved & published "${candidate.title}" v${candidate.packVersion} with respectful AdMob config.`,
  });
  store.auditLog = store.auditLog.slice(0, 150);
  saveStore(store);

  return { ok: true, chapter: candidate };
}

export function deleteCmsChapter(chapterId: string): boolean {
  const store = loadStore();
  const before = store.chapters.length;
  store.chapters = store.chapters.filter((c) => c.chapterId !== chapterId);
  if (store.chapters.length === before) return false;
  store.auditLog.unshift({
    id: `audit_${Date.now()}`,
    action: 'deleted',
    chapterId,
    actor: 'Admin Studio',
    timestamp: new Date().toISOString(),
    summary: `Removed chapter "${chapterId}" from cloud workspace.`,
  });
  store.auditLog = store.auditLog.slice(0, 150);
  saveStore(store);
  return true;
}

// -----------------------------------------------------------------------------
// Autonomous Operations Store Helpers (Sources, Jobs, Tasks, Reviews, Exams, Monitoring)
// -----------------------------------------------------------------------------

export function appendAudit(entry: Omit<CloudAuditEntry, 'id' | 'timestamp'>): void {
  const store = loadStore();
  store.auditLog.unshift({
    ...entry,
    id: `audit_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
    timestamp: new Date().toISOString(),
  });
  store.auditLog = store.auditLog.slice(0, 150);
  saveStore(store);
}

export function getChapterById(chapterId: string): CmsChapter | undefined {
  return loadStore().chapters.find((c) => c.chapterId === chapterId);
}

export function computeTextSha256(text: string): string {
  return crypto.createHash('sha256').update(text, 'utf8').digest('hex');
}

export function findCachedSourceBundle(sha256: string): SourceBundle | undefined {
  return loadStore().sourceBundles.find((s) => s.sha256 === sha256);
}

export function getSourceBundle(sourceBundleId: string): SourceBundle | undefined {
  return loadStore().sourceBundles.find((s) => s.id === sourceBundleId);
}

export function upsertSourceBundle(bundle: SourceBundle): SourceBundle {
  const store = loadStore();
  const idx = store.sourceBundles.findIndex((s) => s.id === bundle.id);
  if (idx >= 0) {
    store.sourceBundles[idx] = bundle;
  } else {
    store.sourceBundles.unshift(bundle);
  }
  store.sourceBundles = store.sourceBundles.slice(0, 100);
  saveStore(store);
  return bundle;
}

export function listProductionJobs(): ProductionJob[] {
  return loadStore().productionJobs;
}

export function getProductionJob(jobId: string): ProductionJob | undefined {
  return loadStore().productionJobs.find((j) => j.id === jobId);
}

export function saveProductionJob(job: ProductionJob): ProductionJob {
  const store = loadStore();
  const next: ProductionJob = { ...job, updatedAt: new Date().toISOString() };
  const idx = store.productionJobs.findIndex((j) => j.id === next.id);
  if (idx >= 0) {
    store.productionJobs[idx] = next;
  } else {
    store.productionJobs.unshift(next);
  }
  store.productionJobs = store.productionJobs.slice(0, 80);
  saveStore(store);
  return next;
}

export function listPendingExternalTasks(roleFilter?: AgentRoleId): AgentTask[] {
  const store = loadStore();
  const nowMs = Date.now();
  const result: AgentTask[] = [];
  for (const job of store.productionJobs) {
    if (job.status === 'paused' || job.status === 'cancelled' || job.status === 'completed') {
      continue;
    }
    const structureGateBlocked =
      job.structureStatus === 'proposed_pending' || job.structureStatus === 'rejected';
    const completedIds = new Set(
      job.tasks.filter((t) => t.status === 'completed').map((t) => t.id),
    );
    for (const task of job.tasks) {
      if (roleFilter && task.role !== roleFilter) continue;
      if (structureGateBlocked && task.phase >= 4) continue;
      const leaseExpired =
        task.status === 'claimed' &&
        task.leaseExpiresAt &&
        new Date(task.leaseExpiresAt).getTime() < nowMs;
      const depsMet = task.dependsOnTaskIds.every((id) => completedIds.has(id));
      if ((task.status === 'queued' || leaseExpired) && depsMet) {
        result.push(task);
      }
    }
  }
  return result.sort(
    (a, b) => (b.priority ?? 5) - (a.priority ?? 5) || a.phase - b.phase || a.createdAt.localeCompare(b.createdAt),
  );
}

export function claimNextExternalTaskDetailed(
  workerName: string,
  roleFilter?: AgentRoleId,
): {
  claimed: { job: ProductionJob; task: AgentTask } | null;
  skippedAuthorSeparationCount: number;
  structureGateBlockedCount: number;
} {
  const store = loadStore();
  const now = new Date();
  const leaseIso = new Date(now.getTime() + 15 * 60 * 1000).toISOString();
  const normWorker = workerName.trim().toLowerCase();
  let skippedAuthorSeparationCount = 0;
  let structureGateBlockedCount = 0;

  type Candidate = { jIdx: number; tIdx: number; task: AgentTask };
  const candidates: Candidate[] = [];

  for (let jIdx = 0; jIdx < store.productionJobs.length; jIdx++) {
    const job = store.productionJobs[jIdx];
    if (job.status === 'paused' || job.status === 'cancelled' || job.status === 'completed') {
      continue;
    }
    const structureGateBlocked =
      job.structureStatus === 'proposed_pending' || job.structureStatus === 'rejected';
    const completedIds = new Set(
      job.tasks.filter((t) => t.status === 'completed').map((t) => t.id),
    );
    const linkedChapter = store.chapters.find((c) => c.chapterId === job.chapterId);
    const authorNorm = linkedChapter?.authorWorkerId?.trim().toLowerCase() || '';

    for (let tIdx = 0; tIdx < job.tasks.length; tIdx++) {
      const t = job.tasks[tIdx];
      if (roleFilter && t.role !== roleFilter) continue;
      const leaseExpired =
        t.status === 'claimed' &&
        t.leaseExpiresAt &&
        new Date(t.leaseExpiresAt).getTime() < now.getTime();
      const depsMet = t.dependsOnTaskIds.every((id) => completedIds.has(id));
      if (!((t.status === 'queued' || leaseExpired) && depsMet)) continue;

      if (structureGateBlocked && t.phase >= 4) {
        structureGateBlockedCount += 1;
        continue;
      }

      // Enforce strict Author vs Independent Verifier separation
      if (t.phase === 6 && authorNorm && normWorker && authorNorm === normWorker) {
        skippedAuthorSeparationCount += 1;
        continue;
      }

      candidates.push({ jIdx, tIdx, task: t });
    }
  }

  if (candidates.length === 0) {
    return { claimed: null, skippedAuthorSeparationCount, structureGateBlockedCount };
  }

  candidates.sort(
    (a, b) =>
      (b.task.priority ?? 5) - (a.task.priority ?? 5) ||
      a.task.phase - b.task.phase ||
      a.task.createdAt.localeCompare(b.task.createdAt),
  );

  const chosen = candidates[0];
  const job = store.productionJobs[chosen.jIdx];
  const prevLogs: AgentTaskLogEntry[] = chosen.task.executionLogs ?? [];
  const nextLog: AgentTaskLogEntry = {
    timestamp: now.toISOString(),
    workerId: workerName,
    event: 'task_claimed',
    detail: `Claimed by "${workerName}" with 15-minute lease.`,
  };

  const updatedTask: AgentTask = {
    ...chosen.task,
    status: 'claimed',
    assignedWorker: workerName,
    leaseExpiresAt: leaseIso,
    startedAt: chosen.task.startedAt || now.toISOString(),
    executionLogs: [...prevLogs, nextLog].slice(-25),
  };
  job.tasks[chosen.tIdx] = updatedTask;
  job.status = 'running';
  job.currentPhase = Math.max(job.currentPhase, updatedTask.phase);
  job.updatedAt = now.toISOString();
  store.productionJobs[chosen.jIdx] = job;

  // Update registered agent presence if registered
  const agentIdx = store.registeredAgents.findIndex(
    (a) => a.workerId.toLowerCase() === normWorker || a.name.toLowerCase() === normWorker,
  );
  if (agentIdx >= 0) {
    store.registeredAgents[agentIdx] = {
      ...store.registeredAgents[agentIdx],
      status: 'busy',
      lastHeartbeatAt: now.toISOString(),
      currentTaskId: updatedTask.id,
    };
  }

  saveStore(store);
  return { claimed: { job, task: updatedTask }, skippedAuthorSeparationCount, structureGateBlockedCount };
}

export function claimNextExternalTask(
  workerName: string,
  roleFilter?: AgentRoleId,
): { job: ProductionJob; task: AgentTask } | null {
  return claimNextExternalTaskDetailed(workerName, roleFilter).claimed;
}

export function renewTaskLease(
  taskId: string,
  workerName: string,
  progressNote?: string,
): { ok: true; task: AgentTask } | { ok: false; status: number; message: string } {
  const store = loadStore();
  const now = new Date();
  const leaseIso = new Date(now.getTime() + 15 * 60 * 1000).toISOString();

  for (let jIdx = 0; jIdx < store.productionJobs.length; jIdx++) {
    const job = store.productionJobs[jIdx];
    const tIdx = job.tasks.findIndex((t) => t.id === taskId);
    if (tIdx < 0) continue;
    const task = job.tasks[tIdx];
    if (task.assignedWorker && task.assignedWorker.toLowerCase() !== workerName.trim().toLowerCase()) {
      return {
        ok: false,
        status: 409,
        message: `Task "${taskId}" is currently leased by "${task.assignedWorker}".`,
      };
    }
    const logEntry: AgentTaskLogEntry = {
      timestamp: now.toISOString(),
      workerId: workerName,
      event: 'heartbeat',
      detail: progressNote?.trim() || 'Renewed 15-minute lease.',
    };
    const nextTask: AgentTask = {
      ...task,
      status: task.status === 'claimed' ? 'running' : task.status,
      leaseExpiresAt: leaseIso,
      executionLogs: [...(task.executionLogs ?? []), logEntry].slice(-25),
    };
    job.tasks[tIdx] = nextTask;
    job.updatedAt = now.toISOString();
    store.productionJobs[jIdx] = job;
    heartbeatAgent(workerName, taskId);
    saveStore(store);
    return { ok: true, task: nextTask };
  }
  return { ok: false, status: 404, message: `Task "${taskId}" not found.` };
}

export function listVerificationReports(): VerificationReport[] {
  return loadStore().verificationReports;
}

export function getVerificationReportForChapter(chapterId: string): VerificationReport | undefined {
  return loadStore().verificationReports.find((r) => r.chapterId === chapterId);
}

export function saveVerificationReport(report: VerificationReport): VerificationReport {
  const store = loadStore();
  const idx = store.verificationReports.findIndex((r) => r.chapterId === report.chapterId);
  if (idx >= 0) {
    store.verificationReports[idx] = report;
  } else {
    store.verificationReports.unshift(report);
  }
  store.verificationReports = store.verificationReports.slice(0, 120);
  saveStore(store);
  return report;
}

export function listExamBlueprints(): ExamBlueprint[] {
  return loadStore().examBlueprints;
}

export function listPublishedExams(programme?: string, grade?: number): ExamBlueprint[] {
  const prog = programme?.trim() || 'ssc_hssc';
  return loadStore().examBlueprints.filter((e) => {
    if (e.publicationStatus !== 'published') return false;
    if (e.programmeId !== prog) return false;
    if (grade && e.grade !== grade) return false;
    return true;
  });
}

export function upsertExamBlueprint(exam: ExamBlueprint): ExamBlueprint {
  const store = loadStore();
  const idx = store.examBlueprints.findIndex((e) => e.id === exam.id);
  if (idx >= 0) {
    store.examBlueprints[idx] = { ...exam, updatedAt: new Date().toISOString() };
  } else {
    store.examBlueprints.unshift(exam);
  }
  saveStore(store);
  return exam;
}

export function approveAndPublishExam(
  examId: string,
  reviewedBy: string,
): { ok: true; exam: ExamBlueprint } | { ok: false; status: number; error: string } {
  const reviewer = reviewedBy.trim();
  if (!reviewer) {
    return { ok: false, status: 400, error: 'Reviewer name is required to publish exam.' };
  }
  const store = loadStore();
  const idx = store.examBlueprints.findIndex((e) => e.id === examId);
  if (idx < 0) {
    return { ok: false, status: 404, error: `Exam "${examId}" not found.` };
  }
  const existing = store.examBlueprints[idx];
  const updated: ExamBlueprint = {
    ...existing,
    publicationStatus: 'published',
    reviewStage: 'published',
    packVersion:
      existing.publicationStatus === 'published'
        ? existing.packVersion + 1
        : Math.max(1, existing.packVersion),
    reviewedBy: reviewer,
    updatedAt: new Date().toISOString(),
  };
  store.examBlueprints[idx] = updated;
  store.auditLog.unshift({
    id: `audit_${Date.now()}`,
    action: 'approved_published',
    chapterId: updated.chapterId,
    actor: reviewer,
    timestamp: updated.updatedAt,
    summary: `Published exam "${updated.title}" (${updated.examKind}, ${updated.totalMarks} marks).`,
  });
  store.auditLog = store.auditLog.slice(0, 150);
  saveStore(store);
  return { ok: true, exam: updated };
}

export function listIssueReports(): MonitoringIssueReport[] {
  return loadStore().issueReports;
}

export function upsertIssueReport(report: MonitoringIssueReport): MonitoringIssueReport {
  const store = loadStore();
  const idx = store.issueReports.findIndex((r) => r.id === report.id);
  if (idx >= 0) {
    store.issueReports[idx] = { ...report, updatedAt: new Date().toISOString() };
  } else {
    store.issueReports.unshift(report);
    store.auditLog.unshift({
      id: `audit_${Date.now()}`,
      action: 'issue_reported',
      chapterId: report.chapterId,
      actor: report.reportedBy,
      timestamp: new Date().toISOString(),
      summary: `Logged ${report.category} alert on "${report.chapterId}": ${report.description.slice(0, 90)}`,
    });
  }
  store.auditLog = store.auditLog.slice(0, 150);
  saveStore(store);
  return report;
}

export function detectCatalogDuplicates(candidate: CmsChapter): {
  duplicateQuestionIds: string[];
  findings: string[];
} {
  const store = loadStore();
  const others = store.chapters.filter((c) => c.chapterId !== candidate.chapterId);
  const normalizeStem = (s: string) =>
    s
      .toLowerCase()
      .replace(/[^a-z0-9]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();

  const existingStemMap = new Map<string, { chapterTitle: string; questionId: string }>();
  for (const ch of others) {
    for (const q of ch.questions) {
      const key = normalizeStem(q.statement);
      if (key.length > 16) {
        existingStemMap.set(key, { chapterTitle: ch.title, questionId: q.id });
      }
    }
  }

  const duplicateQuestionIds: string[] = [];
  const findings: string[] = [];
  const localSeen = new Set<string>();

  for (const q of candidate.questions) {
    const key = normalizeStem(q.statement);
    if (!key) continue;
    if (localSeen.has(key)) {
      duplicateQuestionIds.push(q.id);
      findings.push(`Question "${q.id}" duplicates another question inside the same chapter.`);
      continue;
    }
    localSeen.add(key);
    const match = existingStemMap.get(key);
    if (match) {
      duplicateQuestionIds.push(q.id);
      findings.push(
        `Question "${q.id}" matches existing item (${match.questionId}) in chapter "${match.chapterTitle}".`,
      );
    }
  }

  return { duplicateQuestionIds, findings };
}

export function listBooks(): BookDocument[] {
  return loadStore().books;
}

export function getBookById(bookId: string): BookDocument | undefined {
  return loadStore().books.find((b) => b.id === bookId);
}

export function findBookBySha256(sha256: string): BookDocument | undefined {
  return loadStore().books.find((b) => b.sha256 === sha256);
}

export function upsertBook(book: BookDocument): BookDocument {
  const store = loadStore();
  const next: BookDocument = { ...book, updatedAt: new Date().toISOString() };
  const idx = store.books.findIndex((b) => b.id === next.id);
  if (idx >= 0) {
    store.books[idx] = next;
  } else {
    store.books.unshift(next);
  }
  store.books = store.books.slice(0, 200);
  saveStore(store);
  return next;
}

export function updateBookFlags(
  bookId: string,
  patch: Partial<Pick<BookDocument, 'title' | 'publicationStatus' | 'isStudentVisible' | 'permissionVerified'>>,
): BookDocument | null {
  const store = loadStore();
  const idx = store.books.findIndex((b) => b.id === bookId);
  if (idx < 0) return null;
  const updated: BookDocument = {
    ...store.books[idx],
    ...patch,
    updatedAt: new Date().toISOString(),
  };
  store.books[idx] = updated;
  saveStore(store);
  return updated;
}

export function deleteBook(bookId: string): boolean {
  const store = loadStore();
  const before = store.books.length;
  store.books = store.books.filter((b) => b.id !== bookId);
  if (store.books.length === before) return false;
  store.auditLog.unshift({
    id: `audit_${Date.now()}`,
    action: 'deleted',
    actor: 'Admin Studio',
    timestamp: new Date().toISOString(),
    summary: `Deleted uploaded PDF book "${bookId}".`,
  });
  store.auditLog = store.auditLog.slice(0, 150);
  saveStore(store);
  return true;
}

export function listPublishedBooks(query?: {
  programme?: string;
  grade?: number;
  subjectId?: string;
  q?: string;
}): Array<Omit<BookDocument, 'productionJobIds'> & { pdfUrl: string }> {
  const store = loadStore();
  const prog = query?.programme?.trim() || 'ssc_hssc';
  const search = query?.q?.trim().toLowerCase() || '';
  return store.books
    .filter((b) => {
      if (!b.isStudentVisible || b.publicationStatus === 'archived') return false;
      if (b.programmeId !== prog) return false;
      if (query?.grade && b.grade !== query.grade) return false;
      if (query?.subjectId && b.subjectId !== query.subjectId) return false;
      if (search) {
        const hay = `${b.title} ${b.subjectName} ${b.curriculum} ${b.sourceBook} ${b.extractedText.slice(0, 2500)}`.toLowerCase();
        if (!hay.includes(search)) return false;
      }
      return true;
    })
    .map((b) => {
      const { productionJobIds: _omit, ...safe } = b;
      void _omit;
      return {
        ...safe,
        pdfUrl: `/api/v1/books/${encodeURIComponent(b.id)}/pdf`,
      };
    });
}

export function listRegisteredAgents(): RegisteredAgent[] {
  return loadStore().registeredAgents;
}

export function registerOrUpdateAgent(input: {
  workerId: string;
  name: string;
  toolKind: RegisteredAgent['toolKind'];
  roles: AgentRoleId[];
  capabilities: string[];
  quotaRemainingNote?: string;
}): RegisteredAgent {
  const store = loadStore();
  const now = new Date().toISOString();
  const idx = store.registeredAgents.findIndex(
    (a) => a.workerId.toLowerCase() === input.workerId.trim().toLowerCase(),
  );
  const existing = idx >= 0 ? store.registeredAgents[idx] : undefined;
  const agent: RegisteredAgent = {
    workerId: input.workerId.trim(),
    name: input.name.trim(),
    toolKind: input.toolKind,
    roles: input.roles,
    capabilities: input.capabilities,
    status: existing?.status === 'paused' ? 'paused' : 'online',
    registeredAt: existing?.registeredAt ?? now,
    lastHeartbeatAt: now,
    tasksCompleted: existing?.tasksCompleted ?? 0,
    tasksFailed: existing?.tasksFailed ?? 0,
    quotaRemainingNote: input.quotaRemainingNote ?? existing?.quotaRemainingNote,
    currentTaskId: existing?.currentTaskId,
  };
  if (idx >= 0) {
    store.registeredAgents[idx] = agent;
  } else {
    store.registeredAgents.unshift(agent);
  }
  store.auditLog.unshift({
    id: `audit_${Date.now()}`,
    action: 'agent_registered',
    actor: agent.name,
    timestamp: now,
    summary: `Registered ${agent.toolKind} agent "${agent.name}" (${agent.roles.length} roles).`,
  });
  store.auditLog = store.auditLog.slice(0, 150);
  saveStore(store);
  return agent;
}

export function heartbeatAgent(
  workerIdOrName: string,
  currentTaskId?: string,
  quotaRemainingNote?: string,
): RegisteredAgent | null {
  const store = loadStore();
  const needle = workerIdOrName.trim().toLowerCase();
  const idx = store.registeredAgents.findIndex(
    (a) => a.workerId.toLowerCase() === needle || a.name.toLowerCase() === needle,
  );
  if (idx < 0) return null;
  const prev = store.registeredAgents[idx];
  const updated: RegisteredAgent = {
    ...prev,
    lastHeartbeatAt: new Date().toISOString(),
    status: prev.status === 'paused' ? 'paused' : currentTaskId ? 'busy' : 'online',
    currentTaskId: currentTaskId ?? prev.currentTaskId,
    quotaRemainingNote: quotaRemainingNote ?? prev.quotaRemainingNote,
  };
  store.registeredAgents[idx] = updated;
  saveStore(store);
  return updated;
}

export function incrementAgentStats(workerIdOrName: string, success: boolean): void {
  const store = loadStore();
  const needle = workerIdOrName.trim().toLowerCase();
  const idx = store.registeredAgents.findIndex(
    (a) => a.workerId.toLowerCase() === needle || a.name.toLowerCase() === needle,
  );
  if (idx < 0) return;
  const prev = store.registeredAgents[idx];
  store.registeredAgents[idx] = {
    ...prev,
    lastHeartbeatAt: new Date().toISOString(),
    status: prev.status === 'paused' ? 'paused' : 'online',
    currentTaskId: undefined,
    tasksCompleted: success ? prev.tasksCompleted + 1 : prev.tasksCompleted,
    tasksFailed: success ? prev.tasksFailed : prev.tasksFailed + 1,
  };
  saveStore(store);
}

export function setAgentStatus(
  workerId: string,
  status: RegisteredAgent['status'],
): RegisteredAgent | null {
  const store = loadStore();
  const idx = store.registeredAgents.findIndex(
    (a) => a.workerId.toLowerCase() === workerId.trim().toLowerCase(),
  );
  if (idx < 0) return null;
  store.registeredAgents[idx] = {
    ...store.registeredAgents[idx],
    status,
    lastHeartbeatAt: new Date().toISOString(),
  };
  saveStore(store);
  return store.registeredAgents[idx];
}

export function rejectOrRequestRevision(
  chapterId: string,
  action: 'reject' | 'request_revision',
  reason: string,
  actor = 'Admin Reviewer',
): { ok: true; chapter: CmsChapter } | { ok: false; status: number; message: string } {
  const cleanReason = reason.trim();
  if (cleanReason.length < 3) {
    return { ok: false, status: 400, message: 'Provide clear feedback/reason (min 3 characters).' };
  }
  const store = loadStore();
  const idx = store.chapters.findIndex((c) => c.chapterId === chapterId);
  if (idx < 0) {
    return { ok: false, status: 404, message: `Chapter "${chapterId}" not found.` };
  }
  const existing = store.chapters[idx];
  const now = new Date().toISOString();
  const updated: CmsChapter = {
    ...existing,
    publicationStatus: 'draft',
    reviewStage: action === 'reject' ? 'rejected' : 'revision_requested',
    rejectionReason: action === 'reject' ? cleanReason : undefined,
    revisionFeedback: action === 'request_revision' ? cleanReason : existing.revisionFeedback,
    updatedAt: now,
  };
  store.chapters[idx] = updated;

  // If requesting revision and linked job exists, attach feedback and reopen Phase 4 or Phase 6 task
  if (action === 'request_revision' && existing.lastJobId) {
    const jIdx = store.productionJobs.findIndex((j) => j.id === existing.lastJobId);
    if (jIdx >= 0) {
      const job = store.productionJobs[jIdx];
      const conceptTaskIdx = job.tasks.findIndex((t) => t.phase === 4);
      if (conceptTaskIdx >= 0) {
        job.tasks[conceptTaskIdx] = {
          ...job.tasks[conceptTaskIdx],
          status: 'queued',
          feedbackNotes: cleanReason,
          priority: 10,
        };
      }
      job.status = 'waiting_external';
      job.alerts.unshift(`Owner requested revision: ${cleanReason}`);
      store.productionJobs[jIdx] = job;
    }
  }

  store.auditLog.unshift({
    id: `audit_${Date.now()}`,
    action: action === 'reject' ? 'rejected' : 'revision_requested',
    chapterId,
    actor,
    timestamp: now,
    summary: `${action === 'reject' ? 'Rejected' : 'Requested revision on'} "${existing.title}": ${cleanReason}`,
  });
  store.auditLog = store.auditLog.slice(0, 150);
  saveStore(store);
  return { ok: true, chapter: updated };
}

export function listPublishHistory(chapterId?: string): PublishHistoryEntry[] {
  const list = loadStore().publishHistory;
  return chapterId ? list.filter((h) => h.chapterId === chapterId) : list;
}

export function rollbackChapterVersion(
  chapterId: string,
  targetVersion: number,
  actor = 'Admin',
): { ok: true; chapter: CmsChapter } | { ok: false; status: number; message: string } {
  const store = loadStore();
  const entry = store.publishHistory.find(
    (h) => h.chapterId === chapterId && h.packVersion === targetVersion && h.snapshot,
  );
  if (!entry || !entry.snapshot) {
    return {
      ok: false,
      status: 404,
      message: `No published snapshot found for "${chapterId}" v${targetVersion}.`,
    };
  }
  const now = new Date().toISOString();
  const idx = store.chapters.findIndex((c) => c.chapterId === chapterId);
  const currentMaxVersion = idx >= 0 ? store.chapters[idx].packVersion : targetVersion;
  const restored: CmsChapter = {
    ...JSON.parse(JSON.stringify(entry.snapshot)),
    packVersion: currentMaxVersion + 1,
    publicationStatus: 'published',
    reviewStage: 'published',
    updatedAt: now,
  };
  if (idx >= 0) {
    store.chapters[idx] = restored;
  } else {
    store.chapters.unshift(restored);
  }
  store.publishHistory.unshift({
    id: `pub_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
    chapterId: restored.chapterId,
    packVersion: restored.packVersion,
    checksumSha256: computeChapterChecksum(restored),
    publishedBy: actor,
    publishedAt: now,
    target: 'cloud_store',
    note: `Rolled back to snapshot v${targetVersion} (published as v${restored.packVersion}).`,
    snapshot: JSON.parse(JSON.stringify(restored)) as CmsChapter,
  });
  store.auditLog.unshift({
    id: `audit_${Date.now()}`,
    action: 'rolled_back',
    chapterId,
    actor,
    timestamp: now,
    summary: `Rolled back "${restored.title}" from v${targetVersion} into live v${restored.packVersion}.`,
  });
  store.auditLog = store.auditLog.slice(0, 150);
  saveStore(store);
  return { ok: true, chapter: restored };
}

export function computeAdminOverviewMetrics(): AdminOverviewMetrics {
  const store = loadStore();
  const chapters = store.chapters;
  const reportsByChapter = new Map(store.verificationReports.map((r) => [r.chapterId, r]));

  const subjectKeys = new Set(chapters.map((c) => `${c.grade}:${c.subjectId}`));
  const totalConcepts = chapters.reduce((s, c) => s + c.concepts.length, 0);
  const totalLessons = chapters.reduce(
    (s, c) =>
      s +
      c.concepts.reduce(
        (cs, concept) => cs + Math.max(1, concept.microCards?.length ?? 0),
        0,
      ),
    0,
  );
  const totalQuestions = chapters.reduce((s, c) => s + c.questions.length, 0);
  const totalExams = store.examBlueprints.length;
  const uploadedBooks = store.books.length;

  const pendingProduction = store.productionJobs.filter((j) =>
    ['queued', 'running', 'waiting_external'].includes(j.status),
  ).length;
  const completedJobs = store.productionJobs.filter((j) => j.status === 'completed').length;
  const failedJobs = store.productionJobs.filter((j) =>
    ['failed', 'escalated'].includes(j.status),
  ).length;

  const nowMs = Date.now();
  const activeAgents = store.registeredAgents.filter((a) => {
    if (a.status === 'paused' || a.status === 'offline') return false;
    const ageMs = nowMs - new Date(a.lastHeartbeatAt).getTime();
    return ageMs <= 30 * 60 * 1000;
  }).length;

  const drafts = chapters.filter((c) => c.publicationStatus !== 'published');
  let verifiedDraftsCount = 0;
  let flaggedDraftsCount = 0;
  for (const ch of drafts) {
    const rep = reportsByChapter.get(ch.chapterId);
    const isVerified =
      ch.reviewStage === 'independently_reviewed' ||
      ch.reviewStage === 'human_approved' ||
      (rep?.overallPassed ?? false);
    const isFlagged =
      ch.reviewStage === 'rejected' ||
      ch.reviewStage === 'revision_requested' ||
      (rep ? !rep.overallPassed : false);
    if (isVerified) verifiedDraftsCount += 1;
    else if (isFlagged) flaggedDraftsCount += 1;
  }

  const publishedContent = chapters.filter((c) => c.publicationStatus === 'published').length;
  const quarantinedCount = store.quarantinedSubmissions.filter((q) => q.status === 'quarantined').length;

  return {
    totalSubjects: subjectKeys.size,
    totalChapters: chapters.length,
    totalConcepts,
    totalLessons,
    totalQuestions,
    totalExams,
    uploadedBooks,
    pendingProduction,
    activeAgents,
    completedJobs,
    failedJobs,
    verifiedDraftsCount,
    flaggedDraftsCount,
    quarantinedCount,
    pendingApprovals: drafts.length,
    publishedContent,
  };
}

// -----------------------------------------------------------------------------
// Quarantine Queue, Idempotency Keys, Component Approval & Exam Scoring
// -----------------------------------------------------------------------------

export function checkIdempotencyKey(
  key: string | undefined,
  endpoint: string,
): { status: number; body: Record<string, unknown> } | null {
  const clean = key?.trim();
  if (!clean) return null;
  const match = loadStore().processedIdempotencyKeys.find(
    (r) => r.key === clean && r.endpoint === endpoint,
  );
  return match ? { status: match.status, body: match.body } : null;
}

export function saveIdempotencyResult(
  key: string | undefined,
  endpoint: string,
  status: number,
  body: Record<string, unknown>,
): void {
  const clean = key?.trim();
  if (!clean) return;
  const store = loadStore();
  store.processedIdempotencyKeys = [
    {
      key: clean,
      endpoint,
      timestamp: new Date().toISOString(),
      status,
      body,
    },
    ...store.processedIdempotencyKeys.filter((r) => !(r.key === clean && r.endpoint === endpoint)),
  ].slice(0, 300);
  saveStore(store);
}

export function listQuarantinedSubmissions(): QuarantinedSubmission[] {
  return loadStore().quarantinedSubmissions;
}

export function recordQuarantinedSubmission(input: {
  sourceEndpoint: string;
  workerId: string;
  chapterId?: string;
  jobId?: string;
  taskId?: string;
  reason: string;
  validationErrors: string[];
  rawPayload: unknown;
}): QuarantinedSubmission {
  const store = loadStore();
  let excerpt = '';
  try {
    excerpt = JSON.stringify(input.rawPayload ?? {}).slice(0, 1200);
  } catch {
    excerpt = String(input.rawPayload ?? '').slice(0, 1200);
  }
  const entry: QuarantinedSubmission = {
    id: `quar_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`,
    sourceEndpoint: input.sourceEndpoint,
    workerId: sanitizeUntrustedText(input.workerId || 'unknown-worker'),
    chapterId: input.chapterId,
    jobId: input.jobId,
    taskId: input.taskId,
    reason: sanitizeUntrustedText(input.reason),
    validationErrors: input.validationErrors.slice(0, 20),
    quarantinedAt: new Date().toISOString(),
    payloadExcerpt: excerpt,
    status: 'quarantined',
  };
  store.quarantinedSubmissions = [entry, ...store.quarantinedSubmissions].slice(0, 120);
  store.auditLog.unshift({
    id: `audit_${Date.now()}_${Math.random().toString(36).slice(2, 5)}`,
    action: 'submission_quarantined',
    chapterId: input.chapterId,
    actor: entry.workerId,
    timestamp: entry.quarantinedAt,
    summary: `Quarantined invalid payload on ${input.sourceEndpoint}: ${entry.validationErrors[0] || entry.reason}`,
  });
  store.auditLog = store.auditLog.slice(0, 200);
  saveStore(store);
  return entry;
}

export function resolveQuarantinedSubmission(quarantineId: string): boolean {
  const store = loadStore();
  const idx = store.quarantinedSubmissions.findIndex((q) => q.id === quarantineId);
  if (idx < 0) return false;
  store.quarantinedSubmissions[idx] = {
    ...store.quarantinedSubmissions[idx],
    status: 'resolved',
  };
  saveStore(store);
  return true;
}

export function approveChapterComponent(
  chapterId: string,
  componentType: 'concept' | 'question',
  componentId: string,
  reviewedBy: string,
): { ok: true; chapter: CmsChapter } | { ok: false; status: number; message: string } {
  const reviewer = reviewedBy.trim();
  if (!reviewer) {
    return { ok: false, status: 400, message: 'Reviewer name is required for component approval.' };
  }
  const store = loadStore();
  const idx = store.chapters.findIndex((c) => c.chapterId === chapterId);
  if (idx < 0) {
    return { ok: false, status: 404, message: `Chapter "${chapterId}" not found.` };
  }
  const ch = store.chapters[idx];
  const now = new Date().toISOString();
  let found = false;
  const approvedConceptIds = new Set(ch.approvedConceptIds ?? []);
  const approvedQuestionIds = new Set(ch.approvedQuestionIds ?? []);

  const concepts = ch.concepts.map((c) => {
    if (componentType === 'concept' && c.id === componentId) {
      found = true;
      approvedConceptIds.add(c.id);
      return { ...c, reviewStatus: 'approved' as PublicationStatus, reviewedBy: reviewer };
    }
    return c;
  });

  const questions = ch.questions.map((q) => {
    if (componentType === 'question' && q.id === componentId) {
      found = true;
      approvedQuestionIds.add(q.id);
      return {
        ...q,
        publicationStatus: 'approved' as PublicationStatus,
        origin: q.origin === 'ai_generated_draft' ? ('ai_reviewed' as QuestionOrigin) : q.origin,
        reviewedBy: reviewer,
      };
    }
    return q;
  });

  if (!found) {
    return { ok: false, status: 404, message: `${componentType} "${componentId}" not found in chapter "${chapterId}".` };
  }

  const allApproved =
    concepts.every((c) => c.reviewStatus === 'approved' || c.reviewStatus === 'published') &&
    questions.every((q) => q.publicationStatus === 'approved' || q.publicationStatus === 'published');

  const updated: CmsChapter = {
    ...ch,
    concepts,
    questions,
    approvedConceptIds: Array.from(approvedConceptIds),
    approvedQuestionIds: Array.from(approvedQuestionIds),
    reviewStage: allApproved ? 'human_approved' : ch.reviewStage,
    updatedAt: now,
  };
  store.chapters[idx] = updated;
  store.auditLog.unshift({
    id: `audit_${Date.now()}_${Math.random().toString(36).slice(2, 5)}`,
    action: 'component_approved',
    chapterId,
    actor: reviewer,
    timestamp: now,
    summary: `Approved ${componentType} "${componentId}" in chapter "${ch.title}" (${approvedConceptIds.size}/${concepts.length} concepts, ${approvedQuestionIds.size}/${questions.length} questions).`,
  });
  store.auditLog = store.auditLog.slice(0, 200);
  saveStore(store);
  return { ok: true, chapter: updated };
}

export function scorePublishedExam(
  examId: string,
  req: ExamScoreRequest,
): { ok: true; result: ExamScoreResponse } | { ok: false; status: number; message: string } {
  const submissionUuid = String(req.submissionUuid ?? '').trim();
  if (!submissionUuid || submissionUuid.length < 6) {
    return { ok: false, status: 400, message: 'submissionUuid (min 6 chars) is required for idempotent exam scoring.' };
  }

  const store = loadStore();
  const replay = store.examSubmissions.find(
    (s) => s.examId === examId && s.submissionUuid === submissionUuid,
  );
  if (replay) {
    return { ok: true, result: { ...replay, idempotentReplay: true } };
  }

  const exam = store.examBlueprints.find((e) => e.id === examId);
  if (!exam || exam.publicationStatus !== 'published') {
    return { ok: false, status: 404, message: `Published exam "${examId}" not found.` };
  }

  const questionMap = new Map<string, CmsQuestion>();
  const conceptTitleMap = new Map<string, string>();
  for (const ch of store.chapters) {
    for (const c of ch.concepts) {
      conceptTitleMap.set(c.id, c.title);
    }
    for (const q of ch.questions) {
      questionMap.set(q.id, q);
    }
  }

  const answerLookup = new Map(req.answers.map((a) => [a.questionId, a]));
  const items: GradedExamItem[] = [];
  const sectionBreakdown: { label: string; obtained: number; possible: number }[] = [];
  const topicAgg = new Map<
    string,
    { topicId: string; conceptId: string; conceptTitle: string; missed: number; total: number }
  >();

  let scoreObtained = 0;
  let totalPossible = 0;

  for (const section of exam.sections) {
    let secObtained = 0;
    let secPossible = 0;

    for (const qId of section.questionIds) {
      const q = questionMap.get(qId);
      const marksPossible = section.marksEach || q?.marks || 1;
      secPossible += marksPossible;
      totalPossible += marksPossible;

      const userAns = answerLookup.get(qId);
      if (!q) {
        items.push({
          questionId: qId,
          questionType: section.questionType,
          marksPossible,
          marksAwarded: 0,
          isCorrect: false,
          correctAnswer: '',
          explanation: 'Question not found in current pack.',
        });
        continue;
      }

      let marksAwarded = 0;
      let isCorrect = false;
      const isWritten = q.questionType === 'short_answer' || q.questionType === 'long_answer';

      if (isWritten) {
        const clampedSelf = Math.max(0, Math.min(marksPossible, Number(userAns?.selfScore ?? 0)));
        marksAwarded = Number.isFinite(clampedSelf) ? clampedSelf : 0;
        isCorrect = marksAwarded >= marksPossible * 0.5;
      } else if (q.questionType === 'matching') {
        const expectedCanonical = (q.matchingPairs ?? [])
          .map((p) => `${p.left}->${p.right}`.toLowerCase().replace(/\s+/g, ''))
          .sort()
          .join('||');
        const userCanonical = String(userAns?.response ?? '')
          .split('||')
          .map((pair) => pair.toLowerCase().replace(/\s+/g, ''))
          .filter(Boolean)
          .sort()
          .join('||');
        isCorrect = Boolean(expectedCanonical) && userCanonical === expectedCanonical;
        marksAwarded = isCorrect ? marksPossible : 0;
      } else {
        isCorrect = isAnswerMatch(userAns?.response ?? '', q.correctAnswer, q.questionType);
        marksAwarded = isCorrect ? marksPossible : 0;
      }

      secObtained += marksAwarded;
      scoreObtained += marksAwarded;

      items.push({
        questionId: q.id,
        questionType: q.questionType,
        marksPossible,
        marksAwarded,
        isCorrect,
        correctAnswer: q.correctAnswer,
        explanation: q.explanation,
      });

      const aggKey = q.conceptId || q.topicId || q.chapterId;
      const prev = topicAgg.get(aggKey) ?? {
        topicId: q.topicId,
        conceptId: q.conceptId,
        conceptTitle: conceptTitleMap.get(q.conceptId) ?? q.subjectId,
        missed: 0,
        total: 0,
      };
      prev.total += 1;
      if (!isCorrect) prev.missed += 1;
      topicAgg.set(aggKey, prev);
    }

    sectionBreakdown.push({
      label: section.label,
      obtained: Math.round(secObtained * 100) / 100,
      possible: secPossible,
    });
  }

  const weakTopics: WeakTopicInsight[] = Array.from(topicAgg.values())
    .map((t) => ({
      topicId: t.topicId,
      conceptId: t.conceptId,
      conceptTitle: t.conceptTitle,
      missedCount: t.missed,
      totalCount: t.total,
      accuracyPercent: Math.round(((t.total - t.missed) / Math.max(1, t.total)) * 100),
    }))
    .filter((t) => t.missedCount > 0)
    .sort((a, b) => a.accuracyPercent - b.accuracyPercent);

  const denominator = totalPossible > 0 ? totalPossible : exam.totalMarks;
  const response: ExamScoreResponse = {
    submissionUuid,
    examId: exam.id,
    examTitle: exam.title,
    scoreObtained: Math.round(scoreObtained * 100) / 100,
    totalMarks: denominator,
    percentage: Math.round((scoreObtained / Math.max(1, denominator)) * 100),
    gradedCount: items.length,
    sectionBreakdown,
    weakTopics,
    items,
    scoredAt: new Date().toISOString(),
    idempotentReplay: false,
  };

  store.examSubmissions = [response, ...store.examSubmissions].slice(0, 200);
  saveStore(store);
  return { ok: true, result: response };
}

export function buildAgentRulesMarkdown(baseUrl: string): string {
  const cleanBase = baseUrl.replace(/\/+$/, '');
  return `# Roshan Study — Freebuff, OpenCode & Autonomous AI Agent Kit

> **Who this guide is for:** **Freebuff CLI**, **OpenCode**, Cursor, Claude Code, Antigravity, Codex, or any MCP-enabled AI agent acting inside Roshan Study's **30-role / 18-skill** educational content factory for Grades 9–12 (8 KPK BISE boards, English medium) at **$0 paid API cost**.

## 1. Zero-Cost Architecture: MCP vs REST API

- **Use MCP (\`${cleanBase}/api/mcp\`)** if you are running **Freebuff CLI**, **OpenCode**, **Cursor**, or **Claude Code**. Agents call \`get_agent_skills\`, \`claim_next_task\`, \`renew_task_lease\`, \`get_book_source\`, \`validate_chapter_pack\`, and \`submit_task_result\`.
- **Use REST API (\`${cleanBase}/api/agent/*\` or \`${cleanBase}/api/verifier/*\`)** for automated scripts or custom Freebuff/OpenCode loops.

### Freebuff Setup (\`.agents/mcp.json\` + Skill)
\`\`\`json
{
  "mcpServers": {
    "roshan-study": {
      "url": "${cleanBase}/api/mcp",
      "headers": {
        "Authorization": "Bearer <YOUR_AGENT_ACCESS_TOKEN>"
      }
    }
  }
}
\`\`\`

### OpenCode Setup (\`opencode.json\`)
\`\`\`json
{
  "mcp": {
    "roshan-study": {
      "type": "remote",
      "url": "${cleanBase}/api/mcp",
      "headers": {
        "Authorization": "Bearer <YOUR_AGENT_ACCESS_TOKEN>"
      },
      "enabled": true
    }
  }
}
\`\`\`

---

## 2. Independent Verification & Non-Negotiable Quality Rules

1. **Author vs. Verifier Separation (Strict):** The same \`workerName\` / \`workerId\` that authored a chapter draft (\`authorWorkerId\`) is **blocked by the server** from claiming Phase-6 verification tasks for that chapter. Use separate worker identities or scoped Verifier tokens!
2. **KPK BISE Alignment & Track Isolation:** Supported Boards: Peshawar, Mardan, Swat, Malakand, Abbottabad, Kohat, Bannu, D.I. Khan (KPECTB English-medium textbooks). Never assign \`groupId: "admission"\` on an \`ssc_hssc\` chapter.
3. **All 8 Student Practice Question Formats:**
   - \`mcq\`: 4 distinct options + verbatim \`correctAnswer\` + \`optionMisconceptions\`.
   - \`multi_select\`: 3+ options + \`multiSelectAnswers\` array.
   - \`true_false\`: options \`["True","False"]\` + \`correctAnswer\`.
   - \`fill_in\`: concise verbatim answer in \`correctAnswer\`.
   - \`matching\`: >= 2 \`matchingPairs: [{left, right}]\`.
   - \`numerical\`: **6-Step KPK Board Method**: \`given\`, \`required\`, \`formula\`, \`substitution\`, \`calculation\`, \`answerWithUnit\`.
   - \`short_answer\` / \`long_answer\`: explicit weighted \`markingPoints\`.
4. **Offline Interactive Visuals ($0 Runtime):** Include \`MotionGraphicSpec\` (0..100 coords, \`formulaLatex\`) and \`GraphSpec\` (\`xMax > xMin\`, \`yMax > yMin\`).
5. **Human Publish Gate Only:** External agents can never publish live content. Approved content awaits human review inside Admin Approval Inbox.

---

## 3. MCP & REST Endpoints

- **Agent Discovery & Lease Lifecycle:**
  - \`POST ${cleanBase}/api/agent/register\` — register workerId, toolKind, roles, capabilities
  - \`GET  ${cleanBase}/api/agent/capabilities\` — inspect 30 roles, active registry, and rate limits
  - \`GET  ${cleanBase}/api/agent/skills\` — fetch all 18 structured Skill Specs
  - \`GET  ${cleanBase}/api/agent/instructions\` — full rules & JSON template
  - \`GET  ${cleanBase}/api/agent/books/:bookId/source\` — download PDF or page-by-page text
  - \`POST ${cleanBase}/api/agent/tasks/claim-next\` — priority-ordered claim (enforces Author != Verifier)
  - \`POST ${cleanBase}/api/agent/tasks/:taskId/heartbeat\` — renew 15-min lease
  - \`POST ${cleanBase}/api/agent/tasks/:taskId/submit\` — submit draft, exam, or verification
  - \`POST ${cleanBase}/api/agent/tasks/:taskId/error\` & \`/retry\` — report failure (max 2 retries)
  - \`GET  ${cleanBase}/api/agent/chapters/:chapterId/feedback\` — inspect owner revision feedback
  - \`POST ${cleanBase}/api/agent/validate\` — dry-run strict validation
  - \`POST ${cleanBase}/api/agent/chapters/draft\` & \`POST ${cleanBase}/api/agent/files/upload\`
- **Independent Verifier Endpoints (Scoped Token or Independent Worker):**
  - \`GET  ${cleanBase}/api/verifier/queue\`
  - \`POST ${cleanBase}/api/verifier/submit\`
`;
}

