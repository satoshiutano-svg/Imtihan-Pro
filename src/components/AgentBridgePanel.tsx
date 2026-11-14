import { useEffect, useState } from 'react';
import {
  AlertTriangle,
  BookOpen,
  CheckCircle2,
  Copy,
  Download,
  Edit3,
  Eye,
  EyeOff,
  History,
  RefreshCw,
  RotateCcw,
  ShieldCheck,
  ShieldOff,
  Sparkles,
  Trash2,
  X,
} from 'lucide-react';
import type {
  AgentSkillSpec,
  BookDocument,
  CmsChapter,
  PublishHistoryEntry,
  RegisteredAgent,
  ReviewStage,
  VerificationReport,
} from '../types/cms';

type AgentToolId =
  | 'freebuff'
  | 'opencode'
  | 'cursor'
  | 'claude_code'
  | 'antigravity'
  | 'codex';

type InboxFilterTab = 'all_drafts' | 'verified' | 'flagged' | 'history';

interface AgentBridgeInfo {
  baseUrl: string;
  mcpEndpoint: string;
  restDraftEndpoint: string;
  agentAccessToken: string;
  verifierAccessToken?: string;
  rolesCount?: number;
  skillsCount?: number;
  registeredAgents?: RegisteredAgent[];
  rulesMarkdown: string;
}

interface AgentBridgePanelProps {
  chapters: CmsChapter[];
  verificationReports?: VerificationReport[];
  onApproveAndPublish: (chapterId: string, reviewedBy: string) => Promise<void>;
  onBatchApproveVerified?: (
    chapterIds: string[],
    reviewedBy: string,
  ) => Promise<{ approved: number; skipped: number }>;
  onRunVerification?: (chapterId: string) => Promise<void>;
  onDeleteChapter: (chapterId: string) => Promise<void>;
  onSelectChapter: (chapterId: string) => void;
  onRefreshWorkspace?: () => Promise<void>;
}

const AGENT_TOOLS: { id: AgentToolId; label: string; subtitle: string }[] = [
  { id: 'freebuff', label: 'Freebuff CLI ($0)', subtitle: '.agents/mcp.json + /skill:roshan-kpk-author' },
  { id: 'opencode', label: 'OpenCode', subtitle: 'opencode.json remote MCP config' },
  { id: 'cursor', label: 'Cursor', subtitle: '.cursor/mcp.json' },
  { id: 'claude_code', label: 'Claude Code', subtitle: 'CLI MCP setup command' },
  { id: 'antigravity', label: 'Antigravity', subtitle: 'MCP URL + rules prompt' },
  { id: 'codex', label: 'Codex / API', subtitle: 'REST HTTP API + task queue' },
];

const STAGE_LABEL: Record<ReviewStage, { label: string; tone: string }> = {
  ai_generated: {
    label: '1. AI Generated',
    tone: 'text-neutral-700 bg-neutral-100 dark:text-neutral-200 dark:bg-neutral-800',
  },
  auto_validated: {
    label: '2. Auto-Validated',
    tone: 'text-[#B4690E] bg-[#FEF4E6] dark:text-[#E6A756] dark:bg-[#3B2810]',
  },
  independently_reviewed: {
    label: '3. Independently Verified',
    tone: 'text-[#1B6B46] bg-[#D6F0E1]/60 dark:text-[#6CD19B] dark:bg-[#174F33]/50',
  },
  human_approved: {
    label: '4. Human Approved',
    tone: 'text-[#1E7E4E] bg-[#D6F0E1] dark:text-[#6CD19B] dark:bg-[#174F33]',
  },
  revision_requested: {
    label: 'Revision Requested',
    tone: 'text-[#B4690E] bg-[#FEF4E6] dark:text-[#E6A756] dark:bg-[#3B2810]',
  },
  rejected: {
    label: 'Rejected',
    tone: 'text-[#B9382C] bg-[#FCECEA] dark:text-[#F28B82] dark:bg-[#3A1B18]',
  },
  published: {
    label: '5. Published Live',
    tone: 'text-white bg-[#1B6B46]',
  },
};

