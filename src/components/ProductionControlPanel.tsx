import { useEffect, useState, type ChangeEvent } from 'react';
import {
  AlertTriangle,
  Bot,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  FileText,
  Lock,
  Pause,
  Play,
  Plus,
  RefreshCw,
  ShieldCheck,
  Sparkles,
  Unlock,
  Wrench,
  X,
} from 'lucide-react';
import type {
  AcademicGroupId,
  AdminOverviewMetrics,
  CmsChapter,
  ExamBlueprint,
  ExecutionMode,
  MonitoringIssueReport,
  ProductionJob,
  ProductionScope,
  QuarantinedSubmission,
  RegisteredAgent,
  VerificationReport,
  WorkspaceSecuritySettings,
} from '../types/cms';

interface CloudAuditEntry {
  id: string;
  action: string;
  chapterId?: string;
  actor: string;
  timestamp: string;
  summary: string;
}

interface OpsOverviewPayload {
  metrics?: AdminOverviewMetrics;
  jobs: ProductionJob[];
  verificationReports: VerificationReport[];
  exams: ExamBlueprint[];
  issues: MonitoringIssueReport[];
  pendingExternalTasks: { id: string; role: string; title: string }[];
  quarantinedSubmissions?: QuarantinedSubmission[];
  auditLog?: CloudAuditEntry[];
  registeredAgents?: RegisteredAgent[];
  securitySettings?: WorkspaceSecuritySettings;
  cloudflare: { configured: boolean; apiUrl: string };
  aiReady: boolean;
}

interface ProductionControlPanelProps {
  chapters: CmsChapter[];
  onRefreshChapters: () => Promise<void>;
  onOpenDraftInbox: () => void;
  onInspectChapter: (chapterId: string) => void;
}

function readFileAsBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = typeof reader.result === 'string' ? reader.result : '';
      const commaIdx = result.indexOf(',');
      resolve(commaIdx >= 0 ? result.slice(commaIdx + 1) : result);
    };
    reader.onerror = () => reject(new Error('Could not read selected file.'));
    reader.readAsDataURL(file);
  });
}

const JOB_STATUS_TONE: Record<ProductionJob['status'], string> = {
  queued: 'text-neutral-700 bg-neutral-100 dark:text-neutral-200 dark:bg-neutral-800',
  running: 'text-[#1B6B46] bg-[#D6F0E1] dark:text-[#6CD19B] dark:bg-[#174F33]',
  waiting_external: 'text-[#1B6B46] bg-[#D6F0E1]/60 dark:text-[#6CD19B] dark:bg-[#174F33]/50',
  paused: 'text-[#B4690E] bg-[#FEF4E6] dark:text-[#E6A756] dark:bg-[#3B2810]',
  awaiting_approval: 'text-[#1E7E4E] bg-[#D6F0E1] dark:text-[#6CD19B] dark:bg-[#174F33]',
  escalated: 'text-[#B9382C] bg-[#FCECEA] dark:text-[#F28B82] dark:bg-[#3A1B18]',
  completed: 'text-white bg-[#1B6B46]',
  failed: 'text-[#B9382C] bg-[#FCECEA] dark:text-[#F28B82] dark:bg-[#3A1B18]',
  cancelled: 'text-neutral-500 bg-neutral-100 dark:text-neutral-400 dark:bg-neutral-800',
};

