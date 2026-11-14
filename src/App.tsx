import { useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  CheckCircle2,
  Download,
  Moon,
  Plus,
  ShieldCheck,
  Sun,
} from 'lucide-react';
import { MotionConfig } from 'motion/react';
import { AgentBridgePanel } from './components/AgentBridgePanel';
import { AnalyticsView } from './components/AnalyticsView';
import { BookUploader } from './components/BookUploader';
import { MotionScreenSwap } from './components/MotionSystem';
import { ProductionControlPanel } from './components/ProductionControlPanel';
import { SmartQuestionGenerator } from './components/SmartQuestionGenerator';
import { StudentPreview } from './components/StudentPreview';
import { INITIAL_CMS_CHAPTERS, KPK_BOARDS } from './data/cmsSeed';
import type {
  CmsChapter,
  CmsConcept,
  CmsQuestion,
  PublicationStatus,
  QuestionType,
  SandboxAttemptRecord,
  SourceType,
  VerificationReport,
} from './types/cms';

type WorkspaceSection = 'preview' | 'ops' | 'uploader' | 'studio' | 'analytics';

const STORAGE_CHAPTERS_KEY = 'roshan_study_cms_chapters_v2';
const STORAGE_ATTEMPTS_KEY = 'roshan_study_sandbox_attempts_v2';

function validateChapter(ch: CmsChapter): string[] {
  const issues: string[] = [];
  if (!ch.permissionVerified) {
    issues.push('Confirm text-only summary or copyright permission before publishing.');
  }
  if (ch.concepts.length === 0) issues.push('At least 1 concept is required.');
  for (const c of ch.concepts) {
    if (!c.sourceBook.trim() || !c.sourcePage.trim()) {
      issues.push(`Concept "${c.title}" needs textbook source & page reference.`);
    }
    if (!c.simpleExplanation.trim()) {
      issues.push(`Concept "${c.title}" needs a simple explanation.`);
    }
  }
  for (const q of ch.questions) {
    if (q.statement.trim().length < 5) {
      issues.push(`Question ${q.id} needs a clear statement.`);
    }
    if (!q.explanation.trim()) {
      issues.push(`Question ${q.id} is missing an explanation.`);
    }
    if (q.questionType === 'mcq') {
      if (q.options.length < 2) {
        issues.push(`MCQ ${q.id} needs at least 2 options.`);
      } else if (
        !q.correctAnswer.trim() ||
        !q.options.some((o) => o.trim().toLowerCase() === q.correctAnswer.trim().toLowerCase())
      ) {
        issues.push(`MCQ ${q.id} correct answer must match one of its options.`);
      }
    }
    if (
      q.questionType === 'numerical' &&
      (!q.numericalSteps ||
        q.numericalSteps.given.length === 0 ||
        !q.numericalSteps.required.trim() ||
        !q.numericalSteps.formula.trim() ||
        !q.numericalSteps.substitution.trim() ||
        !q.numericalSteps.calculation.trim() ||
        !q.numericalSteps.answerWithUnit.trim())
    ) {
      issues.push(`Numerical ${q.id} must include all 6 solution steps.`);
    }
    if (
      (q.sourceType === 'official_past_paper' ||
        q.sourceType === 'official_model_paper') &&
      (!q.sourceBoardId || !q.sourceYear)
    ) {
      issues.push(`Official paper question ${q.id} requires board & year.`);
    }
    if (
      (q.questionType === 'long_answer' ||
        q.sourceType === 'official_past_paper' ||
        q.origin === 'ai_generated_draft') &&
      !q.reviewedBy.trim()
    ) {
      issues.push(
        q.origin === 'ai_generated_draft'
          ? `AI Draft question "${q.statement.slice(0, 36)}..." requires reviewer sign-off before publishing.`
          : `Question ${q.id} requires human reviewer sign-off.`,
      );
    }
  }
  return issues;
}