export function AgentBridgePanel({
  chapters,
  verificationReports = [],
  onApproveAndPublish,
  onBatchApproveVerified,
  onRunVerification,
  onDeleteChapter,
  onSelectChapter,
  onRefreshWorkspace,
}: AgentBridgePanelProps) {
  const [bridge, setBridge] = useState<AgentBridgeInfo | null>(null);
  const [books, setBooks] = useState<BookDocument[]>([]);
  const [publishHistory, setPublishHistory] = useState<PublishHistoryEntry[]>([]);
  const [skillsCatalog, setSkillsCatalog] = useState<AgentSkillSpec[]>([]);
  const [showSkillsDrawer, setShowSkillsDrawer] = useState(false);

  const [selectedTool, setSelectedTool] = useState<AgentToolId>('freebuff');
  const [showToken, setShowToken] = useState(false);
  const [showVerifierToken, setShowVerifierToken] = useState(false);
  const [copiedId, setCopiedId] = useState<string>('');
  const [reviewerName, setReviewerName] = useState('KPK Subject Reviewer');
  const [inboxTab, setInboxTab] = useState<InboxFilterTab>('all_drafts');

  const [busyId, setBusyId] = useState<string>('');
  const [verifyingId, setVerifyingId] = useState<string>('');
  const [selectedForBatch, setSelectedForBatch] = useState<string[]>([]);
  const [expandedReportId, setExpandedReportId] = useState<string | null>(null);
  const [expandedComponentsId, setExpandedComponentsId] = useState<string | null>(null);
  const [compareChapterId, setCompareChapterId] = useState<string | null>(null);
  const [quickEditChapterId, setQuickEditChapterId] = useState<string | null>(null);
  const [quickEditTitle, setQuickEditTitle] = useState('');
  const [quickEditExplanation, setQuickEditExplanation] = useState('');
  const [feedbackDraftId, setFeedbackDraftId] = useState<string | null>(null);
  const [feedbackAction, setFeedbackAction] = useState<'request_revision' | 'reject'>(
    'request_revision',
  );
  const [feedbackReason, setFeedbackReason] = useState('');

  const [actionMessage, setActionMessage] = useState<string>('');
  const [actionError, setActionError] = useState<string>('');

  const loadBridgeAndOverview = async () => {
    try {
      const [bridgeRes, ovRes] = await Promise.all([
        fetch('/api/cms/agent-bridge'),
        fetch('/api/cms/overview'),
      ]);
      if (bridgeRes.ok) {
        const data = (await bridgeRes.json()) as AgentBridgeInfo;
        setBridge(data);
        if (data.agentAccessToken && skillsCatalog.length === 0) {
          const skRes = await fetch('/api/agent/skills', {
            headers: { Authorization: `Bearer ${data.agentAccessToken}` },
          });
          if (skRes.ok) {
            const skData = (await skRes.json()) as { skills?: AgentSkillSpec[] };
            if (Array.isArray(skData.skills)) setSkillsCatalog(skData.skills);
          }
        }
      }
      if (ovRes.ok) {
        const ovData = (await ovRes.json()) as {
          books?: BookDocument[];
          publishHistory?: PublishHistoryEntry[];
        };
        if (Array.isArray(ovData.books)) setBooks(ovData.books);
        if (Array.isArray(ovData.publishHistory)) setPublishHistory(ovData.publishHistory);
      }
    } catch {
      // Ignore offline fallback
    }
  };

  useEffect(() => {
    void loadBridgeAndOverview();
  }, []);

  const draftQueue = chapters.filter(
    (c) =>
      c.publicationStatus === 'draft' ||
      c.publicationStatus === 'in_review' ||
      c.reviewStage === 'revision_requested' ||
      c.reviewStage === 'rejected',
  );

  const reportByChapter = new Map(verificationReports.map((r) => [r.chapterId, r]));

  const verifiedDraftIds = draftQueue
    .filter((ch) => {
      const rep = reportByChapter.get(ch.chapterId);
      return (
        ch.reviewStage === 'independently_reviewed' ||
        ch.reviewStage === 'human_approved' ||
        rep?.overallPassed
      );
    })
    .map((c) => c.chapterId);

  const flaggedDrafts = draftQueue.filter((ch) => {
    const rep = reportByChapter.get(ch.chapterId);
    return (
      ch.reviewStage === 'revision_requested' ||
      ch.reviewStage === 'rejected' ||
      (rep && !rep.overallPassed)
    );
  });

  const visibleInboxChapters =
    inboxTab === 'verified'
      ? draftQueue.filter((c) => verifiedDraftIds.includes(c.chapterId))
      : inboxTab === 'flagged'
        ? flaggedDrafts
        : draftQueue;

  const copyText = async (id: string, value: string) => {
    try {
      await navigator.clipboard.writeText(value);
      setCopiedId(id);
      setTimeout(() => setCopiedId(''), 1800);
    } catch {
      setActionError('Could not access clipboard. Select and copy manually.');
    }
  };

  const handleRotateToken = async (scope: 'agent' | 'verifier') => {
    setActionError('');
    const endpoint =
      scope === 'verifier'
        ? '/api/cms/verifier-token/rotate'
        : '/api/cms/agent-token/rotate';
    const res = await fetch(endpoint, { method: 'POST' });
    const data = (await res.json()) as {
      agentAccessToken?: string;
      verifierAccessToken?: string;
    };
    if (res.ok) {
      setBridge((prev) =>
        prev
          ? {
              ...prev,
              agentAccessToken: data.agentAccessToken ?? prev.agentAccessToken,
              verifierAccessToken: data.verifierAccessToken ?? prev.verifierAccessToken,
            }
          : prev,
      );
      setActionMessage(
        scope === 'verifier'
          ? 'Rotated Independent Verifier token.'
          : 'Rotated Author Agent token.',
      );
    }
  };

  const handleRevokeToken = async (scope: 'agent' | 'verifier') => {
    setActionError('');
    const res = await fetch('/api/cms/tokens/revoke', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ scope }),
    });
    if (res.ok) {
      setActionMessage(
        `Revoked ${scope} token immediately. Rotate a new key above before reconnecting agents.`,
      );
    }
  };

  const handleDownloadRules = () => {
    if (!bridge) return;
    const blob = new Blob([bridge.rulesMarkdown], { type: 'text/markdown' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'ROSHAN_AGENT_RULES.md';
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleSaveQuickEdit = async (ch: CmsChapter) => {
    setActionError('');
    const updated: CmsChapter = {
      ...ch,
      title: quickEditTitle.trim() || ch.title,
      concepts: ch.concepts.map((c, idx) =>
        idx === 0
          ? {
              ...c,
              simpleExplanation: quickEditExplanation.trim() || c.simpleExplanation,
            }
          : c,
      ),
    };
    const res = await fetch(`/api/cms/chapters/${encodeURIComponent(ch.chapterId)}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(updated),
    });
    if (!res.ok) {
      const data = (await res.json()) as { message?: string };
      setActionError(data.message || 'Could not save inline edits.');
      return;
    }
    setQuickEditChapterId(null);
    setActionMessage(`Saved quick edit to "${updated.title}".`);
    if (onRefreshWorkspace) await onRefreshWorkspace();
  };

  const handleSubmitReviewDecision = async (chapterId: string) => {
    if (feedbackReason.trim().length < 5) {
      setActionError('Enter at least 5 characters explaining the required revision or rejection.');
      return;
    }
    setBusyId(chapterId);
    setActionError('');
    try {
      const res = await fetch(`/api/cms/chapters/${encodeURIComponent(chapterId)}/reject`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: feedbackAction,
          reason: feedbackReason.trim(),
          actor: reviewerName || 'Owner Reviewer',
        }),
      });
      const data = (await res.json()) as { message?: string };
      if (!res.ok) {
        setActionError(data.message || 'Could not record review feedback.');
        return;
      }
      setFeedbackDraftId(null);
      setFeedbackReason('');
      setActionMessage(
        feedbackAction === 'reject'
          ? 'Draft marked Rejected with feedback for agents.'
          : 'Revision requested — agents can fetch feedback via /api/agent/chapters/:id/feedback.',
      );
      if (onRefreshWorkspace) await onRefreshWorkspace();
    } finally {
      setBusyId('');
    }
  };

  const handleRollbackVersion = async (chapterId: string, targetVersion: number) => {
    setBusyId(chapterId);
    setActionError('');
    try {
      const res = await fetch(`/api/cms/chapters/${encodeURIComponent(chapterId)}/rollback`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ targetVersion, actor: reviewerName || 'Owner' }),
      });
      const data = (await res.json()) as { message?: string };
      if (!res.ok) {
        setActionError(data.message || 'Rollback failed.');
        return;
      }
      setActionMessage(`Rolled back ${chapterId} to snapshot v${targetVersion}.`);
      await loadBridgeAndOverview();
      if (onRefreshWorkspace) await onRefreshWorkspace();
    } finally {
      setBusyId('');
    }
  };

  const handleApproveComponent = async (
    chapterId: string,
    componentType: 'concept' | 'question',
    componentId: string,
  ) => {
    setBusyId(`${chapterId}:${componentId}`);
    setActionError('');
    try {
      const res = await fetch(
        `/api/cms/chapters/${encodeURIComponent(chapterId)}/components/${encodeURIComponent(componentId)}/approve`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            componentType,
            reviewedBy: reviewerName || 'Owner Reviewer',
          }),
        },
      );
      const data = (await res.json()) as { message?: string };
      if (!res.ok) {
        setActionError(data.message || 'Component approval failed.');
        return;
      }
      setActionMessage(`Approved ${componentType} "${componentId}" on ${chapterId}.`);
      if (onRefreshWorkspace) await onRefreshWorkspace();
    } finally {
      setBusyId('');
    }
  };

  const mcpEndpoint = bridge?.mcpEndpoint || `${window.location.origin}/api/mcp`;
  const baseUrl = bridge?.baseUrl || window.location.origin;
  const tokenValue = bridge?.agentAccessToken || 'Loading token...';
  const verifierTokenValue = bridge?.verifierAccessToken || 'Loading verifier token...';

  const getSetupSnippet = (tool: AgentToolId): string => {
    if (tool === 'freebuff' || tool === 'cursor' || tool === 'antigravity') {
      return JSON.stringify(
        {
          mcpServers: {
            'roshan-study': {
              url: mcpEndpoint,
              headers: {
                Authorization: `Bearer ${tokenValue}`,
              },
            },
          },
        },
        null,
        2,
      );
    }
    if (tool === 'opencode') {
      return JSON.stringify(
        {
          mcp: {
            'roshan-study': {
              type: 'remote',
              url: mcpEndpoint,
              headers: {
                Authorization: `Bearer ${tokenValue}`,
              },
              enabled: true,
            },
          },
        },
        null,
        2,
      );
    }
    if (tool === 'claude_code') {
      return `claude mcp add --transport http roshan-study "${mcpEndpoint}" --header "Authorization: Bearer ${tokenValue}"`;
    }
    return `# REST Queue API ($0 Author + Independent Verifier)
GET  ${baseUrl}/api/agent/skills
GET  ${baseUrl}/api/agent/books/<bookId>/source
POST ${baseUrl}/api/agent/tasks/claim-next
POST ${baseUrl}/api/agent/tasks/<taskId>/submit
# Header: Authorization: Bearer ${tokenValue}`;
  };

  const getReadyPrompt = (tool: AgentToolId): string => {
    if (tool === 'freebuff') {
      return `/skill:roshan-kpk-author Call register_agent(workerId="freebuff-author", toolKind="freebuff"), list_books, and claim_next_task. Fetch book source via get_book_source, author KPK BISE concepts + MotionGraphicSpec + GraphSpec + 8 question formats + 6-step numericals, run validate_chapter_pack, and submit_task_result.`;
    }
    if (tool === 'opencode') {
      return `Connect to roshan-study MCP: call get_agent_skills and claim_next_task(workerName="opencode-author") or act as Independent Verifier via /api/verifier/queue (different workerId from author). Validate KaTeX & numerical units before submitting.`;
    }
    return `Read ROSHAN_AGENT_RULES.md, register via /api/agent/register, inspect queued tasks via /api/agent/tasks, and validate every draft before /api/agent/tasks/:id/submit.`;
  };

  const toggleBatchItem = (chapterId: string) => {
    setSelectedForBatch((prev) =>
      prev.includes(chapterId) ? prev.filter((id) => id !== chapterId) : [...prev, chapterId],
    );
  };

  const handleBatchApprove = async () => {
    if (!onBatchApproveVerified || !reviewerName.trim()) return;
    const targets =
      selectedForBatch.length > 0
        ? selectedForBatch.filter((id) => verifiedDraftIds.includes(id))
        : verifiedDraftIds;
    if (targets.length === 0) {
      setActionError('Select at least one Independently Verified draft to batch approve.');
      return;
    }
    setActionError('');
    setActionMessage('');
    setBusyId('__batch__');
    try {
      const res = await onBatchApproveVerified(targets, reviewerName);
      setActionMessage(
        `Batch published ${res.approved} verified chapter(s)${res.skipped > 0 ? ` (${res.skipped} skipped)` : ''}.`,
      );
      setSelectedForBatch([]);
      await loadBridgeAndOverview();
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Batch approval failed.');
    } finally {
      setBusyId('');
    }
  };

  const compareChapter = chapters.find((c) => c.chapterId === compareChapterId) ?? null;
  const linkedBook =
    compareChapter &&
    (books.find((b) => b.id === compareChapter.bookId) ??
      books.find(
        (b) =>
          b.grade === compareChapter.grade &&
          b.subjectName.toLowerCase() === compareChapter.subjectName.toLowerCase(),
      ) ??
      books[0] ??
      null);

  return (
    <div className="space-y-6">
      {/* Freebuff, OpenCode, Tokens & Skills Catalog */}
      <div className="rounded-xl border border-neutral-200 bg-white p-6 dark:border-neutral-800 dark:bg-neutral-900">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="max-w-2xl">
            <h3 className="text-base font-bold text-neutral-900 dark:text-neutral-100">
              Freebuff CLI, OpenCode &amp; 30-Role Autonomous Agent Network ($0)
            </h3>
            <p className="mt-1 text-xs leading-relaxed text-neutral-600 dark:text-neutral-300">
              Connect Freebuff, OpenCode, Cursor, Claude Code, or Codex using separate{' '}
              <strong>Author</strong> and <strong>Independent Verifier</strong> keys. Agents claim
              tasks, renew leases, fetch uploaded PDFs, and submit verified drafts—only you can
              publish.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => setShowSkillsDrawer((s) => !s)}
              className="rounded-lg border border-neutral-200 px-3 py-2 text-xs font-semibold hover:bg-neutral-50 dark:border-neutral-700"
            >
              {showSkillsDrawer
                ? 'Hide 18 Skills'
                : `Inspect ${bridge?.skillsCount ?? 18} Skills / ${bridge?.rolesCount ?? 30} Roles`}
            </button>
            <button
              type="button"
              onClick={handleDownloadRules}
              className="inline-flex shrink-0 items-center gap-1.5 rounded-lg bg-[#1B6B46] px-4 py-2 text-xs font-semibold text-white hover:bg-[#155537]"
            >
              <Download className="h-3.5 w-3.5" />
              Rules Kit (.md)
            </button>
          </div>
        </div>

        {/* Inspectable 18 Skills Catalog */}
        {showSkillsDrawer && skillsCatalog.length > 0 && (
          <div className="mt-4 grid max-h-72 gap-2.5 overflow-y-auto rounded-lg border border-neutral-200 bg-neutral-50 p-4 text-xs sm:grid-cols-2 lg:grid-cols-3 dark:border-neutral-800 dark:bg-neutral-950">
            {skillsCatalog.map((sk) => (
              <div
                key={sk.id}
                className="rounded-lg border border-neutral-200 bg-white p-3 dark:border-neutral-800 dark:bg-neutral-900"
              >
                <div className="text-[11px] text-neutral-500">{sk.category}</div>
                <div className="font-bold text-neutral-900 dark:text-neutral-100">{sk.name}</div>
                <p className="mt-1 text-[11px] text-neutral-600 dark:text-neutral-300">
                  {sk.summary}
                </p>
              </div>
            ))}
          </div>
        )}

        {/* Scoped Author & Independent Verifier Tokens */}
        <div className="mt-4 grid gap-3 lg:grid-cols-2">
          <div className="rounded-lg border border-neutral-200 bg-neutral-50 p-3.5 text-xs dark:border-neutral-800 dark:bg-neutral-950">
            <div className="font-semibold text-neutral-900 dark:text-neutral-100">
              Author Agent Access Token (Drafts + Queue)
            </div>
            <div className="mt-2 flex flex-wrap items-center gap-1.5">
              <code className="font-mono-tabular rounded border border-neutral-200 bg-white px-2 py-1 text-[11px] dark:border-neutral-700 dark:bg-neutral-900">
                {showToken ? tokenValue : `${tokenValue.slice(0, 14)}••••••••••`}
              </code>
              <button
                type="button"
                onClick={() => setShowToken((s) => !s)}
                aria-label="Toggle author token visibility"
                className="rounded border border-neutral-200 bg-white p-1 dark:border-neutral-700 dark:bg-neutral-900"
              >
                {showToken ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
              </button>
              <button
                type="button"
                onClick={() => void copyText('token', tokenValue)}
                className="inline-flex items-center gap-1 rounded border border-neutral-200 bg-white px-2 py-1 font-semibold text-[#1B6B46] dark:border-neutral-700 dark:bg-neutral-900 dark:text-[#6CD19B]"
              >
                <Copy className="h-3 w-3" />
                {copiedId === 'token' ? 'Copied' : 'Copy'}
              </button>
              <button
                type="button"
                onClick={() => void handleRotateToken('agent')}
                className="inline-flex items-center gap-1 rounded border border-neutral-200 bg-white px-2 py-1 dark:border-neutral-700 dark:bg-neutral-900"
              >
                <RefreshCw className="h-3 w-3" /> Rotate
              </button>
              <button
                type="button"
                onClick={() => void handleRevokeToken('agent')}
                className="inline-flex items-center gap-1 rounded border border-neutral-200 bg-white px-2 py-1 text-[#B9382C] dark:border-neutral-700 dark:bg-neutral-900 dark:text-[#F28B82]"
              >
                <ShieldOff className="h-3 w-3" /> Revoke
              </button>
            </div>
          </div>

          <div className="rounded-lg border border-neutral-200 bg-neutral-50 p-3.5 text-xs dark:border-neutral-800 dark:bg-neutral-950">
            <div className="font-semibold text-neutral-900 dark:text-neutral-100">
              Independent Verifier Token (Author ≠ Verifier Audit)
            </div>
            <div className="mt-2 flex flex-wrap items-center gap-1.5">
              <code className="font-mono-tabular rounded border border-neutral-200 bg-white px-2 py-1 text-[11px] dark:border-neutral-700 dark:bg-neutral-900">
                {showVerifierToken ? verifierTokenValue : `${verifierTokenValue.slice(0, 14)}••••••••••`}
              </code>
              <button
                type="button"
                onClick={() => setShowVerifierToken((s) => !s)}
                aria-label="Toggle verifier token visibility"
                className="rounded border border-neutral-200 bg-white p-1 dark:border-neutral-700 dark:bg-neutral-900"
              >
                {showVerifierToken ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
              </button>
              <button
                type="button"
                onClick={() => void copyText('vtoken', verifierTokenValue)}
                className="inline-flex items-center gap-1 rounded border border-neutral-200 bg-white px-2 py-1 font-semibold text-[#1B6B46] dark:border-neutral-700 dark:bg-neutral-900 dark:text-[#6CD19B]"
              >
                <Copy className="h-3 w-3" />
                {copiedId === 'vtoken' ? 'Copied' : 'Copy'}
              </button>
              <button
                type="button"
                onClick={() => void handleRotateToken('verifier')}
                className="inline-flex items-center gap-1 rounded border border-neutral-200 bg-white px-2 py-1 dark:border-neutral-700 dark:bg-neutral-900"
              >
                <RefreshCw className="h-3 w-3" /> Rotate
              </button>
              <button
                type="button"
                onClick={() => void handleRevokeToken('verifier')}
                className="inline-flex items-center gap-1 rounded border border-neutral-200 bg-white px-2 py-1 text-[#B9382C] dark:border-neutral-700 dark:bg-neutral-900 dark:text-[#F28B82]"
              >
                <ShieldOff className="h-3 w-3" /> Revoke
              </button>
            </div>
          </div>
        </div>

        {/* Agent Setup Snippets */}
        <div className="mt-4 space-y-3">
          <div className="flex flex-wrap gap-2">
            {AGENT_TOOLS.map((tool) => (
              <button
                key={tool.id}
                type="button"
                onClick={() => setSelectedTool(tool.id)}
                className={`rounded-lg border px-3 py-1.5 text-xs font-semibold transition ${
                  selectedTool === tool.id
                    ? 'border-[#1B6B46] bg-[#1B6B46] text-white'
                    : 'border-neutral-200 bg-white text-neutral-700 dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-300'
                }`}
              >
                {tool.label}
              </button>
            ))}
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <div className="rounded-lg border border-neutral-200 bg-neutral-50 p-3 dark:border-neutral-800 dark:bg-neutral-950">
              <div className="mb-2 flex items-center justify-between text-xs">
                <span className="font-semibold">
                  {AGENT_TOOLS.find((t) => t.id === selectedTool)?.subtitle}
                </span>
                <button
                  type="button"
                  onClick={() => void copyText('setup', getSetupSnippet(selectedTool))}
                  className="inline-flex items-center gap-1 font-semibold text-[#1B6B46] dark:text-[#6CD19B]"
                >
                  <Copy className="h-3.5 w-3.5" />
                  {copiedId === 'setup' ? 'Copied!' : 'Copy Config'}
                </button>
              </div>
              <pre className="font-mono-tabular max-h-36 overflow-auto whitespace-pre-wrap break-all text-[11px] text-neutral-700 dark:text-neutral-300">
                {getSetupSnippet(selectedTool)}
              </pre>
            </div>

            <div className="rounded-lg border border-neutral-200 bg-neutral-50 p-3 dark:border-neutral-800 dark:bg-neutral-950">
              <div className="mb-2 flex items-center justify-between text-xs">
                <span className="font-semibold">Ready Prompt</span>
                <button
                  type="button"
                  onClick={() => void copyText('prompt', getReadyPrompt(selectedTool))}
                  className="inline-flex items-center gap-1 font-semibold text-[#1B6B46] dark:text-[#6CD19B]"
                >
                  <Copy className="h-3.5 w-3.5" />
                  {copiedId === 'prompt' ? 'Copied!' : 'Copy Prompt'}
                </button>
              </div>
              <p className="text-[11px] leading-relaxed text-neutral-700 dark:text-neutral-300">
                {getReadyPrompt(selectedTool)}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Human Approval Inbox + Source Comparison + Rollback History */}
      <div className="rounded-xl border border-neutral-200 bg-white p-6 dark:border-neutral-800 dark:bg-neutral-900">
        <div className="flex flex-wrap items-center justify-between gap-4 border-b border-neutral-200 pb-4 dark:border-neutral-800">
          <div>
            <h3 className="text-base font-bold text-neutral-900 dark:text-neutral-100">
              Human Approval Inbox ({draftQueue.length} Pending · {verifiedDraftIds.length} Verified)
            </h3>
            <p className="text-xs text-neutral-500 dark:text-neutral-400">
              Compare drafts against source PDFs, request revisions, batch approve verified packs,
              or roll back published versions.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <input
              value={reviewerName}
              onChange={(e) => setReviewerName(e.target.value)}
              placeholder="Reviewer name"
              className="rounded-lg border border-neutral-200 bg-white px-3 py-1.5 text-xs dark:border-neutral-700 dark:bg-neutral-800"
            />
            {onBatchApproveVerified && verifiedDraftIds.length > 0 && (
              <button
                type="button"
                disabled={busyId === '__batch__' || !reviewerName.trim()}
                onClick={() => void handleBatchApprove()}
                className="inline-flex items-center gap-1.5 rounded-lg bg-[#1B6B46] px-3.5 py-1.5 text-xs font-semibold text-white disabled:opacity-50"
              >
                <ShieldCheck className="h-3.5 w-3.5" />
                {busyId === '__batch__'
                  ? 'Publishing...'
                  : `Batch Approve Verified (${
                      selectedForBatch.length > 0
                        ? selectedForBatch.filter((id) => verifiedDraftIds.includes(id)).length
                        : verifiedDraftIds.length
                    })`}
              </button>
            )}
          </div>
        </div>

        {/* Inbox Filter Sub-Tabs */}
        <div className="mt-4 flex flex-wrap items-center gap-1 rounded-lg bg-neutral-100 p-1 text-xs dark:bg-neutral-800">
          {(
            [
              ['all_drafts', `All Drafts (${draftQueue.length})`],
              ['verified', `Verified Ready (${verifiedDraftIds.length})`],
              ['flagged', `Flagged / Revision (${flaggedDrafts.length})`],
              ['history', `Publish History & Rollback (${publishHistory.length})`],
            ] as const
          ).map(([id, label]) => (
            <button
              key={id}
              type="button"
              onClick={() => setInboxTab(id)}
              className={`rounded-md px-3 py-1.5 font-semibold ${
                inboxTab === id
                  ? 'bg-white text-[#1B6B46] shadow-sm dark:bg-neutral-900 dark:text-[#6CD19B]'
                  : 'text-neutral-600 dark:text-neutral-300'
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        {actionMessage && (
          <div className="mt-3 flex items-center gap-2 rounded-lg bg-[#1E7E4E]/10 px-3 py-2 text-xs font-medium text-[#1E7E4E] dark:text-[#6CD19B]">
            <CheckCircle2 className="h-4 w-4 shrink-0" />
            {actionMessage}
          </div>
        )}
        {actionError && (
          <div className="mt-3 rounded-lg border border-[#B9382C]/40 bg-[#B9382C]/10 px-3 py-2 text-xs font-medium text-[#B9382C] dark:text-[#F28B82]">
            {actionError}
          </div>
        )}

        {/* History & Rollback Tab */}
        {inboxTab === 'history' ? (
          publishHistory.length === 0 ? (
            <p className="py-8 text-center text-xs text-neutral-500">
              No published version snapshots recorded yet. Approve and publish a chapter to create v1
              rollback points.
            </p>
          ) : (
            <div className="mt-4 divide-y divide-neutral-200 text-xs dark:divide-neutral-800">
              {publishHistory.map((h) => (
                <div key={h.id} className="flex flex-wrap items-center justify-between gap-3 py-3">
                  <div>
                    <div className="font-bold text-neutral-900 dark:text-neutral-100">
                      {h.chapterId} · Pack v{h.packVersion} ({h.target})
                    </div>
                    <div className="font-mono-tabular text-[11px] text-neutral-500">
                      Published by {h.publishedBy} · {new Date(h.publishedAt).toLocaleString()} ·
                      SHA {h.checksumSha256.slice(0, 12)}
                      {h.note ? ` · ${h.note}` : ''}
                    </div>
                  </div>
                  {h.snapshot && (
                    <button
                      type="button"
                      disabled={busyId === h.chapterId}
                      onClick={() => void handleRollbackVersion(h.chapterId, h.packVersion)}
                      className="inline-flex items-center gap-1.5 rounded-lg border border-neutral-200 px-3 py-1.5 font-semibold hover:bg-neutral-50 dark:border-neutral-700 dark:hover:bg-neutral-800"
                    >
                      <RotateCcw className="h-3.5 w-3.5" />
                      Rollback to v{h.packVersion}
                    </button>
                  )}
                </div>
              ))}
            </div>
          )
        ) : visibleInboxChapters.length === 0 ? (
          <div className="py-8 text-center text-xs text-neutral-500">
            <Sparkles className="mx-auto mb-2 h-6 w-6 text-[#1B6B46] dark:text-[#6CD19B]" />
            No chapters in this inbox view right now.
          </div>
        ) : (
          <div className="divide-y divide-neutral-200 dark:divide-neutral-800">
            {visibleInboxChapters.map((ch) => {
              const report = reportByChapter.get(ch.chapterId);
              const stage: ReviewStage = ch.reviewStage ?? 'ai_generated';
              const stageMeta = STAGE_LABEL[stage] ?? STAGE_LABEL.ai_generated;
              const isVerified = verifiedDraftIds.includes(ch.chapterId);
              const isBusy = busyId === ch.chapterId;
              const isVerifying = verifyingId === ch.chapterId;

              return (
                <div key={ch.chapterId} className="space-y-3 py-4">
                  <div className="flex flex-wrap items-center justify-between gap-4">
                    <div className="flex items-start gap-3">
                      <input
                        type="checkbox"
                        disabled={!isVerified}
                        checked={selectedForBatch.includes(ch.chapterId)}
                        onChange={() => toggleBatchItem(ch.chapterId)}
                        className="mt-1 accent-[#1B6B46] disabled:opacity-40"
                      />
                      <div>
                        <div className="flex flex-wrap items-center gap-2 text-xs text-neutral-500">
                          <span>
                            Grade {ch.grade} · {ch.subjectName} · Ch {ch.chapterNumber}
                          </span>
                          <span className={`rounded px-2 py-0.5 text-[11px] font-semibold ${stageMeta.tone}`}>
                            {stageMeta.label}
                          </span>
                          {ch.authorWorkerId && (
                            <span>Author: {ch.authorWorkerId}</span>
                          )}
                          {ch.verifierWorkerId && (
                            <span>Verifier: {ch.verifierWorkerId}</span>
                          )}
                        </div>
                        <h4 className="mt-0.5 text-sm font-bold text-neutral-900 dark:text-neutral-100">
                          {ch.title}
                        </h4>
                        <div className="mt-1 text-xs text-neutral-600 dark:text-neutral-300">
                          {ch.concepts.length} concept(s) · {ch.questions.length} question(s)
                          {ch.revisionFeedback ? ` · Revision note: ${ch.revisionFeedback}` : ''}
                        </div>
                      </div>
                    </div>

                    <div className="flex flex-wrap items-center gap-1.5">
                      <button
                        type="button"
                        onClick={() => setCompareChapterId(ch.chapterId)}
                        className="inline-flex items-center gap-1 rounded-lg border border-neutral-200 px-2.5 py-1.5 text-xs font-semibold dark:border-neutral-700"
                      >
                        <BookOpen className="h-3.5 w-3.5" />
                        Compare Source
                      </button>

                      <button
                        type="button"
                        onClick={() =>
                          setExpandedComponentsId(
                            expandedComponentsId === ch.chapterId ? null : ch.chapterId,
                          )
                        }
                        className="rounded-lg border border-neutral-200 px-2.5 py-1.5 text-xs font-semibold dark:border-neutral-700"
                      >
                        Components (
                        {(ch.approvedConceptIds?.length ?? 0) + (ch.approvedQuestionIds?.length ?? 0)}
                        /{ch.concepts.length + ch.questions.length})
                      </button>

                      <button
                        type="button"
                        onClick={() => {
                          setQuickEditChapterId(ch.chapterId);
                          setQuickEditTitle(ch.title);
                          setQuickEditExplanation(ch.concepts[0]?.simpleExplanation ?? '');
                        }}
                        className="inline-flex items-center gap-1 rounded-lg border border-neutral-200 px-2.5 py-1.5 text-xs font-semibold dark:border-neutral-700"
                      >
                        <Edit3 className="h-3.5 w-3.5" />
                        Quick Edit
                      </button>

                      {onRunVerification && (
                        <button
                          type="button"
                          disabled={isVerifying}
                          onClick={async () => {
                            setVerifyingId(ch.chapterId);
                            setActionError('');
                            try {
                              await onRunVerification(ch.chapterId);
                              setExpandedReportId(ch.chapterId);
                            } finally {
                              setVerifyingId('');
                            }
                          }}
                          className="rounded-lg border border-neutral-200 px-2.5 py-1.5 text-xs font-semibold dark:border-neutral-700"
                        >
                          {isVerifying ? 'Auditing...' : 'Audit'}
                        </button>
                      )}

                      <button
                        type="button"
                        onClick={() => {
                          setFeedbackDraftId(
                            feedbackDraftId === ch.chapterId ? null : ch.chapterId,
                          );
                          setFeedbackAction('request_revision');
                        }}
                        className="rounded-lg border border-neutral-200 px-2.5 py-1.5 text-xs font-semibold text-[#B4690E] dark:border-neutral-700 dark:text-[#E6A756]"
                      >
                        Revision / Reject
                      </button>

                      <button
                        type="button"
                        onClick={() => onSelectChapter(ch.chapterId)}
                        className="rounded-lg border border-neutral-200 px-2.5 py-1.5 text-xs font-semibold dark:border-neutral-700"
                      >
                        Edit Full
                      </button>

                      <button
                        type="button"
                        disabled={isBusy || !reviewerName.trim()}
                        onClick={async () => {
                          setActionMessage('');
                          setActionError('');
                          setBusyId(ch.chapterId);
                          try {
                            await onApproveAndPublish(ch.chapterId, reviewerName);
                            setActionMessage(`Approved & published "${ch.title}".`);
                            await loadBridgeAndOverview();
                          } catch (err) {
                            setActionError(
                              err instanceof Error ? err.message : 'Approval failed.',
                            );
                          } finally {
                            setBusyId('');
                          }
                        }}
                        className="inline-flex items-center gap-1 rounded-lg bg-[#1B6B46] px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-50"
                      >
                        <ShieldCheck className="h-3.5 w-3.5" />
                        Approve &amp; Publish
                      </button>

                      <button
                        type="button"
                        disabled={isBusy}
                        onClick={() => void onDeleteChapter(ch.chapterId)}
                        aria-label={`Delete draft ${ch.title}`}
                        className="rounded-lg border border-neutral-200 p-1.5 text-[#B9382C] dark:border-neutral-700 dark:text-[#F28B82]"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </div>

                  {/* Inline Quick Edit Drawer */}
                  {quickEditChapterId === ch.chapterId && (
                    <div className="space-y-2 rounded-lg border border-neutral-200 bg-neutral-50 p-3 text-xs dark:border-neutral-800 dark:bg-neutral-950">
                      <div className="font-bold">Inline Quick Edit</div>
                      <input
                        value={quickEditTitle}
                        onChange={(e) => setQuickEditTitle(e.target.value)}
                        placeholder="Chapter title"
                        className="w-full rounded border border-neutral-200 bg-white px-2.5 py-1.5 dark:border-neutral-700 dark:bg-neutral-900"
                      />
                      <textarea
                        rows={3}
                        value={quickEditExplanation}
                        onChange={(e) => setQuickEditExplanation(e.target.value)}
                        placeholder="Primary concept simple explanation"
                        className="w-full rounded border border-neutral-200 bg-white px-2.5 py-1.5 dark:border-neutral-700 dark:bg-neutral-900"
                      />
                      <div className="flex gap-2">
                        <button
                          type="button"
                          onClick={() => void handleSaveQuickEdit(ch)}
                          className="rounded bg-[#1B6B46] px-3 py-1 font-semibold text-white"
                        >
                          Save Quick Edit
                        </button>
                        <button
                          type="button"
                          onClick={() => setQuickEditChapterId(null)}
                          className="rounded border border-neutral-200 px-3 py-1 dark:border-neutral-700"
                        >
                          Cancel
                        </button>
                      </div>
                    </div>
                  )}

                  {/* Request Revision / Reject Feedback Form */}
                  {feedbackDraftId === ch.chapterId && (
                    <div className="space-y-2 rounded-lg border border-amber-500/40 bg-[#FEF4E6]/60 p-3 text-xs dark:bg-[#3B2810]/40">
                      <div className="flex items-center gap-3">
                        <label className="flex items-center gap-1.5 font-semibold">
                          <input
                            type="radio"
                            checked={feedbackAction === 'request_revision'}
                            onChange={() => setFeedbackAction('request_revision')}
                          />
                          Request Revision (Agents fix)
                        </label>
                        <label className="flex items-center gap-1.5 font-semibold text-[#B9382C]">
                          <input
                            type="radio"
                            checked={feedbackAction === 'reject'}
                            onChange={() => setFeedbackAction('reject')}
                          />
                          Reject Draft
                        </label>
                      </div>
                      <input
                        value={feedbackReason}
                        onChange={(e) => setFeedbackReason(e.target.value)}
                        placeholder="Explain exact fix needed (e.g. Fix numerical unit to m/s² on Q2)..."
                        className="w-full rounded border border-neutral-200 bg-white px-3 py-1.5 dark:border-neutral-700 dark:bg-neutral-900"
                      />
                      <div className="flex gap-2">
                        <button
                          type="button"
                          disabled={isBusy}
                          onClick={() => void handleSubmitReviewDecision(ch.chapterId)}
                          className="rounded bg-[#B9382C] px-3 py-1 font-semibold text-white"
                        >
                          Send to Agent Feedback Queue
                        </button>
                        <button
                          type="button"
                          onClick={() => setFeedbackDraftId(null)}
                          className="rounded border border-neutral-200 px-3 py-1 dark:border-neutral-700"
                        >
                          Cancel
                        </button>
                      </div>
                    </div>
                  )}

                  {expandedComponentsId === ch.chapterId && (
                    <div className="space-y-3 rounded-lg border border-neutral-200 bg-neutral-50 p-4 text-xs dark:border-neutral-800 dark:bg-neutral-950">
                      <div className="font-bold text-neutral-900 dark:text-neutral-100">
                        Granular Component Approval — Concepts ({ch.approvedConceptIds?.length ?? 0}/
                        {ch.concepts.length}) · Questions ({ch.approvedQuestionIds?.length ?? 0}/
                        {ch.questions.length})
                      </div>
                      <div className="grid gap-3 md:grid-cols-2">
                        <div className="space-y-2">
                          <div className="font-semibold text-neutral-600 dark:text-neutral-300">
                            Concepts
                          </div>
                          {ch.concepts.map((c) => {
                            const approved =
                              ch.approvedConceptIds?.includes(c.id) ||
                              c.reviewStatus === 'approved';
                            return (
                              <div
                                key={c.id}
                                className="flex items-center justify-between gap-2 rounded border border-neutral-200 bg-white p-2.5 dark:border-neutral-800 dark:bg-neutral-900"
                              >
                                <div className="min-w-0">
                                  <div className="truncate font-semibold">{c.title}</div>
                                  <div className="text-[11px] text-neutral-500">
                                    {c.sourceBook} ({c.sourcePage})
                                  </div>
                                </div>
                                {approved ? (
                                  <span className="shrink-0 font-semibold text-[#1B6B46] dark:text-[#6CD19B]">
                                    Approved
                                  </span>
                                ) : (
                                  <button
                                    type="button"
                                    disabled={busyId === `${ch.chapterId}:${c.id}`}
                                    onClick={() =>
                                      void handleApproveComponent(ch.chapterId, 'concept', c.id)
                                    }
                                    className="shrink-0 rounded border border-[#1B6B46] px-2.5 py-1 text-[11px] font-semibold text-[#1B6B46] dark:border-[#6CD19B] dark:text-[#6CD19B]"
                                  >
                                    Approve
                                  </button>
                                )}
                              </div>
                            );
                          })}
                        </div>
                        <div className="space-y-2">
                          <div className="font-semibold text-neutral-600 dark:text-neutral-300">
                            Questions
                          </div>
                          {ch.questions.map((q) => {
                            const approved =
                              ch.approvedQuestionIds?.includes(q.id) ||
                              q.publicationStatus === 'approved';
                            return (
                              <div
                                key={q.id}
                                className="flex items-center justify-between gap-2 rounded border border-neutral-200 bg-white p-2.5 dark:border-neutral-800 dark:bg-neutral-900"
                              >
                                <div className="min-w-0">
                                  <div className="truncate font-semibold">
                                    [{q.questionType}] {q.statement}
                                  </div>
                                  <div className="truncate text-[11px] text-neutral-500">
                                    Key: {q.correctAnswer}
                                  </div>
                                </div>
                                {approved ? (
                                  <span className="shrink-0 font-semibold text-[#1B6B46] dark:text-[#6CD19B]">
                                    Approved
                                  </span>
                                ) : (
                                  <button
                                    type="button"
                                    disabled={busyId === `${ch.chapterId}:${q.id}`}
                                    onClick={() =>
                                      void handleApproveComponent(ch.chapterId, 'question', q.id)
                                    }
                                    className="shrink-0 rounded border border-[#1B6B46] px-2.5 py-1 text-[11px] font-semibold text-[#1B6B46] dark:border-[#6CD19B] dark:text-[#6CD19B]"
                                  >
                                    Approve
                                  </button>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    </div>
                  )}

                  {expandedReportId === ch.chapterId && report && (
                    <div className="rounded-lg border border-neutral-200 bg-neutral-50 p-4 text-xs dark:border-neutral-800 dark:bg-neutral-950">
                      <div className="mb-2 flex items-center justify-between font-bold">
                        <span>
                          Validator Score: {report.score}% ({report.checks.filter((c) => c.passed).length}/
                          {report.checks.length} passed)
                        </span>
                        <History className="h-3.5 w-3.5 text-neutral-400" />
                      </div>
                      <div className="grid gap-2 sm:grid-cols-3">
                        {report.checks.map((chk) => (
                          <div
                            key={chk.kind}
                            className="rounded border border-neutral-200 bg-white p-2 dark:border-neutral-800 dark:bg-neutral-900"
                          >
                            <div className="font-semibold capitalize">
                              {chk.kind.replace('_', ' ')} — {chk.passed ? 'PASS' : 'FLAG'}
                            </div>
                            <div className="text-[11px] text-neutral-500">{chk.summary}</div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Side-by-Side Content vs Source Book Modal */}
      {compareChapter && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="flex max-h-[90vh] w-full max-w-5xl flex-col rounded-xl border border-neutral-200 bg-white p-5 dark:border-neutral-800 dark:bg-neutral-900">
            <div className="flex items-center justify-between border-b border-neutral-200 pb-3 dark:border-neutral-800">
              <div>
                <h3 className="text-base font-bold text-neutral-900 dark:text-neutral-100">
                  Source Book vs Generated Draft Comparison — {compareChapter.title}
                </h3>
                <p className="text-xs text-neutral-500">
                  Verify mathematical accuracy and textbook alignment before approving.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setCompareChapterId(null)}
                className="rounded-lg p-1.5 hover:bg-neutral-100 dark:hover:bg-neutral-800"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="mt-4 grid min-h-0 flex-1 gap-4 overflow-y-auto md:grid-cols-2">
              <div className="rounded-lg border border-neutral-200 bg-neutral-50 p-4 text-xs dark:border-neutral-800 dark:bg-neutral-950">
                <div className="mb-2 font-bold text-[#1B6B46] dark:text-[#6CD19B]">
                  Linked Textbook Source ({linkedBook ? linkedBook.title : 'No PDF linked'})
                </div>
                <div className="whitespace-pre-wrap leading-relaxed text-neutral-700 dark:text-neutral-300">
                  {linkedBook?.extractedText ||
                    compareChapter.concepts.map((c) => `${c.sourceBook} (${c.sourcePage})`).join('\n') ||
                    'No textbook extract linked yet.'}
                </div>
              </div>

              <div className="space-y-3 rounded-lg border border-neutral-200 bg-white p-4 text-xs dark:border-neutral-800 dark:bg-neutral-900">
                <div className="font-bold text-neutral-900 dark:text-neutral-100">
                  Generated Draft ({compareChapter.concepts.length} concept(s),{' '}
                  {compareChapter.questions.length} question(s))
                </div>
                {compareChapter.concepts.map((c) => (
                  <div key={c.id} className="border-t border-neutral-200 pt-2 dark:border-neutral-800">
                    <div className="font-semibold">{c.title}</div>
                    <p className="mt-1 text-neutral-600 dark:text-neutral-300">{c.simpleExplanation}</p>
                  </div>
                ))}
                {compareChapter.questions.slice(0, 6).map((q) => (
                  <div key={q.id} className="border-t border-neutral-200 pt-2 dark:border-neutral-800">
                    <div className="font-semibold">
                      [{q.questionType}] {q.statement}
                    </div>
                    <div className="text-[#1B6B46] dark:text-[#6CD19B]">
                      Key: {q.correctAnswer}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