export function ProductionControlPanel({
  chapters,
  onRefreshChapters,
  onOpenDraftInbox,
  onInspectChapter,
}: ProductionControlPanelProps) {
  const [ops, setOps] = useState<OpsOverviewPayload | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [expandedJobId, setExpandedJobId] = useState<string | null>(null);
  const [wizardOpen, setWizardOpen] = useState<boolean>(false);
  const [feedback, setFeedback] = useState<string>('');
  const [errorMsg, setErrorMsg] = useState<string>('');

  // Production Wizard state ($0 external queue strictly defaulted)
  const [wGrade, setWGrade] = useState<9 | 10 | 11 | 12>(9);
  const [wGroup, setWGroup] = useState<AcademicGroupId>('ssc_science');
  const [wSubject, setWSubject] = useState('Physics (English Medium)');
  const [wChapterNum, setWChapterNum] = useState(3);
  const [wChapterTitle, setWChapterTitle] = useState('Dynamics');
  const [wSourceBook, setWSourceBook] = useState('KPECTB Physics Grade 9 (English Medium)');
  const [wScope, setWScope] = useState<ProductionScope>('full_chapter_pack');
  const [wExecMode, setWExecMode] = useState<ExecutionMode>('external_agent_queue');
  const [wExtractText, setWExtractText] = useState(
    'Newton Laws of Motion: Inertia, F = ma, momentum p = mv, action-reaction pairs, friction and circular motion.',
  );
  const [wPdfBase64, setWPdfBase64] = useState<string>('');
  const [wPdfName, setWPdfName] = useState<string>('');
  const [wPermission, setWPermission] = useState(true);
  const [wTrustedAutoApprove, setWTrustedAutoApprove] = useState(false);
  const [wBusy, setWBusy] = useState(false);
  const [structureRejectJobId, setStructureRejectJobId] = useState<string | null>(null);
  const [structureRejectNote, setStructureRejectNote] = useState('');
  const [auditSearch, setAuditSearch] = useState('');
  const [auditActionFilter, setAuditActionFilter] = useState('');

  // Issue reporter state
  const [issueChapterId, setIssueChapterId] = useState<string>(chapters[0]?.chapterId ?? '');
  const [issueCategory, setIssueCategory] =
    useState<MonitoringIssueReport['category']>('answer_error');
  const [issueDesc, setIssueDesc] = useState('');
  const [reviewerName, setReviewerName] = useState('KPK Subject Reviewer');

  const fetchOverview = async () => {
    try {
      const res = await fetch('/api/cms/ops-overview');
      if (!res.ok) return;
      const data = (await res.json()) as OpsOverviewPayload;
      setOps(data);
    } catch {
      // ignore transient error
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void fetchOverview();
  }, []);

  useEffect(() => {
    const hasActiveRun = ops?.jobs.some((j) => j.status === 'running' || j.status === 'queued');
    if (!hasActiveRun) return;
    const timer = setInterval(() => {
      void fetchOverview();
      void onRefreshChapters();
    }, 3000);
    return () => clearInterval(timer);
  }, [ops?.jobs, onRefreshChapters]);

  const handleTogglePaidAi = async () => {
    setErrorMsg('');
    setFeedback('');
    const nextEnabled = !ops?.securitySettings?.allowOptionalPaidServerAi;
    const res = await fetch('/api/cms/security/paid-ai', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ enabled: nextEnabled, actor: reviewerName || 'Owner' }),
    });
    if (res.ok) {
      setFeedback(
        nextEnabled
          ? 'Optional Server Gemini endpoint unlocked by owner.'
          : 'Zero-Cost Mode enforced: paid server AI routes locked ($0 default).',
      );
      await fetchOverview();
    }
  };

  const handleAgentStatusToggle = async (agent: RegisteredAgent) => {
    const nextStatus = agent.status === 'paused' ? 'online' : 'paused';
    const res = await fetch(`/api/cms/agents/${encodeURIComponent(agent.workerId)}/status`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: nextStatus }),
    });
    if (res.ok) {
      setFeedback(`Agent "${agent.name}" set to ${nextStatus}.`);
      await fetchOverview();
    }
  };

  const handleWizardPdf = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 12 * 1024 * 1024) {
      setErrorMsg('PDF exceeds 12 MB limit. Split chapter PDF before uploading.');
      return;
    }
    const b64 = await readFileAsBase64(file);
    setWPdfBase64(b64);
    setWPdfName(file.name);
  };

  const handleStartJob = async () => {
    setErrorMsg('');
    setFeedback('');
    if (!wSubject.trim() || !wChapterTitle.trim()) {
      setErrorMsg('Subject name and chapter title are required.');
      return;
    }
    if (!wPdfBase64 && wExtractText.trim().length < 20) {
      setErrorMsg('Upload a chapter PDF or enter textbook source notes before starting.');
      return;
    }
    setWBusy(true);
    try {
      const res = await fetch('/api/cms/jobs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          grade: wGrade,
          groupId: wGroup,
          subjectName: wSubject,
          chapterNumber: wChapterNum,
          chapterTitle: wChapterTitle,
          sourceBook: wSourceBook,
          extractText: wExtractText,
          pdfBase64: wPdfBase64 || undefined,
          pdfFilename: wPdfName || undefined,
          permissionVerified: wPermission,
          trustedAutoApproveStructure: wTrustedAutoApprove,
          scope: wScope,
          executionMode: wExecMode,
        }),
      });
      const data = (await res.json()) as { job?: ProductionJob; message?: string };
      if (!res.ok || !data.job) {
        setErrorMsg(data.message || 'Could not start production job.');
        return;
      }
      setWizardOpen(false);
      setExpandedJobId(data.job.id);
      setFeedback(
        `Queued ${data.job.tasks.length} task(s) in $0 Freebuff/OpenCode Pipeline (${data.job.id}).`,
      );
      await fetchOverview();
    } catch {
      setErrorMsg('Network error starting production job.');
    } finally {
      setWBusy(false);
    }
  };

  const handleJobControl = async (jobId: string, action: 'pause' | 'resume' | 'cancel') => {
    await fetch(`/api/cms/jobs/${encodeURIComponent(jobId)}/${action}`, { method: 'POST' });
    await fetchOverview();
  };

  const handleApproveStructure = async (jobId: string) => {
    setErrorMsg('');
    setFeedback('');
    const res = await fetch(`/api/cms/jobs/${encodeURIComponent(jobId)}/approve-structure`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ reviewedBy: reviewerName || 'Owner Reviewer' }),
    });
    const data = (await res.json()) as { message?: string };
    if (!res.ok) {
      setErrorMsg(data.message || 'Could not approve proposed structure.');
      return;
    }
    setFeedback('Structure approved — Phase 4 content generation tasks unlocked.');
    await fetchOverview();
  };

  const handleRejectStructure = async (jobId: string) => {
    setErrorMsg('');
    setFeedback('');
    const res = await fetch(`/api/cms/jobs/${encodeURIComponent(jobId)}/reject-structure`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        reviewedBy: reviewerName || 'Owner Reviewer',
        notes: structureRejectNote.trim() || 'Refine chapter topics, objectives, and prerequisites.',
      }),
    });
    const data = (await res.json()) as { message?: string };
    if (!res.ok) {
      setErrorMsg(data.message || 'Could not reject structure proposal.');
      return;
    }
    setStructureRejectJobId(null);
    setStructureRejectNote('');
    setFeedback('Structure revision requested — Chapter Architect task re-queued.');
    await fetchOverview();
  };

  const handleResolveQuarantine = async (quarantineId: string) => {
    setErrorMsg('');
    const res = await fetch(`/api/cms/quarantine/${encodeURIComponent(quarantineId)}/resolve`, {
      method: 'POST',
    });
    if (res.ok) {
      setFeedback('Quarantined submission marked resolved.');
      await fetchOverview();
    } else {
      setErrorMsg('Could not resolve quarantine record.');
    }
  };

  const handlePublishExam = async (examId: string) => {
    setErrorMsg('');
    const res = await fetch(`/api/cms/exams/${encodeURIComponent(examId)}/approve-publish`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ reviewedBy: reviewerName }),
    });
    const data = (await res.json()) as { message?: string };
    if (!res.ok) {
      setErrorMsg(data.message || 'Could not publish exam.');
      return;
    }
    setFeedback('Approved & published exam blueprint to Student Exams.');
    await fetchOverview();
  };

  const handleLogIssue = async () => {
    setErrorMsg('');
    if (!issueChapterId || issueDesc.trim().length < 5) {
      setErrorMsg('Select a chapter and describe the issue (at least 5 characters).');
      return;
    }
    const res = await fetch('/api/cms/issues', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chapterId: issueChapterId,
        category: issueCategory,
        description: issueDesc.trim(),
        reportedBy: reviewerName || 'Owner Monitor',
      }),
    });
    if (res.ok) {
      setIssueDesc('');
      setFeedback('Issue alert logged in Monitoring Inbox.');
      await fetchOverview();
    }
  };

  const handleCreateFixDraft = async (issueId: string) => {
    setErrorMsg('');
    const res = await fetch(`/api/cms/issues/${encodeURIComponent(issueId)}/create-fix-draft`, {
      method: 'POST',
    });
    const data = (await res.json()) as { message?: string };
    if (!res.ok) {
      setErrorMsg(data.message || 'Could not create fix draft.');
      return;
    }
    setFeedback(data.message || 'Created new fix draft without altering live published chapter.');
    await Promise.all([fetchOverview(), onRefreshChapters()]);
  };

  const jobs = ops?.jobs ?? [];
  const agents = ops?.registeredAgents ?? [];
  const metrics = ops?.metrics;
  const paidAiEnabled = Boolean(ops?.securitySettings?.allowOptionalPaidServerAi);

  const kpiItems: { label: string; value: number; note: string; accent?: boolean }[] = [
    { label: 'Subjects', value: metrics?.totalSubjects ?? new Set(chapters.map((c) => c.subjectId)).size, note: 'Grades 9–12' },
    { label: 'Chapters', value: metrics?.totalChapters ?? chapters.length, note: 'All tracks' },
    {
      label: 'Concepts',
      value: metrics?.totalConcepts ?? chapters.reduce((s, c) => s + c.concepts.length, 0),
      note: '12-part structured',
    },
    { label: 'Guided Lessons', value: metrics?.totalLessons ?? 0, note: 'Micro-lesson decks' },
    {
      label: 'Questions',
      value: metrics?.totalQuestions ?? chapters.reduce((s, c) => s + c.questions.length, 0),
      note: '8 KPK formats',
    },
    { label: 'Exams', value: metrics?.totalExams ?? ops?.exams.length ?? 0, note: 'Board blueprints' },
    { label: 'Uploaded Books', value: metrics?.uploadedBooks ?? 0, note: 'PDF Vault + R2' },
    { label: 'Pending Production', value: metrics?.pendingProduction ?? ops?.pendingExternalTasks.length ?? 0, note: 'Task queue' },
    { label: 'Active Agents', value: metrics?.activeAgents ?? agents.filter((a) => a.status === 'online').length, note: 'Freebuff/OpenCode' },
    { label: 'Completed Jobs', value: metrics?.completedJobs ?? 0, note: 'Verified finished' },
    { label: 'Failed / Escalated', value: metrics?.failedJobs ?? 0, note: 'Needs review', accent: (metrics?.failedJobs ?? 0) > 0 },
    { label: 'Verified Drafts', value: metrics?.verifiedDraftsCount ?? 0, note: 'Author ≠ Verifier' },
    { label: 'Flagged Drafts', value: metrics?.flaggedDraftsCount ?? 0, note: 'Revisions / open issues' },
    {
      label: 'Quarantined',
      value: metrics?.quarantinedCount ?? ops?.quarantinedSubmissions?.filter((q) => q.status === 'quarantined').length ?? 0,
      note: 'Blocked invalid drafts',
      accent: (metrics?.quarantinedCount ?? 0) > 0,
    },
    {
      label: 'Pending Approvals',
      value: metrics?.pendingApprovals ?? chapters.filter((c) => c.publicationStatus !== 'published').length,
      note: `${metrics?.publishedContent ?? chapters.filter((c) => c.publicationStatus === 'published').length} published`,
    },
  ];

  return (
    <div className="space-y-6">
      {/* Control Header */}
      <div className="flex flex-wrap items-center justify-between gap-4 rounded-xl border border-neutral-200 bg-white p-5 dark:border-neutral-800 dark:bg-neutral-900">
        <div>
          <h2 className="font-display text-base font-bold text-neutral-900 dark:text-neutral-100">
            Admin Control Center &amp; 30-Role Autonomous Queue
          </h2>
          <p className="mt-0.5 text-xs text-neutral-500 dark:text-neutral-400">
            Cloud Target:{' '}
            <strong>
              {ops?.cloudflare.configured
                ? `Cloudflare D1 / R2 (${ops.cloudflare.apiUrl})`
                : 'Express Cloud Store + Local PDF Vault ($0 Mode)'}
            </strong>{' '}
            · Pending Agent Queue:{' '}
            <span className="font-mono-tabular font-semibold">
              {ops?.pendingExternalTasks.length ?? 0} task(s)
            </span>
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={onOpenDraftInbox}
            className="rounded-lg border border-neutral-200 px-3 py-2 text-xs font-semibold text-[#1B6B46] dark:border-neutral-700 dark:text-[#6CD19B]"
          >
            Open Approval Inbox ({metrics?.pendingApprovals ?? 0})
          </button>
          <button
            type="button"
            onClick={() => void fetchOverview()}
            className="inline-flex items-center gap-1.5 rounded-lg border border-neutral-200 px-3 py-2 text-xs font-semibold dark:border-neutral-700"
          >
            <RefreshCw className="h-3.5 w-3.5" />
            Refresh
          </button>
          <button
            type="button"
            onClick={() => setWizardOpen(true)}
            className="inline-flex items-center gap-1.5 rounded-lg bg-[#1B6B46] px-4 py-2 text-xs font-semibold text-white hover:bg-[#155537]"
          >
            <Plus className="h-3.5 w-3.5" />
            New Production Job
          </button>
        </div>
      </div>

      {/* Real 14-Metric Admin Overview Grid (Tabular Numerals) */}
      <div className="grid gap-3 sm:grid-cols-2 md:grid-cols-4 lg:grid-cols-7">
        {kpiItems.map((item) => (
          <div
            key={item.label}
            className="rounded-xl border border-neutral-200 bg-white p-3.5 dark:border-neutral-800 dark:bg-neutral-900"
          >
            <div className="text-[11px] font-medium text-neutral-500 dark:text-neutral-400">
              {item.label}
            </div>
            <div
              className={`font-mono-tabular mt-1 text-xl font-bold ${
                item.accent
                  ? 'text-[#B9382C] dark:text-[#F28B82]'
                  : 'text-neutral-900 dark:text-neutral-100'
              }`}
            >
              {item.value}
            </div>
            <div className="mt-0.5 text-[11px] text-neutral-500">{item.note}</div>
          </div>
        ))}
      </div>

      {/* Zero-Cost Paid AI Gate & Registered Agent Fleet */}
      <div className="grid gap-6 lg:grid-cols-[1fr_1.4fr]">
        <div className="rounded-xl border border-neutral-200 bg-white p-5 dark:border-neutral-800 dark:bg-neutral-900">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h3 className="text-sm font-bold text-neutral-900 dark:text-neutral-100">
                Zero-Cost Operations &amp; Paid AI Gate
              </h3>
              <p className="mt-1 text-xs leading-relaxed text-neutral-600 dark:text-neutral-300">
                Paid server Gemini generation is <strong>locked off ($0 default)</strong> so all
                content production runs through Freebuff CLI, OpenCode, or local PDF tools.
              </p>
            </div>
            {paidAiEnabled ? (
              <Unlock className="h-4 w-4 shrink-0 text-[#B4690E]" />
            ) : (
              <Lock className="h-4 w-4 shrink-0 text-[#1B6B46] dark:text-[#6CD19B]" />
            )}
          </div>

          <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-neutral-200 pt-3 text-xs dark:border-neutral-800">
            <span>
              Status:{' '}
              <strong
                className={
                  paidAiEnabled
                    ? 'text-[#B4690E] dark:text-[#E6A756]'
                    : 'text-[#1B6B46] dark:text-[#6CD19B]'
                }
              >
                {paidAiEnabled ? 'Optional Paid AI Unlocked' : 'Locked at $0 External-Agent Mode'}
              </strong>
            </span>
            <button
              type="button"
              onClick={() => void handleTogglePaidAi()}
              className="rounded-lg border border-neutral-200 px-3 py-1.5 font-semibold hover:bg-neutral-50 dark:border-neutral-700 dark:hover:bg-neutral-800"
            >
              {paidAiEnabled ? 'Lock to $0 Mode' : 'Unlock Optional Server AI'}
            </button>
          </div>
        </div>

        <div className="rounded-xl border border-neutral-200 bg-white p-5 dark:border-neutral-800 dark:bg-neutral-900">
          <div className="flex items-center justify-between border-b border-neutral-200 pb-2.5 dark:border-neutral-800">
            <h3 className="inline-flex items-center gap-1.5 text-sm font-bold text-neutral-900 dark:text-neutral-100">
              <Bot className="h-4 w-4 text-[#1B6B46] dark:text-[#6CD19B]" />
              Registered External Agents ({agents.length})
            </h3>
            <span className="text-[11px] text-neutral-500">Author ≠ Verifier enforced</span>
          </div>

          {agents.length === 0 ? (
            <p className="mt-3 text-xs text-neutral-500">
              No external agents registered yet. Connect Freebuff CLI or OpenCode in Content &amp;
              Inbox → Agent Bridge.
            </p>
          ) : (
            <div className="mt-2 divide-y divide-neutral-200 text-xs dark:divide-neutral-800">
              {agents.map((ag) => (
                <div
                  key={ag.workerId}
                  className="flex flex-wrap items-center justify-between gap-2 py-2.5"
                >
                  <div>
                    <div className="font-semibold text-neutral-900 dark:text-neutral-100">
                      {ag.name} ({ag.toolKind})
                    </div>
                    <div className="font-mono-tabular text-[11px] text-neutral-500">
                      {ag.status} · {ag.tasksCompleted} done · {ag.tasksFailed} failed · Heartbeat{' '}
                      {new Date(ag.lastHeartbeatAt).toLocaleTimeString()}
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => void handleAgentStatusToggle(ag)}
                    className="rounded-lg border border-neutral-200 px-2.5 py-1 text-xs font-semibold dark:border-neutral-700"
                  >
                    {ag.status === 'paused' ? 'Resume Agent' : 'Pause Agent'}
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {feedback && (
        <div className="flex items-center gap-2 rounded-lg bg-[#1E7E4E]/10 px-4 py-2.5 text-xs font-medium text-[#1E7E4E] dark:text-[#6CD19B]">
          <CheckCircle2 className="h-4 w-4 shrink-0" />
          {feedback}
        </div>
      )}
      {errorMsg && (
        <div className="flex items-center gap-2 rounded-lg border border-[#B9382C]/40 bg-[#B9382C]/10 px-4 py-2.5 text-xs font-medium text-[#B9382C] dark:text-[#F28B82]">
          <AlertTriangle className="h-4 w-4 shrink-0" />
          {errorMsg}
        </div>
      )}

      {/* Production Wizard Modal */}
      {wizardOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-xl border border-neutral-200 bg-white p-6 dark:border-neutral-800 dark:bg-neutral-900">
            <div className="flex items-center justify-between border-b border-neutral-200 pb-3 dark:border-neutral-800">
              <div>
                <h3 className="font-display text-base font-bold text-neutral-900 dark:text-neutral-100">
                  Launch Autonomous Chapter Production Job ($0 Default)
                </h3>
                <p className="text-xs text-neutral-500">
                  Creates dependency-ordered tasks for Freebuff CLI &amp; OpenCode workers.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setWizardOpen(false)}
                className="rounded-lg p-1.5 text-neutral-500 hover:bg-neutral-100 dark:hover:bg-neutral-800"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="mt-4 space-y-4 text-xs">
              <div className="grid gap-3 sm:grid-cols-3">
                <div>
                  <label className="mb-1 block font-semibold">Grade</label>
                  <select
                    value={wGrade}
                    onChange={(e) => {
                      const g = Number(e.target.value) as 9 | 10 | 11 | 12;
                      setWGrade(g);
                      setWGroup(g <= 10 ? 'ssc_science' : 'hssc_pre_engineering');
                    }}
                    className="w-full rounded-lg border border-neutral-200 bg-white px-2.5 py-2 dark:border-neutral-700 dark:bg-neutral-800"
                  >
                    <option value={9}>Grade 9 (SSC I)</option>
                    <option value={10}>Grade 10 (SSC II)</option>
                    <option value={11}>Grade 11 (HSSC I)</option>
                    <option value={12}>Grade 12 (HSSC II)</option>
                  </select>
                </div>

                <div>
                  <label className="mb-1 block font-semibold">Group</label>
                  <select
                    value={wGroup}
                    onChange={(e) => setWGroup(e.target.value as AcademicGroupId)}
                    className="w-full rounded-lg border border-neutral-200 bg-white px-2.5 py-2 dark:border-neutral-700 dark:bg-neutral-800"
                  >
                    <option value="ssc_science">SSC Science</option>
                    <option value="ssc_humanities">SSC Humanities</option>
                    <option value="hssc_pre_engineering">HSSC Pre-Engineering</option>
                    <option value="hssc_pre_medical">HSSC Pre-Medical</option>
                    <option value="hssc_cs">HSSC Computer Science</option>
                  </select>
                </div>

                <div>
                  <label className="mb-1 block font-semibold">Chapter #</label>
                  <input
                    type="number"
                    min={1}
                    max={30}
                    value={wChapterNum}
                    onChange={(e) => setWChapterNum(Math.max(1, Number(e.target.value) || 1))}
                    className="font-mono-tabular w-full rounded-lg border border-neutral-200 bg-white px-2.5 py-2 dark:border-neutral-700 dark:bg-neutral-800"
                  />
                </div>
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <label className="mb-1 block font-semibold">Subject</label>
                  <input
                    value={wSubject}
                    onChange={(e) => setWSubject(e.target.value)}
                    className="w-full rounded-lg border border-neutral-200 bg-white px-3 py-2 dark:border-neutral-700 dark:bg-neutral-800"
                  />
                </div>
                <div>
                  <label className="mb-1 block font-semibold">Chapter Title</label>
                  <input
                    value={wChapterTitle}
                    onChange={(e) => setWChapterTitle(e.target.value)}
                    className="w-full rounded-lg border border-neutral-200 bg-white px-3 py-2 dark:border-neutral-700 dark:bg-neutral-800"
                  />
                </div>
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <label className="mb-1 block font-semibold">Production Scope</label>
                  <select
                    value={wScope}
                    onChange={(e) => setWScope(e.target.value as ProductionScope)}
                    className="w-full rounded-lg border border-neutral-200 bg-white px-2.5 py-2 dark:border-neutral-700 dark:bg-neutral-800"
                  >
                    <option value="full_chapter_pack">Full Chapter Pack</option>
                    <option value="concepts_and_notes">Concepts &amp; Notes</option>
                    <option value="visuals_and_graphs">Motion Graphics &amp; Graphs</option>
                    <option value="question_bank">Questions &amp; Numericals</option>
                    <option value="exams_and_quizzes">Exams &amp; Quizzes</option>
                  </select>
                </div>

                <div>
                  <label className="mb-1 block font-semibold">Execution Mode</label>
                  <select
                    value={wExecMode}
                    onChange={(e) => setWExecMode(e.target.value as ExecutionMode)}
                    className="w-full rounded-lg border border-neutral-200 bg-white px-2.5 py-2 dark:border-neutral-700 dark:bg-neutral-800"
                  >
                    <option value="external_agent_queue">
                      Freebuff / OpenCode Queue ($0 API Cost)
                    </option>
                    <option value="gemini_cached" disabled={!paidAiEnabled}>
                      Optional Server Gemini ({paidAiEnabled ? 'Unlocked' : 'Locked in Security Gate'})
                    </option>
                  </select>
                </div>
              </div>

              <div>
                <label className="mb-1 block font-semibold">Source Book Citation</label>
                <input
                  value={wSourceBook}
                  onChange={(e) => setWSourceBook(e.target.value)}
                  className="w-full rounded-lg border border-neutral-200 bg-white px-3 py-2 dark:border-neutral-700 dark:bg-neutral-800"
                />
              </div>

              <div className="space-y-2 rounded-lg border border-neutral-200 bg-neutral-50 p-3 dark:border-neutral-800 dark:bg-neutral-950">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="font-semibold">Textbook Source Notes or PDF</span>
                  <label className="inline-flex cursor-pointer items-center gap-1.5 rounded border border-neutral-200 bg-white px-2.5 py-1 font-semibold text-[#1B6B46] dark:border-neutral-700 dark:bg-neutral-900 dark:text-[#6CD19B]">
                    <FileText className="h-3.5 w-3.5" />
                    {wPdfName || 'Attach Chapter PDF'}
                    <input
                      type="file"
                      accept=".pdf,application/pdf"
                      onChange={(e) => void handleWizardPdf(e)}
                      className="hidden"
                    />
                  </label>
                </div>
                <textarea
                  rows={4}
                  value={wExtractText}
                  onChange={(e) => setWExtractText(e.target.value)}
                  className="w-full rounded border border-neutral-200 bg-white p-2.5 dark:border-neutral-700 dark:bg-neutral-900"
                />
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={wPermission}
                    onChange={(e) => setWPermission(e.target.checked)}
                    className="accent-[#1B6B46]"
                  />
                  Copyright / text-only summary permission verified
                </label>
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={wTrustedAutoApprove}
                    onChange={(e) => setWTrustedAutoApprove(e.target.checked)}
                    className="accent-[#1B6B46]"
                  />
                  Trusted Book: Auto-approve Proposed Structure (publish gate stays required)
                </label>
              </div>
            </div>

            <div className="mt-5 flex justify-end gap-2 border-t border-neutral-200 pt-4 dark:border-neutral-800">
              <button
                type="button"
                onClick={() => setWizardOpen(false)}
                className="rounded-lg border border-neutral-200 px-4 py-2 text-xs font-semibold dark:border-neutral-700"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={wBusy}
                onClick={() => void handleStartJob()}
                className="inline-flex items-center gap-1.5 rounded-lg bg-[#1B6B46] px-4 py-2 text-xs font-semibold text-white disabled:opacity-60"
              >
                <Sparkles className="h-3.5 w-3.5" />
                {wBusy ? 'Queuing...' : 'Queue Autonomous Job'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Production Pipeline Jobs Table */}
      <div className="rounded-xl border border-neutral-200 bg-white p-6 dark:border-neutral-800 dark:bg-neutral-900">
        <h3 className="text-sm font-bold text-neutral-900 dark:text-neutral-100">
          Production Pipeline Jobs ({jobs.length})
        </h3>
        {loading ? (
          <p className="mt-3 text-xs text-neutral-500">Loading pipeline state...</p>
        ) : jobs.length === 0 ? (
          <div className="py-6 text-center text-xs text-neutral-500">
            No production jobs queued yet. Upload a PDF in Books &amp; Uploader or click New
            Production Job.
          </div>
        ) : (
          <div className="mt-4 divide-y divide-neutral-200 dark:divide-neutral-800">
            {jobs.map((job) => {
              const completedTasks = job.tasks.filter((t) => t.status === 'completed').length;
              const isExpanded = expandedJobId === job.id;
              return (
                <div key={job.id} className="space-y-3 py-3.5 first:pt-1 last:pb-1">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <div className="flex flex-wrap items-center gap-2 text-xs">
                        <span
                          className={`rounded px-2 py-0.5 text-[11px] font-semibold ${JOB_STATUS_TONE[job.status]}`}
                        >
                          {job.status.replace('_', ' ')}
                        </span>
                        <span className="font-mono-tabular text-neutral-500">
                          Phase {job.currentPhase}/11 · {completedTasks}/{job.tasks.length} tasks
                        </span>
                      </div>
                      <div className="mt-1 text-sm font-bold text-neutral-900 dark:text-neutral-100">
                        Grade {job.grade} · {job.subjectName} — Ch {job.chapterNumber}:{' '}
                        {job.chapterTitle}
                      </div>
                    </div>

                    <div className="flex flex-wrap items-center gap-2">
                      {(job.status === 'running' || job.status === 'waiting_external') && (
                        <button
                          type="button"
                          onClick={() => void handleJobControl(job.id, 'pause')}
                          className="inline-flex items-center gap-1 rounded-lg border border-neutral-200 px-2.5 py-1.5 text-xs font-medium dark:border-neutral-700"
                        >
                          <Pause className="h-3 w-3" /> Pause
                        </button>
                      )}
                      {job.status === 'paused' && (
                        <button
                          type="button"
                          onClick={() => void handleJobControl(job.id, 'resume')}
                          className="inline-flex items-center gap-1 rounded-lg border border-[#1B6B46] px-2.5 py-1.5 text-xs font-semibold text-[#1B6B46] dark:border-[#6CD19B] dark:text-[#6CD19B]"
                        >
                          <Play className="h-3 w-3" /> Resume
                        </button>
                      )}
                      {chapters.some((c) => c.chapterId === job.chapterId) && (
                        <button
                          type="button"
                          onClick={() => onInspectChapter(job.chapterId)}
                          className="rounded-lg border border-neutral-200 px-2.5 py-1.5 text-xs font-semibold text-[#1B6B46] dark:border-neutral-700 dark:text-[#6CD19B]"
                        >
                          Open Draft
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={() => setExpandedJobId(isExpanded ? null : job.id)}
                        className="inline-flex items-center gap-1 rounded-lg border border-neutral-200 px-2.5 py-1.5 text-xs font-semibold dark:border-neutral-700"
                      >
                        {isExpanded ? (
                          <ChevronUp className="h-3.5 w-3.5" />
                        ) : (
                          <ChevronDown className="h-3.5 w-3.5" />
                        )}
                        Tasks &amp; Logs
                      </button>
                    </div>
                  </div>

                  {job.structureStatus === 'proposed_pending' && job.proposedStructure && (
                    <div className="space-y-3 rounded-lg border border-[#B4690E]/40 bg-[#FEF4E6]/60 p-4 text-xs dark:bg-[#3B2810]/40">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div>
                          <div className="font-bold text-[#B4690E] dark:text-[#E6A756]">
                            Owner Structure Proposal Gate — Phase 4 Paused Pending Approval
                          </div>
                          <div className="text-neutral-600 dark:text-neutral-300">
                            Proposed by {job.proposedStructure.proposedBy} · {job.proposedStructure.summary}
                          </div>
                        </div>
                        <div className="flex flex-wrap gap-2">
                          <button
                            type="button"
                            onClick={() => void handleApproveStructure(job.id)}
                            className="inline-flex items-center gap-1 rounded-lg bg-[#1B6B46] px-3 py-1.5 font-semibold text-white"
                          >
                            <ShieldCheck className="h-3.5 w-3.5" />
                            Approve Structure &amp; Unlock Phase 4
                          </button>
                          <button
                            type="button"
                            onClick={() =>
                              setStructureRejectJobId(structureRejectJobId === job.id ? null : job.id)
                            }
                            className="rounded-lg border border-[#B9382C]/40 px-3 py-1.5 font-semibold text-[#B9382C] dark:text-[#F28B82]"
                          >
                            Request Changes
                          </button>
                        </div>
                      </div>

                      <div className="grid gap-2 sm:grid-cols-2">
                        {job.proposedStructure.chapters.map((pch) => (
                          <div
                            key={`${pch.chapterNumber}_${pch.title}`}
                            className="rounded border border-neutral-200 bg-white p-2.5 dark:border-neutral-800 dark:bg-neutral-900"
                          >
                            <div className="font-bold">
                              Ch {pch.chapterNumber}: {pch.title}
                            </div>
                            <div className="mt-1 text-[11px] text-neutral-500">
                              Topics: {pch.topics.join(', ') || 'TBD'} · ~{pch.estimatedConcepts} concepts · ~{pch.estimatedQuestions} Qs
                            </div>
                            {pch.learningObjectives.length > 0 && (
                              <div className="mt-1 text-[11px] text-neutral-600 dark:text-neutral-300">
                                Objectives: {pch.learningObjectives.join('; ')}
                              </div>
                            )}
                          </div>
                        ))}
                      </div>

                      {structureRejectJobId === job.id && (
                        <div className="flex flex-wrap gap-2 border-t border-amber-500/30 pt-2">
                          <input
                            value={structureRejectNote}
                            onChange={(e) => setStructureRejectNote(e.target.value)}
                            placeholder="Explain topic/objective edits required..."
                            className="min-w-0 flex-1 rounded border border-neutral-200 bg-white px-2.5 py-1.5 dark:border-neutral-700 dark:bg-neutral-900"
                          />
                          <button
                            type="button"
                            onClick={() => void handleRejectStructure(job.id)}
                            className="rounded bg-[#B9382C] px-3 py-1.5 font-semibold text-white"
                          >
                            Send Feedback to Architect
                          </button>
                        </div>
                      )}
                    </div>
                  )}

                  {isExpanded && (
                    <div className="space-y-3 rounded-lg border border-neutral-200 bg-neutral-50 p-4 text-xs dark:border-neutral-800 dark:bg-neutral-950">
                      <div className="overflow-x-auto">
                        <table className="w-full border-collapse text-left text-[11px]">
                          <thead>
                            <tr className="border-b border-neutral-200 text-neutral-500 dark:border-neutral-800">
                              <th className="py-1.5">Phase</th>
                              <th className="py-1.5">Specialist Task</th>
                              <th className="py-1.5">Status</th>
                              <th className="py-1.5">Retries</th>
                              <th className="py-1.5">Worker / Lease / Output</th>
                            </tr>
                          </thead>
                          <tbody>
                            {job.tasks.map((t) => (
                              <tr
                                key={t.id}
                                className="border-b border-neutral-200/60 dark:border-neutral-800/60"
                              >
                                <td className="font-mono-tabular py-1.5">P{t.phase}</td>
                                <td className="py-1.5 font-medium">{t.title}</td>
                                <td className="py-1.5 font-semibold capitalize">{t.status}</td>
                                <td className="font-mono-tabular py-1.5">
                                  {t.retryCount}/{t.maxRetries}
                                </td>
                                <td className="py-1.5 text-neutral-600 dark:text-neutral-300">
                                  {t.lastError ||
                                    t.outputSummary ||
                                    (t.assignedWorker
                                      ? `${t.assignedWorker} (lease ${t.leaseExpiresAt ? new Date(t.leaseExpiresAt).toLocaleTimeString() : 'active'})`
                                      : 'Waiting dependencies')}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Exams & Monitoring Loop */}
      <div className="grid gap-6 lg:grid-cols-2">
        <div className="rounded-xl border border-neutral-200 bg-white p-6 dark:border-neutral-800 dark:bg-neutral-900">
          <h3 className="text-sm font-bold text-neutral-900 dark:text-neutral-100">
            Exam Blueprints ({ops?.exams.length ?? 0})
          </h3>
          {(ops?.exams.length ?? 0) === 0 ? (
            <p className="mt-3 text-xs text-neutral-500">
              Submitted exam blueprints will appear here for human approval.
            </p>
          ) : (
            <div className="mt-3 divide-y divide-neutral-200 text-xs dark:divide-neutral-800">
              {ops!.exams.map((exam) => (
                <div key={exam.id} className="flex items-center justify-between gap-3 py-3">
                  <div>
                    <div className="font-semibold">{exam.title}</div>
                    <div className="font-mono-tabular text-neutral-500">
                      {exam.durationMinutes} min · {exam.totalMarks} marks ·{' '}
                      {exam.publicationStatus}
                    </div>
                  </div>
                  {exam.publicationStatus !== 'published' && (
                    <button
                      type="button"
                      onClick={() => void handlePublishExam(exam.id)}
                      className="inline-flex shrink-0 items-center gap-1 rounded-lg bg-[#1B6B46] px-3 py-1.5 text-xs font-semibold text-white"
                    >
                      <ShieldCheck className="h-3.5 w-3.5" />
                      Approve Exam
                    </button>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="rounded-xl border border-neutral-200 bg-white p-6 dark:border-neutral-800 dark:bg-neutral-900">
          <h3 className="text-sm font-bold text-neutral-900 dark:text-neutral-100">
            Monitoring &amp; Fix Draft Proposals
          </h3>
          <div className="mt-3 space-y-2 text-xs">
            <div className="grid grid-cols-2 gap-2">
              <select
                value={issueChapterId}
                onChange={(e) => setIssueChapterId(e.target.value)}
                className="rounded-lg border border-neutral-200 bg-white px-2.5 py-1.5 dark:border-neutral-700 dark:bg-neutral-800"
              >
                {chapters.map((c) => (
                  <option key={c.chapterId} value={c.chapterId}>
                    G{c.grade} · {c.title}
                  </option>
                ))}
              </select>
              <select
                value={issueCategory}
                onChange={(e) =>
                  setIssueCategory(e.target.value as MonitoringIssueReport['category'])
                }
                className="rounded-lg border border-neutral-200 bg-white px-2.5 py-1.5 dark:border-neutral-700 dark:bg-neutral-800"
              >
                <option value="answer_error">Answer / Calculation Issue</option>
                <option value="typo_katex">KaTeX / Typo Issue</option>
                <option value="unit_error">SI Unit Issue</option>
                <option value="syllabus_mismatch">Syllabus Mismatch</option>
                <option value="duplicate">Duplicate Question</option>
              </select>
            </div>
            <div className="flex gap-2">
              <input
                value={issueDesc}
                onChange={(e) => setIssueDesc(e.target.value)}
                placeholder="Describe flagged typo, unit mismatch, or answer issue..."
                className="flex-1 rounded-lg border border-neutral-200 bg-white px-3 py-1.5 dark:border-neutral-700 dark:bg-neutral-800"
              />
              <button
                type="button"
                onClick={() => void handleLogIssue()}
                className="shrink-0 rounded-lg border border-neutral-200 px-3 py-1.5 font-semibold dark:border-neutral-700"
              >
                Log Issue
              </button>
            </div>
          </div>

          {(ops?.issues.length ?? 0) > 0 && (
            <div className="mt-4 divide-y divide-neutral-200 text-xs dark:divide-neutral-800">
              {ops!.issues.slice(0, 5).map((iss) => (
                <div key={iss.id} className="flex items-center justify-between gap-3 py-2.5">
                  <div>
                    <div className="font-semibold">
                      [{iss.category}] {iss.description}
                    </div>
                    <div className="text-[11px] text-neutral-500">
                      {iss.chapterId} · {iss.status.replace('_', ' ')}
                    </div>
                  </div>
                  {iss.status === 'open' ? (
                    <button
                      type="button"
                      onClick={() => void handleCreateFixDraft(iss.id)}
                      className="inline-flex shrink-0 items-center gap-1 rounded-lg border border-[#1B6B46] px-2.5 py-1.5 text-xs font-semibold text-[#1B6B46] dark:border-[#6CD19B] dark:text-[#6CD19B]"
                    >
                      <Wrench className="h-3 w-3" />
                      Fix Draft
                    </button>
                  ) : (
                    iss.proposedDraftChapterId && (
                      <button
                        type="button"
                        onClick={() => onInspectChapter(iss.proposedDraftChapterId!)}
                        className="shrink-0 text-xs font-semibold text-[#1B6B46] hover:underline dark:text-[#6CD19B]"
                      >
                        Inspect Draft
                      </button>
                    )
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Quarantined Submissions & Filterable Audit Log */}
      <div className="grid gap-6 lg:grid-cols-2">
        <div className="rounded-xl border border-neutral-200 bg-white p-6 dark:border-neutral-800 dark:bg-neutral-900">
          <h3 className="text-sm font-bold text-neutral-900 dark:text-neutral-100">
            Quarantined Submissions (
            {(ops?.quarantinedSubmissions ?? []).filter((q) => q.status === 'quarantined').length})
          </h3>
          <p className="mt-0.5 text-xs text-neutral-500 dark:text-neutral-400">
            Strict 14-step validation &amp; XSS checks block malformed agent outputs before entering live chapters.
          </p>
          {(ops?.quarantinedSubmissions ?? []).filter((q) => q.status === 'quarantined').length === 0 ? (
            <p className="mt-4 text-xs text-neutral-500">
              No active quarantined submissions. All recent external agent payloads passed schema validation.
            </p>
          ) : (
            <div className="mt-3 divide-y divide-neutral-200 text-xs dark:divide-neutral-800">
              {(ops?.quarantinedSubmissions ?? [])
                .filter((q) => q.status === 'quarantined')
                .map((qItem) => (
                  <div key={qItem.id} className="space-y-1.5 py-3">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <span className="font-semibold text-[#B9382C] dark:text-[#F28B82]">
                        {qItem.sourceEndpoint} · Worker {qItem.workerId}
                      </span>
                      <button
                        type="button"
                        onClick={() => void handleResolveQuarantine(qItem.id)}
                        className="rounded-lg border border-neutral-200 px-2.5 py-1 text-[11px] font-semibold hover:bg-neutral-50 dark:border-neutral-700"
                      >
                        Mark Resolved
                      </button>
                    </div>
                    <div className="text-neutral-700 dark:text-neutral-300">{qItem.reason}</div>
                    {qItem.validationErrors.length > 0 && (
                      <ul className="list-disc pl-4 text-[11px] text-neutral-500">
                        {qItem.validationErrors.slice(0, 4).map((err, i) => (
                          <li key={i}>{err}</li>
                        ))}
                      </ul>
                    )}
                  </div>
                ))}
            </div>
          )}
        </div>

        <div className="rounded-xl border border-neutral-200 bg-white p-6 dark:border-neutral-800 dark:bg-neutral-900">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h3 className="text-sm font-bold text-neutral-900 dark:text-neutral-100">
              Audit Log ({(ops?.auditLog ?? []).length})
            </h3>
            <div className="flex gap-1.5 text-xs">
              <input
                value={auditSearch}
                onChange={(e) => setAuditSearch(e.target.value)}
                placeholder="Search actor/chapter..."
                className="w-36 rounded-lg border border-neutral-200 bg-white px-2.5 py-1 dark:border-neutral-700 dark:bg-neutral-800"
              />
              <select
                value={auditActionFilter}
                onChange={(e) => setAuditActionFilter(e.target.value)}
                className="rounded-lg border border-neutral-200 bg-white px-2 py-1 dark:border-neutral-700 dark:bg-neutral-800"
              >
                <option value="">All Actions</option>
                <option value="structure_proposed">structure_proposed</option>
                <option value="structure_approved">structure_approved</option>
                <option value="submission_quarantined">submission_quarantined</option>
                <option value="component_approved">component_approved</option>
                <option value="approved_published">approved_published</option>
                <option value="book_uploaded">book_uploaded</option>
              </select>
            </div>
          </div>

          <div className="mt-3 max-h-64 divide-y divide-neutral-200 overflow-y-auto text-xs dark:divide-neutral-800">
            {(ops?.auditLog ?? [])
              .filter((row) => {
                if (auditActionFilter && row.action !== auditActionFilter) return false;
                if (auditSearch.trim()) {
                  const q = auditSearch.trim().toLowerCase();
                  const hay = `${row.actor} ${row.summary} ${row.chapterId ?? ''} ${row.action}`.toLowerCase();
                  if (!hay.includes(q)) return false;
                }
                return true;
              })
              .slice(0, 20)
              .map((entry) => (
                <div key={entry.id} className="py-2">
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-mono-tabular text-[11px] font-semibold text-[#1B6B46] dark:text-[#6CD19B]">
                      {entry.action}
                    </span>
                    <span className="font-mono-tabular text-[11px] text-neutral-500">
                      {new Date(entry.timestamp).toLocaleTimeString()}
                    </span>
                  </div>
                  <div className="mt-0.5 text-neutral-700 dark:text-neutral-300">
                    {entry.actor}: {entry.summary}
                  </div>
                </div>
              ))}
          </div>
        </div>
      </div>
    </div>
  );
}