export default function App() {
  const [darkMode, setDarkMode] = useState(false);
  const [section, setSection] = useState<WorkspaceSection>('preview');

  const [chapters, setChapters] = useState<CmsChapter[]>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_CHAPTERS_KEY);
      if (saved) {
        const parsed = JSON.parse(saved) as CmsChapter[];
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      }
    } catch {
      // ignore storage failure
    }
    return INITIAL_CMS_CHAPTERS;
  });

  const [attempts, setAttempts] = useState<SandboxAttemptRecord[]>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_ATTEMPTS_KEY);
      if (saved) return JSON.parse(saved) as SandboxAttemptRecord[];
    } catch {
      // ignore
    }
    return [];
  });

  const [activeChapterId, setActiveChapterId] = useState<string>(
    chapters[0]?.chapterId ?? 'phy_9_ch2',
  );
  const [verificationReports, setVerificationReports] = useState<VerificationReport[]>([]);
  const [studioTab, setStudioTab] = useState<
    'ai_generator' | 'agent_bridge' | 'concepts' | 'videos' | 'questions'
  >('ai_generator');

  // Concept form
  const [cTitle, setCTitle] = useState('');
  const [cExplanation, setCExplanation] = useState('');
  const [cSourceBook, setCSourceBook] = useState('KPECTB Textbook (English Medium)');
  const [cSourcePage, setCSourcePage] = useState('');
  const [cRtl, setCRtl] = useState(false);

  // YouTube + Urdu Hint form
  const [vTitle, setVTitle] = useState('');
  const [vChannel, setVChannel] = useState('');
  const [vUrl, setVUrl] = useState('');
  const [vDuration, setVDuration] = useState('8 min');
  const [gTerm, setGTerm] = useState('');
  const [gUrdu, setGUrdu] = useState('');
  const [gHint, setGHint] = useState('');

  // Question form
  const [qType, setQType] = useState<QuestionType>('mcq');
  const [qDifficulty, setQDifficulty] = useState<1 | 2 | 3 | 4 | 5 | 6 | 7>(2);
  const [qSourceType, setQSourceType] = useState<SourceType>('practice_original');
  const [qBoard, setQBoard] = useState<string>(KPK_BOARDS[0]);
  const [qYear, setQYear] = useState<string>('2024');
  const [qStatement, setQStatement] = useState('');
  const [qOptionsRaw, setQOptionsRaw] = useState('Option A\nOption B\nOption C\nOption D');
  const [qCorrect, setQCorrect] = useState('');
  const [qExplanation, setQExplanation] = useState('');
  const [qReviewer, setQReviewer] = useState('');
  const [qGiven, setQGiven] = useState('');
  const [qRequired, setQRequired] = useState('');
  const [qFormula, setQFormula] = useState('');
  const [qSubstitution, setQSubstitution] = useState('');
  const [qCalculation, setQCalculation] = useState('');
  const [qFormError, setQFormError] = useState('');

  useEffect(() => {
    document.documentElement.classList.toggle('dark', darkMode);
  }, [darkMode]);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_CHAPTERS_KEY, JSON.stringify(chapters));
    } catch {
      // ignore
    }
  }, [chapters]);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_ATTEMPTS_KEY, JSON.stringify(attempts));
    } catch {
      // ignore
    }
  }, [attempts]);

  const refreshCloudWorkspace = async () => {
    try {
      const [chapRes, opsRes] = await Promise.all([
        fetch('/api/cms/chapters'),
        fetch('/api/cms/ops-overview'),
      ]);
      if (chapRes.ok) {
        const chapData = (await chapRes.json()) as { chapters?: CmsChapter[] };
        if (Array.isArray(chapData.chapters) && chapData.chapters.length > 0) {
          setChapters(chapData.chapters);
        }
      }
      if (opsRes.ok) {
        const opsData = (await opsRes.json()) as {
          verificationReports?: VerificationReport[];
        };
        if (Array.isArray(opsData.verificationReports)) {
          setVerificationReports(opsData.verificationReports);
        }
      }
    } catch {
      // Keep localStorage cache if server unavailable
    }
  };

  useEffect(() => {
    let active = true;
    const hydrateFromCloud = async () => {
      try {
        const [chapRes, opsRes] = await Promise.all([
          fetch('/api/cms/chapters'),
          fetch('/api/cms/ops-overview'),
        ]);
        if (!active) return;
        if (chapRes.ok) {
          const data = (await chapRes.json()) as { chapters?: CmsChapter[] };
          if (active && Array.isArray(data.chapters) && data.chapters.length > 0) {
            setChapters(data.chapters);
          }
        }
        if (opsRes.ok) {
          const opsData = (await opsRes.json()) as {
            verificationReports?: VerificationReport[];
          };
          if (active && Array.isArray(opsData.verificationReports)) {
            setVerificationReports(opsData.verificationReports);
          }
        }
      } catch {
        // Keep localStorage cache if server unavailable
      }
    };
    void hydrateFromCloud();
    return () => {
      active = false;
    };
  }, []);

  const draftQueueCount = useMemo(
    () =>
      chapters.filter(
        (c) => c.publicationStatus === 'draft' || c.publicationStatus === 'in_review',
      ).length,
    [chapters],
  );

  const activeChapter = useMemo(
    () => chapters.find((c) => c.chapterId === activeChapterId) ?? chapters[0],
    [chapters, activeChapterId],
  );

  const validationIssues = useMemo(
    () => (activeChapter ? validateChapter(activeChapter) : []),
    [activeChapter],
  );

  const syncUpdatedChapter = (nextChapter: CmsChapter) => {
    void fetch(`/api/cms/chapters/${encodeURIComponent(nextChapter.chapterId)}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(nextChapter),
    }).catch(() => undefined);
  };

  const updateChapter = (
    chapterId: string,
    updater: (ch: CmsChapter) => CmsChapter,
  ) => {
    setChapters((prev) =>
      prev.map((c) => {
        if (c.chapterId !== chapterId) return c;
        const next = updater(c);
        syncUpdatedChapter(next);
        return next;
      }),
    );
  };

  const handleImportChapters = (incoming: CmsChapter[]) => {
    setChapters((prev) => {
      const byId = new Map(prev.map((p) => [p.chapterId, p]));
      for (const ch of incoming) {
        byId.set(ch.chapterId, ch);
      }
      return Array.from(byId.values());
    });
    if (incoming[0]) {
      setActiveChapterId(incoming[0].chapterId);
    }
    void fetch('/api/cms/chapters/import', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chapters: incoming }),
    }).catch(() => undefined);
  };

  const handleApproveAndPublishCloud = async (chapterId: string, reviewedBy: string) => {
    const res = await fetch(`/api/cms/chapters/${encodeURIComponent(chapterId)}/approve-publish`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ reviewedBy, verifyPermission: true }),
    });
    const data = (await res.json()) as { chapter?: CmsChapter; message?: string };
    if (!res.ok || !data.chapter) {
      throw new Error(data.message || 'Could not approve and publish chapter.');
    }
    setChapters((prev) => {
      const exists = prev.some((c) => c.chapterId === data.chapter!.chapterId);
      if (exists) {
        return prev.map((c) => (c.chapterId === data.chapter!.chapterId ? data.chapter! : c));
      }
      return [data.chapter!, ...prev];
    });
  };

  const handleDeleteCloudChapter = async (chapterId: string) => {
    await fetch(`/api/cms/chapters/${encodeURIComponent(chapterId)}`, { method: 'DELETE' }).catch(
      () => undefined,
    );
    setChapters((prev) => prev.filter((c) => c.chapterId !== chapterId));
  };

  const handleRunVerification = async (chapterId: string) => {
    const res = await fetch(`/api/cms/chapters/${encodeURIComponent(chapterId)}/verify`, {
      method: 'POST',
    });
    const data = (await res.json()) as {
      report?: VerificationReport;
      chapters?: CmsChapter[];
      message?: string;
    };
    if (!res.ok || !data.report) {
      throw new Error(data.message || 'Verification audit failed.');
    }
    if (Array.isArray(data.chapters) && data.chapters.length > 0) {
      setChapters(data.chapters);
    }
    setVerificationReports((prev) => [
      data.report!,
      ...prev.filter((r) => r.chapterId !== data.report!.chapterId),
    ]);
  };

  const handleBatchApproveVerified = async (chapterIds: string[], reviewedBy: string) => {
    const res = await fetch('/api/cms/chapters/batch-approve', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chapterIds, reviewedBy }),
    });
    const data = (await res.json()) as {
      approved?: string[];
      skipped?: { chapterId: string; reason: string }[];
      message?: string;
    };
    if (!res.ok) {
      throw new Error(data.message || 'Batch approval failed.');
    }
    await refreshCloudWorkspace();
    return {
      approved: Array.isArray(data.approved) ? data.approved.length : 0,
      skipped: Array.isArray(data.skipped) ? data.skipped.length : 0,
    };
  };

  const handleAddGeneratedQuestions = (chapterId: string, incoming: CmsQuestion[]) => {
    updateChapter(chapterId, (ch) => ({
      ...ch,
      questions: [...ch.questions, ...incoming],
    }));
  };

  const handleApproveAiQuestion = (chapterId: string, questionId: string) => {
    updateChapter(chapterId, (ch) => ({
      ...ch,
      questions: ch.questions.map((q) =>
        q.id === questionId
          ? {
              ...q,
              origin: q.origin === 'ai_generated_draft' ? 'ai_reviewed' : q.origin,
              reviewedBy: q.reviewedBy.trim() || 'Admin Reviewer',
              publicationStatus: 'approved',
            }
          : q,
      ),
    }));
  };

  const handleTogglePublish = () => {
    if (!activeChapter) return;
    if (activeChapter.publicationStatus !== 'published' && validationIssues.length > 0) {
      return;
    }
    const nextStatus: PublicationStatus =
      activeChapter.publicationStatus === 'published' ? 'unpublished' : 'published';
    updateChapter(activeChapter.chapterId, (ch) => ({
      ...ch,
      publicationStatus: nextStatus,
      packVersion: nextStatus === 'published' ? ch.packVersion + 1 : ch.packVersion,
    }));
  };

  const handleAddConcept = () => {
    if (!activeChapter || !cTitle.trim() || !cExplanation.trim()) return;
    const newConcept: CmsConcept = {
      id: `c_${activeChapter.chapterId}_${Date.now()}`,
      chapterId: activeChapter.chapterId,
      topicId: `${activeChapter.chapterId}_t1`,
      orderIndex: activeChapter.concepts.length + 1,
      title: cTitle.trim(),
      locale: cRtl ? 'ur' : 'en',
      textDirection: cRtl ? 'rtl' : 'ltr',
      simpleExplanation: cExplanation.trim(),
      definitions: [],
      importantPoints: [],
      formulas: [],
      diagramCaption: '',
      diagramSvg: '',
      workedExamplePrompt: '',
      workedExampleSteps: [],
      workedExampleAnswer: '',
      applications: [],
      commonMistake: '',
      commonMistakeCorrection: '',
      quickRevisionSummary: [cTitle.trim()],
      videoLinks: [],
      glossaryHints: [],
      microCards: [
        { stageTitle: '01. Core Intuition', body: cExplanation.trim() },
      ],
      sourceBook: cSourceBook.trim(),
      sourcePage: cSourcePage.trim(),
      reviewStatus: 'draft',
      reviewedBy: '',
    };
    updateChapter(activeChapter.chapterId, (ch) => ({
      ...ch,
      concepts: [...ch.concepts, newConcept],
    }));
    setCTitle('');
    setCExplanation('');
    setCSourcePage('');
  };

  const handleAddVideoLink = () => {
    if (!activeChapter || !activeChapter.concepts[0] || !vTitle.trim() || !vUrl.trim()) {
      return;
    }
    if (
      !vUrl.startsWith('https://www.youtube.com/') &&
      !vUrl.startsWith('https://youtube.com/') &&
      !vUrl.startsWith('https://youtu.be/')
    ) {
      return;
    }
    updateChapter(activeChapter.chapterId, (ch) => ({
      ...ch,
      concepts: ch.concepts.map((c, idx) =>
        idx === 0
          ? {
              ...c,
              videoLinks: [
                ...c.videoLinks,
                {
                  title: vTitle.trim(),
                  channelName: vChannel.trim() || 'Curated KPK Educator',
                  youtubeUrl: vUrl.trim(),
                  durationLabel: vDuration.trim() || '8 min',
                  language: 'ur',
                },
              ],
            }
          : c,
      ),
    }));
    setVTitle('');
    setVChannel('');
    setVUrl('');
  };

  const handleAddGlossaryHint = () => {
    if (!activeChapter || !activeChapter.concepts[0] || !gTerm.trim() || !gUrdu.trim()) {
      return;
    }
    updateChapter(activeChapter.chapterId, (ch) => ({
      ...ch,
      concepts: ch.concepts.map((c, idx) =>
        idx === 0
          ? {
              ...c,
              glossaryHints: [
                ...c.glossaryHints,
                {
                  term: gTerm.trim(),
                  urduMeaning: gUrdu.trim(),
                  simpleHint: gHint.trim() || gTerm.trim(),
                },
              ],
            }
          : c,
      ),
    }));
    setGTerm('');
    setGUrdu('');
    setGHint('');
  };

  const handleAddQuestion = () => {
    setQFormError('');
    if (!activeChapter) return;
    if (!qStatement.trim() || !qCorrect.trim() || !qExplanation.trim()) {
      setQFormError('Question statement, correct answer, and explanation are required.');
      return;
    }

    const parsedOptions =
      qType === 'mcq'
        ? qOptionsRaw
            .split('\n')
            .map((s) => s.trim())
            .filter(Boolean)
        : [];
    if (qType === 'mcq') {
      if (parsedOptions.length < 2) {
        setQFormError('Enter at least 2 distinct MCQ options (one per line).');
        return;
      }
      const matchedOpt = parsedOptions.find(
        (o) => o.toLowerCase() === qCorrect.trim().toLowerCase(),
      );
      if (!matchedOpt) {
        setQFormError('MCQ correct answer must match one of the listed options.');
        return;
      }
    }

    const parsedGiven = qGiven
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);
    if (
      qType === 'numerical' &&
      (parsedGiven.length === 0 ||
        !qRequired.trim() ||
        !qFormula.trim() ||
        !qSubstitution.trim() ||
        !qCalculation.trim())
    ) {
      setQFormError('Fill in all 6 numerical steps (Given, Required, Formula, Substitution, Calculation, Answer).');
      return;
    }

    const parsedYear = Number(qYear);
    if (
      qSourceType !== 'practice_original' &&
      (!Number.isInteger(parsedYear) || parsedYear < 1990 || parsedYear > 2035)
    ) {
      setQFormError('Enter a valid exam year between 1990 and 2035 for official papers.');
      return;
    }

    const resolvedCorrect =
      qType === 'mcq'
        ? parsedOptions.find((o) => o.toLowerCase() === qCorrect.trim().toLowerCase()) ??
          qCorrect.trim()
        : qCorrect.trim();

    const newQ: CmsQuestion = {
      id: `q_${activeChapter.chapterId}_${Date.now()}`,
      programmeId: activeChapter.programmeId,
      grade: activeChapter.grade,
      groupId: activeChapter.groupId,
      subjectId: activeChapter.subjectId,
      chapterId: activeChapter.chapterId,
      topicId: `${activeChapter.chapterId}_t1`,
      conceptId: activeChapter.concepts[0]?.id ?? '',
      questionType: qType,
      difficulty: qDifficulty,
      statement: qStatement.trim(),
      options: parsedOptions,
      hints: [],
      numericalSteps:
        qType === 'numerical'
          ? {
              given: parsedGiven,
              required: qRequired.trim(),
              formula: qFormula.trim(),
              substitution: qSubstitution.trim(),
              calculation: qCalculation.trim(),
              answerWithUnit: resolvedCorrect,
            }
          : undefined,
      markingPoints:
        qType === 'short_answer' || qType === 'long_answer'
          ? [resolvedCorrect]
          : [],
      correctAnswer: resolvedCorrect,
      explanation: qExplanation.trim(),
      marks: qType === 'long_answer' ? 7 : qType === 'numerical' ? 4 : 1,
      sourceType: qSourceType,
      sourceBoardId: qSourceType === 'practice_original' ? undefined : qBoard,
      sourceYear: qSourceType === 'practice_original' ? undefined : parsedYear,
      publicationStatus: 'draft',
      reviewedBy: qReviewer.trim(),
    };
    updateChapter(activeChapter.chapterId, (ch) => ({
      ...ch,
      questions: [...ch.questions, newQ],
    }));
    setQStatement('');
    setQCorrect('');
    setQExplanation('');
    setQGiven('');
    setQRequired('');
    setQFormula('');
    setQSubstitution('');
    setQCalculation('');
  };

  const handleExportPackJson = () => {
    if (!activeChapter) return;
    const blob = new Blob([JSON.stringify(activeChapter, null, 2)], {
      type: 'application/json',
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${activeChapter.chapterId}_v${activeChapter.packVersion}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <MotionConfig reducedMotion="user">
      <div className="min-h-screen bg-[#F7FAF8] text-neutral-900 dark:bg-[#101412] dark:text-neutral-100">
        {/* Strict 3-Zone Top Bar Contract */}
      <header className="border-b border-neutral-200 bg-white px-6 py-3.5 dark:border-neutral-800 dark:bg-[#171D1A]">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-8">
          <button
            type="button"
            onClick={() => setSection('preview')}
            className="font-display shrink-0 whitespace-nowrap text-lg font-bold tracking-tight text-neutral-900 dark:text-white"
          >
            Roshan Study
          </button>

          <nav className="flex items-center gap-6 overflow-x-auto text-sm font-medium text-neutral-600 dark:text-neutral-300">
            {(
              [
                ['preview', 'Student App'],
                ['ops', 'Admin Control'],
                ['uploader', 'Books & Uploader'],
                ['studio', 'Content & Inbox'],
                ['analytics', 'Analytics'],
              ] as const
            ).map(([id, label]) => (
              <button
                key={id}
                type="button"
                onClick={() => setSection(id)}
                className={`shrink-0 whitespace-nowrap border-b-2 py-1 transition-colors ${
                  section === id
                    ? 'border-[#1B6B46] font-semibold text-[#1B6B46] dark:border-[#6CD19B] dark:text-[#6CD19B]'
                    : 'border-transparent hover:text-neutral-900 dark:hover:text-white'
                }`}
              >
                {label}
              </button>
            ))}
          </nav>

          <button
            type="button"
            onClick={handleExportPackJson}
            className="inline-flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-lg bg-[#1B6B46] px-4 py-2 text-xs font-semibold text-white hover:bg-[#155537]"
          >
            <Download className="h-3.5 w-3.5" />
            Export Pack
          </button>
        </div>
      </header>

      {/* Workspace Context Bar */}
      <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-4 px-6 pt-5">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-neutral-900 dark:text-neutral-100">
            {section === 'preview' && 'KPK Student Interactive Learning Preview'}
            {section === 'ops' && 'Autonomous AI Production Control & Monitoring'}
            {section === 'uploader' && 'Easy Book Importer & Sample Pack Generator'}
            {section === 'studio' && 'Content Studio & Publish Validation Gate'}
            {section === 'analytics' && 'Coverage Analytics & 10k DAU Planner'}
          </h1>
          <p className="text-xs text-neutral-500 dark:text-neutral-400">
            Grades 9–12 English Medium · 8 KPK BISE Boards · {chapters.length} chapters loaded · Zero-account offline-first Flutter + Cloudflare architecture
          </p>
        </div>

        <button
          type="button"
          onClick={() => setDarkMode((d) => !d)}
          className="inline-flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-lg border border-neutral-200 bg-white px-3 py-1.5 text-xs font-medium text-neutral-700 hover:bg-neutral-50 dark:border-neutral-800 dark:bg-neutral-900 dark:text-neutral-200"
        >
          {darkMode ? <Sun className="h-3.5 w-3.5" /> : <Moon className="h-3.5 w-3.5" />}
          {darkMode ? 'Light Mode' : 'Dark Mode'}
        </button>
      </div>

      {/* Main Content */}
      <main className="mx-auto max-w-6xl px-6 py-6">
        <MotionScreenSwap motionKey={section}>
        {section === 'preview' && (
          <StudentPreview
            chapters={chapters}
            attempts={attempts}
            onRecordAttempt={(a) => setAttempts((prev) => [a, ...prev])}
            onClearAttempts={() => setAttempts([])}
          />
        )}

        {section === 'ops' && (
          <ProductionControlPanel
            chapters={chapters}
            onRefreshChapters={refreshCloudWorkspace}
            onOpenDraftInbox={() => {
              setSection('studio');
              setStudioTab('agent_bridge');
            }}
            onInspectChapter={(chapterId) => {
              setActiveChapterId(chapterId);
              setSection('studio');
              setStudioTab('concepts');
            }}
          />
        )}

        {section === 'uploader' && (
          <BookUploader
            existingChapterIds={chapters.map((c) => c.chapterId)}
            onImportChapters={handleImportChapters}
            onOpenAiGenerator={() => {
              setSection('studio');
              setStudioTab('ai_generator');
            }}
            onOpenAgentBridge={() => {
              setSection('studio');
              setStudioTab('agent_bridge');
            }}
            onOpenOpsControl={() => setSection('ops')}
          />
        )}

        {section === 'analytics' && (
          <AnalyticsView
            chapters={chapters}
            attempts={attempts}
            onClearAttempts={() => setAttempts([])}
          />
        )}

        {section === 'studio' && activeChapter && (
          <div className="grid items-start gap-6 lg:grid-cols-[280px_1fr]">
            {/* Chapter Selector Sidebar */}
            <aside className="rounded-xl border border-neutral-200 bg-white p-4 dark:border-neutral-800 dark:bg-neutral-900">
              <h2 className="mb-3 text-sm font-bold">Chapters ({chapters.length})</h2>
              <div className="space-y-2">
                {chapters.map((ch) => (
                  <button
                    key={ch.chapterId}
                    type="button"
                    onClick={() => setActiveChapterId(ch.chapterId)}
                    className={`w-full rounded-lg border p-3 text-left text-xs transition ${
                      ch.chapterId === activeChapter.chapterId
                        ? 'border-[#1B6B46] bg-[#D6F0E1]/35 dark:border-[#6CD19B] dark:bg-[#174F33]/40'
                        : 'border-neutral-200 hover:bg-neutral-50 dark:border-neutral-800 dark:hover:bg-neutral-800'
                    }`}
                  >
                    <div className="font-semibold text-neutral-900 dark:text-neutral-100">
                      G{ch.grade} · Ch {ch.chapterNumber}: {ch.title}
                    </div>
                    <div className="mt-1 text-neutral-500 dark:text-neutral-400">
                      {ch.subjectName} · {ch.publicationStatus}
                    </div>
                  </button>
                ))}
              </div>
            </aside>

            {/* Chapter Editor */}
            <div className="space-y-5">
              <div className="rounded-xl border border-neutral-200 bg-white p-5 dark:border-neutral-800 dark:bg-neutral-900">
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div>
                    <div className="text-xs text-neutral-500 dark:text-neutral-400">
                      Grade {activeChapter.grade} · {activeChapter.subjectName} · Pack v{activeChapter.packVersion}
                    </div>
                    <h2 className="mt-0.5 text-lg font-bold">
                      Chapter {activeChapter.chapterNumber}: {activeChapter.title}
                    </h2>
                  </div>

                  <button
                    type="button"
                    onClick={handleTogglePublish}
                    disabled={
                      activeChapter.publicationStatus !== 'published' &&
                      validationIssues.length > 0
                    }
                    className={`inline-flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-lg px-4 py-2 text-xs font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50 ${
                      activeChapter.publicationStatus === 'published'
                        ? 'bg-[#B4690E]'
                        : 'bg-[#1B6B46]'
                    }`}
                  >
                    <ShieldCheck className="h-4 w-4" />
                    {activeChapter.publicationStatus === 'published'
                      ? 'Unpublish Chapter'
                      : 'Validate & Publish'}
                  </button>
                </div>

                {validationIssues.length > 0 ? (
                  <div className="mt-3 rounded-lg border border-[#B9382C]/40 bg-[#B9382C]/10 p-3 text-xs">
                    <div className="mb-1 flex items-center gap-1.5 font-semibold text-[#B9382C] dark:text-[#F28B82]">
                      <AlertTriangle className="h-4 w-4" />
                      Publish Gate Blocked ({validationIssues.length} items to fix)
                    </div>
                    <ul className="list-disc space-y-0.5 pl-4">
                      {validationIssues.map((issue, idx) => (
                        <li key={idx}>{issue}</li>
                      ))}
                    </ul>
                    {!activeChapter.permissionVerified && (
                      <label className="mt-2.5 inline-flex cursor-pointer items-center gap-2 font-medium text-neutral-800 dark:text-neutral-200">
                        <input
                          type="checkbox"
                          checked={activeChapter.permissionVerified}
                          onChange={(e) =>
                            updateChapter(activeChapter.chapterId, (ch) => ({
                              ...ch,
                              permissionVerified: e.target.checked,
                            }))
                          }
                          className="accent-[#1B6B46]"
                        />
                        Confirm text-only summary or copyright permission verified
                      </label>
                    )}
                  </div>
                ) : (
                  <div className="mt-3 flex items-center gap-2 rounded-lg bg-[#1E7E4E]/10 px-3 py-2 text-xs font-medium text-[#1E7E4E] dark:text-[#6CD19B]">
                    <CheckCircle2 className="h-4 w-4" />
                    Schema, source-citation, and reviewer sign-off checks passed.
                  </div>
                )}

                <div className="mt-4 flex flex-wrap gap-2 border-t border-neutral-200 pt-3 dark:border-neutral-800">
                  {(
                    [
                      ['ai_generator', 'AI Question Generator'],
                      ['agent_bridge', `AI Agent & MCP Bridge (${draftQueueCount} drafts)`],
                      ['concepts', 'Concepts (12-Part)'],
                      ['videos', 'YouTube Links & Urdu Help'],
                      ['questions', `Questions (${activeChapter.questions.length})`],
                    ] as const
                  ).map(([id, label]) => (
                    <button
                      key={id}
                      type="button"
                      onClick={() => setStudioTab(id)}
                      className={`shrink-0 whitespace-nowrap rounded-lg px-3 py-1.5 text-xs font-semibold ${
                        studioTab === id
                          ? 'bg-[#1B6B46] text-white'
                          : 'bg-neutral-100 text-neutral-700 dark:bg-neutral-800 dark:text-neutral-300'
                      }`}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              </div>

              {studioTab === 'ai_generator' && (
                <SmartQuestionGenerator
                  chapter={activeChapter}
                  onAddQuestionsToChapter={handleAddGeneratedQuestions}
                />
              )}

              {studioTab === 'agent_bridge' && (
                <AgentBridgePanel
                  chapters={chapters}
                  verificationReports={verificationReports}
                  onApproveAndPublish={handleApproveAndPublishCloud}
                  onBatchApproveVerified={handleBatchApproveVerified}
                  onRunVerification={handleRunVerification}
                  onDeleteChapter={handleDeleteCloudChapter}
                  onSelectChapter={(chapterId) => {
                    setActiveChapterId(chapterId);
                    setStudioTab('concepts');
                  }}
                  onRefreshWorkspace={refreshCloudWorkspace}
                />
              )}

              {studioTab === 'concepts' && (
                <div className="grid gap-5 md:grid-cols-2">
                  <div className="space-y-3 rounded-xl border border-neutral-200 bg-white p-5 text-xs dark:border-neutral-800 dark:bg-neutral-900">
                    <h3 className="text-sm font-bold">Add Concept Unit</h3>
                    <input
                      value={cTitle}
                      onChange={(e) => setCTitle(e.target.value)}
                      placeholder="Concept Title"
                      className="w-full rounded-lg border border-neutral-200 bg-white px-3 py-2 dark:border-neutral-700 dark:bg-neutral-800"
                    />
                    <textarea
                      rows={4}
                      value={cExplanation}
                      onChange={(e) => setCExplanation(e.target.value)}
                      dir={cRtl ? 'rtl' : 'ltr'}
                      placeholder="Simple explanation"
                      className="w-full rounded-lg border border-neutral-200 bg-white px-3 py-2 dark:border-neutral-700 dark:bg-neutral-800"
                    />
                    <input
                      value={cSourceBook}
                      onChange={(e) => setCSourceBook(e.target.value)}
                      placeholder="Source Book & Edition"
                      className="w-full rounded-lg border border-neutral-200 bg-white px-3 py-2 dark:border-neutral-700 dark:bg-neutral-800"
                    />
                    <input
                      value={cSourcePage}
                      onChange={(e) => setCSourcePage(e.target.value)}
                      placeholder="Source Page Reference"
                      className="w-full rounded-lg border border-neutral-200 bg-white px-3 py-2 dark:border-neutral-700 dark:bg-neutral-800"
                    />
                    <label className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        checked={cRtl}
                        onChange={(e) => setCRtl(e.target.checked)}
                        className="accent-[#1B6B46]"
                      />
                      Urdu RTL text direction
                    </label>
                    <button
                      type="button"
                      onClick={handleAddConcept}
                      className="inline-flex items-center gap-1.5 rounded-lg bg-[#1B6B46] px-4 py-2 font-semibold text-white"
                    >
                      <Plus className="h-4 w-4" />
                      Save Concept Draft
                    </button>
                  </div>

                  <div className="space-y-3 rounded-xl border border-neutral-200 bg-white p-5 text-xs dark:border-neutral-800 dark:bg-neutral-900">
                    <h3 className="text-sm font-bold">
                      Concepts ({activeChapter.concepts.length})
                    </h3>
                    {activeChapter.concepts.map((c) => (
                      <div
                        key={c.id}
                        dir={c.textDirection}
                        className="border-b border-neutral-200 pb-3 last:border-b-0 dark:border-neutral-800"
                      >
                        <div className="font-semibold text-neutral-900 dark:text-neutral-100">
                          {c.title}
                        </div>
                        <p className="mt-1 text-neutral-600 dark:text-neutral-300">
                          {c.simpleExplanation}
                        </p>
                        <div className="mt-1 text-neutral-500">
                          {c.sourceBook} · {c.sourcePage}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {studioTab === 'videos' && (
                <div className="grid gap-5 md:grid-cols-2">
                  <div className="space-y-3 rounded-xl border border-neutral-200 bg-white p-5 text-xs dark:border-neutral-800 dark:bg-neutral-900">
                    <h3 className="text-sm font-bold">Attach Curated YouTube Video</h3>
                    <input
                      value={vTitle}
                      onChange={(e) => setVTitle(e.target.value)}
                      placeholder="Video title (e.g. Equations of Motion in Urdu)"
                      className="w-full rounded-lg border border-neutral-200 bg-white px-3 py-2 dark:border-neutral-700 dark:bg-neutral-800"
                    />
                    <input
                      value={vChannel}
                      onChange={(e) => setVChannel(e.target.value)}
                      placeholder="Teacher / Channel name"
                      className="w-full rounded-lg border border-neutral-200 bg-white px-3 py-2 dark:border-neutral-700 dark:bg-neutral-800"
                    />
                    <input
                      value={vUrl}
                      onChange={(e) => setVUrl(e.target.value)}
                      placeholder="https://www.youtube.com/watch?v=... or https://youtu.be/..."
                      className="w-full rounded-lg border border-neutral-200 bg-white px-3 py-2 dark:border-neutral-700 dark:bg-neutral-800"
                    />
                    <input
                      value={vDuration}
                      onChange={(e) => setVDuration(e.target.value)}
                      placeholder="Duration (e.g. 8 min)"
                      className="w-full rounded-lg border border-neutral-200 bg-white px-3 py-2 dark:border-neutral-700 dark:bg-neutral-800"
                    />
                    <button
                      type="button"
                      onClick={handleAddVideoLink}
                      className="inline-flex items-center gap-1.5 rounded-lg bg-[#1B6B46] px-4 py-2 font-semibold text-white"
                    >
                      <Plus className="h-4 w-4" />
                      Add YouTube Link
                    </button>
                  </div>

                  <div className="space-y-3 rounded-xl border border-neutral-200 bg-white p-5 text-xs dark:border-neutral-800 dark:bg-neutral-900">
                    <h3 className="text-sm font-bold">Add 1-Tap Urdu Term Hint</h3>
                    <input
                      value={gTerm}
                      onChange={(e) => setGTerm(e.target.value)}
                      placeholder="English term (e.g. Equilibrium)"
                      className="w-full rounded-lg border border-neutral-200 bg-white px-3 py-2 dark:border-neutral-700 dark:bg-neutral-800"
                    />
                    <input
                      dir="rtl"
                      value={gUrdu}
                      onChange={(e) => setGUrdu(e.target.value)}
                      placeholder="اردو معنی"
                      className="w-full rounded-lg border border-neutral-200 bg-white px-3 py-2 dark:border-neutral-700 dark:bg-neutral-800"
                    />
                    <input
                      value={gHint}
                      onChange={(e) => setGHint(e.target.value)}
                      placeholder="1-line simple English hint"
                      className="w-full rounded-lg border border-neutral-200 bg-white px-3 py-2 dark:border-neutral-700 dark:bg-neutral-800"
                    />
                    <button
                      type="button"
                      onClick={handleAddGlossaryHint}
                      className="inline-flex items-center gap-1.5 rounded-lg bg-[#1B6B46] px-4 py-2 font-semibold text-white"
                    >
                      <Plus className="h-4 w-4" />
                      Add Urdu Term Hint
                    </button>
                  </div>
                </div>
              )}

              {studioTab === 'questions' && (
                <div className="grid gap-5 md:grid-cols-2">
                  <div className="space-y-2.5 rounded-xl border border-neutral-200 bg-white p-5 text-xs dark:border-neutral-800 dark:bg-neutral-900">
                    <h3 className="text-sm font-bold">Add Question</h3>
                    <div className="grid grid-cols-2 gap-2">
                      <select
                        value={qType}
                        onChange={(e) => setQType(e.target.value as QuestionType)}
                        className="rounded-lg border border-neutral-200 bg-white px-2.5 py-2 dark:border-neutral-700 dark:bg-neutral-800"
                      >
                        <option value="mcq">MCQ</option>
                        <option value="multi_select">Multi-Select</option>
                        <option value="true_false">True / False</option>
                        <option value="fill_in">Fill-in</option>
                        <option value="matching">Matching</option>
                        <option value="numerical">Numerical (6-Step)</option>
                        <option value="short_answer">Short Answer</option>
                        <option value="long_answer">Long Answer</option>
                        <option value="conceptual">Conceptual</option>
                      </select>
                      <select
                        value={qDifficulty}
                        onChange={(e) =>
                          setQDifficulty(Number(e.target.value) as 1 | 2 | 3 | 4 | 5 | 6 | 7)
                        }
                        className="rounded-lg border border-neutral-200 bg-white px-2.5 py-2 dark:border-neutral-700 dark:bg-neutral-800"
                      >
                        {[1, 2, 3, 4, 5, 6, 7].map((lvl) => (
                          <option key={lvl} value={lvl}>
                            Level {lvl}
                          </option>
                        ))}
                      </select>
                    </div>

                    <select
                      value={qSourceType}
                      onChange={(e) => setQSourceType(e.target.value as SourceType)}
                      className="w-full rounded-lg border border-neutral-200 bg-white px-2.5 py-2 dark:border-neutral-700 dark:bg-neutral-800"
                    >
                      <option value="practice_original">Practice Question (Original)</option>
                      <option value="official_past_paper">Official BISE Past Paper</option>
                      <option value="official_model_paper">Official BISE Model Paper</option>
                    </select>

                    {qSourceType !== 'practice_original' && (
                      <div className="grid grid-cols-2 gap-2">
                        <select
                          value={qBoard}
                          onChange={(e) => setQBoard(e.target.value)}
                          className="rounded-lg border border-neutral-200 bg-white px-2.5 py-2 dark:border-neutral-700 dark:bg-neutral-800"
                        >
                          {KPK_BOARDS.map((b) => (
                            <option key={b} value={b}>
                              {b}
                            </option>
                          ))}
                        </select>
                        <input
                          value={qYear}
                          onChange={(e) => setQYear(e.target.value)}
                          placeholder="Year"
                          className="rounded-lg border border-neutral-200 bg-white px-2.5 py-2 dark:border-neutral-700 dark:bg-neutral-800"
                        />
                      </div>
                    )}

                    <textarea
                      rows={3}
                      value={qStatement}
                      onChange={(e) => setQStatement(e.target.value)}
                      placeholder="Question statement"
                      className="w-full rounded-lg border border-neutral-200 bg-white px-3 py-2 dark:border-neutral-700 dark:bg-neutral-800"
                    />

                    {qType === 'mcq' && (
                      <textarea
                        rows={3}
                        value={qOptionsRaw}
                        onChange={(e) => setQOptionsRaw(e.target.value)}
                        placeholder="One option per line"
                        className="w-full rounded-lg border border-neutral-200 bg-white px-3 py-2 dark:border-neutral-700 dark:bg-neutral-800"
                      />
                    )}

                    {qType === 'numerical' && (
                      <div className="space-y-1.5 rounded-lg bg-neutral-50 p-3 dark:bg-neutral-800">
                        <div className="font-semibold">6-Step Numerical Fields</div>
                        <input
                          value={qGiven}
                          onChange={(e) => setQGiven(e.target.value)}
                          placeholder="Given (comma-separated)"
                          className="w-full rounded border border-neutral-200 bg-white px-2 py-1 dark:border-neutral-700 dark:bg-neutral-900"
                        />
                        <input
                          value={qRequired}
                          onChange={(e) => setQRequired(e.target.value)}
                          placeholder="Required"
                          className="w-full rounded border border-neutral-200 bg-white px-2 py-1 dark:border-neutral-700 dark:bg-neutral-900"
                        />
                        <input
                          value={qFormula}
                          onChange={(e) => setQFormula(e.target.value)}
                          placeholder="Formula"
                          className="w-full rounded border border-neutral-200 bg-white px-2 py-1 dark:border-neutral-700 dark:bg-neutral-900"
                        />
                        <input
                          value={qSubstitution}
                          onChange={(e) => setQSubstitution(e.target.value)}
                          placeholder="Substitution"
                          className="w-full rounded border border-neutral-200 bg-white px-2 py-1 dark:border-neutral-700 dark:bg-neutral-900"
                        />
                        <input
                          value={qCalculation}
                          onChange={(e) => setQCalculation(e.target.value)}
                          placeholder="Calculation"
                          className="w-full rounded border border-neutral-200 bg-white px-2 py-1 dark:border-neutral-700 dark:bg-neutral-900"
                        />
                      </div>
                    )}

                    <input
                      value={qCorrect}
                      onChange={(e) => setQCorrect(e.target.value)}
                      placeholder="Correct answer (with unit)"
                      className="w-full rounded-lg border border-neutral-200 bg-white px-3 py-2 dark:border-neutral-700 dark:bg-neutral-800"
                    />
                    <textarea
                      rows={2}
                      value={qExplanation}
                      onChange={(e) => setQExplanation(e.target.value)}
                      placeholder="Verified explanation"
                      className="w-full rounded-lg border border-neutral-200 bg-white px-3 py-2 dark:border-neutral-700 dark:bg-neutral-800"
                    />
                    <input
                      value={qReviewer}
                      onChange={(e) => setQReviewer(e.target.value)}
                      placeholder="Human Reviewer Sign-off"
                      className="w-full rounded-lg border border-neutral-200 bg-white px-3 py-2 dark:border-neutral-700 dark:bg-neutral-800"
                    />
                    {qFormError && (
                      <div className="rounded-lg border border-[#B9382C]/35 bg-[#FCECEA] px-3 py-2 text-xs font-medium text-[#B9382C] dark:bg-[#3A1B18] dark:text-[#F28B82]">
                        {qFormError}
                      </div>
                    )}
                    <button
                      type="button"
                      onClick={handleAddQuestion}
                      className="inline-flex items-center gap-1.5 rounded-lg bg-[#1B6B46] px-4 py-2 font-semibold text-white"
                    >
                      <Plus className="h-4 w-4" />
                      Add Question
                    </button>
                  </div>

                  <div className="space-y-3 rounded-xl border border-neutral-200 bg-white p-5 text-xs dark:border-neutral-800 dark:bg-neutral-900">
                    <h3 className="text-sm font-bold">
                      Questions ({activeChapter.questions.length})
                    </h3>
                    {activeChapter.questions.map((q) => (
                      <div
                        key={q.id}
                        className="border-b border-neutral-200 pb-3 last:border-b-0 dark:border-neutral-800"
                      >
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <div className="text-[11px] text-neutral-500 dark:text-neutral-400">
                            Level {q.difficulty} · {q.questionType.replace('_', ' ')} ·{' '}
                            {q.sourceType.replaceAll('_', ' ')}
                            {q.origin === 'ai_generated_draft' ? ' · AI Draft (Review Needed)' : ''}
                            {q.origin === 'ai_reviewed' ? ' · AI Reviewed' : ''}
                          </div>
                          {q.origin === 'ai_generated_draft' && !q.reviewedBy.trim() && (
                            <button
                              type="button"
                              onClick={() => handleApproveAiQuestion(activeChapter.chapterId, q.id)}
                              className="shrink-0 whitespace-nowrap rounded border border-[#1B6B46] px-2 py-0.5 text-[11px] font-semibold text-[#1B6B46] hover:bg-[#D6F0E1]/40 dark:border-[#6CD19B] dark:text-[#6CD19B]"
                            >
                              Approve Draft
                            </button>
                          )}
                        </div>
                        <div className="mt-1 font-medium text-neutral-900 dark:text-neutral-100">
                          {q.statement}
                        </div>
                        <div className="mt-1 text-neutral-600 dark:text-neutral-300">
                          Answer: {q.correctAnswer}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
        </MotionScreenSwap>
      </main>
    </div>
    </MotionConfig>
  );
}
