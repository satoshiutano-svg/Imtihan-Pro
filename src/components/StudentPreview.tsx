import { useEffect, useMemo, useState } from 'react';
import {
  BookOpen,
  CheckCircle2,
  ExternalLink,
  Flame,
  Lightbulb,
  MessageCircle,
  PlayCircle,
  RotateCcw,
  ShieldAlert,
  ShieldCheck,
  Sparkles,
  Volume2,
  XCircle,
} from 'lucide-react';
import {
  BOARD_CHALLENGE_MCQS,
  KPK_BOARDS,
  MDCAT_CHALLENGE_BANK,
} from '../data/cmsSeed';
import type {
  CmsChapter,
  CmsQuestion,
  DailyGoalState,
  SandboxAttemptRecord,
} from '../types/cms';
import {
  WhatsAppShareModal,
  type ShareCardPayload,
} from './WhatsAppShareModal';
import { isAnswerMatch } from '../utils/answerMatch';

interface StudentPreviewProps {
  chapters: CmsChapter[];
  onRecordAttempt: (attempt: SandboxAttemptRecord) => void;
}

const STORAGE_DAILY_GOAL_KEY = 'roshan_study_daily_goal_v1';

const MATCH_PAIRS = [
  { id: 'speed', left: 'Speed (v)', right: 'm/s (Scalar)' },
  { id: 'accel', left: 'Acceleration (a)', right: '(vf - vi) / t (m/s²)' },
  { id: 'kc', left: 'Equilibrium (Kc)', right: '[Products] / [Reactants]' },
  { id: 'coulomb', left: 'Coulomb Force', right: 'k·q₁q₂ / r² (N)' },
];

function localDateIso(d = new Date()): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function dayDiff(fromIso: string, toIso: string): number {
  const a = new Date(`${fromIso}T00:00:00Z`).getTime();
  const b = new Date(`${toIso}T00:00:00Z`).getTime();
  return Math.round((b - a) / 86400000);
}

function loadInitialDailyGoal(): DailyGoalState {
  const today = localDateIso();
  const fallback: DailyGoalState = {
    currentStreakDays: 1,
    longestStreakDays: 1,
    graceFreezesRemaining: 2,
    lastActiveDateIso: null,
    todayDateIso: today,
    todayQuestionsCompleted: 0,
    todayLessonsCompleted: 0,
    dailyQuestionTarget: 10,
    completedDailyTracks: {},
  };

  try {
    const raw = localStorage.getItem(STORAGE_DAILY_GOAL_KEY);
    if (!raw) return fallback;
    const saved = JSON.parse(raw) as DailyGoalState;
    if (!saved || saved.todayDateIso === today) return { ...fallback, ...saved };

    // Roll over to a new calendar day with forgiving grace freezes (load-shedding/exam protection)
    const gap = saved.lastActiveDateIso ? dayDiff(saved.lastActiveDateIso, today) : 0;
    let nextStreak = saved.currentStreakDays;
    let nextFreezes = saved.graceFreezesRemaining;

    if (gap > 1) {
      const missedDays = gap - 1;
      if (missedDays <= nextFreezes) {
        nextFreezes -= missedDays;
      } else {
        nextStreak = 0;
        nextFreezes = 2;
      }
    }

    return {
      ...fallback,
      ...saved,
      currentStreakDays: nextStreak,
      graceFreezesRemaining: nextFreezes,
      todayDateIso: today,
      todayQuestionsCompleted: 0,
      todayLessonsCompleted: 0,
    };
  } catch {
    return fallback;
  }
}

export function StudentPreview({ chapters, onRecordAttempt }: StudentPreviewProps) {
  const [board, setBoard] = useState<string>(KPK_BOARDS[0]);
  const [selectedChapterId, setSelectedChapterId] = useState<string>(
    chapters[0]?.chapterId ?? '',
  );
  const [mode, setMode] = useState<'learn' | 'practice' | 'daily10' | 'pastpapers' | 'match'>(
    'learn',
  );
  const [guidedMode, setGuidedMode] = useState<boolean>(true);
  const [microStep, setMicroStep] = useState<number>(0);
  const [microChoice, setMicroChoice] = useState<string | null>(null);
  const [activeUrduIdx, setActiveUrduIdx] = useState<number | null>(null);
  const [showAdPreview, setShowAdPreview] = useState<boolean>(true);
  const [showPostSessionAd, setShowPostSessionAd] = useState<boolean>(false);

  // 5-Minute Duolingo-Style Streak & Daily Goal state
  const [dailyGoal, setDailyGoal] = useState<DailyGoalState>(loadInitialDailyGoal);

  // Share Card Modal
  const [shareCard, setShareCard] = useState<ShareCardPayload | null>(null);

  // Practice engine state
  const [qIndex, setQIndex] = useState<number>(0);
  const [hintsShown, setHintsShown] = useState<number>(0);
  const [selectedOption, setSelectedOption] = useState<string>('');
  const [typedAnswer, setTypedAnswer] = useState<string>('');
  const [practiceError, setPracticeError] = useState<string>('');
  const [submitted, setSubmitted] = useState<boolean>(false);
  const [isCorrect, setIsCorrect] = useState<boolean>(false);
  const [checkedPoints, setCheckedPoints] = useState<number[]>([]);

  // Daily 10-MCQ Challenge state (isolated Board vs MDCAT)
  const [challengeTrack, setChallengeTrack] = useState<'board' | 'mdcat'>('board');
  const [challengeIdx, setChallengeIdx] = useState<number>(0);
  const [challengeSelected, setChallengeSelected] = useState<string>('');
  const [challengeSubmitted, setChallengeSubmitted] = useState<boolean>(false);
  const [challengeScore, setChallengeScore] = useState<number>(0);
  const [challengeFinished, setChallengeFinished] = useState<boolean>(false);

  // Past Paper Browser filters
  const [ppBoardFilter, setPpBoardFilter] = useState<string>('ALL');
  const [ppGradeFilter, setPpGradeFilter] = useState<string>('ALL');
  const [ppSubjectFilter, setPpSubjectFilter] = useState<string>('ALL');
  const [ppTypeFilter, setPpTypeFilter] = useState<string>('ALL');
  const [expandedPaperId, setExpandedPaperId] = useState<string | null>(null);

  // Formula Match state
  const [matchLeft, setMatchLeft] = useState<string | null>(null);
  const [matchedIds, setMatchedIds] = useState<string[]>([]);
  const [matchFeedback, setMatchFeedback] = useState<string>('');

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_DAILY_GOAL_KEY, JSON.stringify(dailyGoal));
    } catch {
      // ignore storage quota errors
    }
  }, [dailyGoal]);

  const bumpDailyGoalProgress = (addQuestions: number, addLessons: number) => {
    const today = localDateIso();
    setDailyGoal((prev) => {
      const nextQs = prev.todayQuestionsCompleted + addQuestions;
      const nextLessons = prev.todayLessonsCompleted + addLessons;
      const goalHit = nextQs >= prev.dailyQuestionTarget || nextLessons >= 1;
      const alreadyCountedToday = prev.lastActiveDateIso === today;

      let nextStreak = prev.currentStreakDays;
      if (goalHit && !alreadyCountedToday) {
        nextStreak = prev.currentStreakDays + 1;
      } else if (nextStreak === 0 && (nextQs > 0 || nextLessons > 0)) {
        nextStreak = 1;
      }

      return {
        ...prev,
        todayDateIso: today,
        lastActiveDateIso: goalHit ? today : prev.lastActiveDateIso,
        currentStreakDays: nextStreak,
        longestStreakDays: Math.max(prev.longestStreakDays, nextStreak),
        todayQuestionsCompleted: nextQs,
        todayLessonsCompleted: nextLessons,
      };
    });
  };

  const chapter = useMemo(
    () => chapters.find((c) => c.chapterId === selectedChapterId) ?? chapters[0],
    [chapters, selectedChapterId],
  );

  const concept = chapter?.concepts[0];
  const questions = chapter?.questions ?? [];
  const currentQ: CmsQuestion | undefined = questions[qIndex];

  // Daily 10-MCQ queues (strictly isolating MDCAT from SSC/HSSC board pool)
  const challengeQuestions = useMemo(() => {
    if (challengeTrack === 'mdcat') {
      return MDCAT_CHALLENGE_BANK.slice(0, 10);
    }
    const chapterMcqs = chapters.flatMap((c) =>
      c.questions.filter((q) => q.programmeId === 'ssc_hssc' && q.questionType === 'mcq'),
    );
    const seen = new Set(chapterMcqs.map((q) => q.id));
    const merged = [
      ...chapterMcqs,
      ...BOARD_CHALLENGE_MCQS.filter((q) => !seen.has(q.id)),
    ];
    return merged.slice(0, 10);
  }, [challengeTrack, chapters]);

  const activeChallengeQ = challengeQuestions[challengeIdx];

  // Chapter-wise Solved Past Paper Browser index across loaded chapters + model board pool
  const pastPaperEntries = useMemo(() => {
    const fromChapters = chapters.flatMap((ch) =>
      ch.questions.map((q) => ({
        question: q,
        subjectName: ch.subjectName,
        chapterNumber: ch.chapterNumber,
        chapterTitle: ch.title,
      })),
    );
    const seen = new Set(fromChapters.map((e) => e.question.id));
    const extraModelPapers = BOARD_CHALLENGE_MCQS.filter((q) => !seen.has(q.id)).map((q) => ({
      question: q,
      subjectName:
        q.subjectId.startsWith('phy')
          ? 'Physics (English Medium)'
          : q.subjectId.startsWith('chem')
            ? 'Chemistry (English Medium)'
            : q.subjectId.startsWith('math')
              ? 'Mathematics (English Medium)'
              : 'Biology (English Medium)',
      chapterNumber: q.grade === 9 ? 2 : q.grade === 10 ? 9 : 2,
      chapterTitle:
        q.subjectId.startsWith('phy_9')
          ? 'Kinematics'
          : q.subjectId.startsWith('chem_10')
            ? 'Chemical Equilibrium'
            : 'Vectors & Foundations',
    }));
    return [...fromChapters, ...extraModelPapers];
  }, [chapters]);

  const availableSubjects = useMemo(() => {
    return Array.from(new Set(pastPaperEntries.map((e) => e.subjectName)));
  }, [pastPaperEntries]);

  const filteredPastPapers = useMemo(() => {
    return pastPaperEntries.filter(({ question, subjectName }) => {
      if (ppBoardFilter !== 'ALL' && question.sourceBoardId !== ppBoardFilter) return false;
      if (ppGradeFilter !== 'ALL' && question.grade !== Number(ppGradeFilter)) return false;
      if (ppSubjectFilter !== 'ALL' && subjectName !== ppSubjectFilter) return false;
      if (ppTypeFilter !== 'ALL' && question.questionType !== ppTypeFilter) return false;
      return true;
    });
  }, [pastPaperEntries, ppBoardFilter, ppGradeFilter, ppSubjectFilter, ppTypeFilter]);

  const resetPractice = (nextIdx = 0) => {
    setQIndex(nextIdx);
    setHintsShown(0);
    setSelectedOption('');
    setTypedAnswer('');
    setPracticeError('');
    setSubmitted(false);
    setIsCorrect(false);
    setCheckedPoints([]);
  };

  const resetDailyChallenge = (nextTrack: 'board' | 'mdcat') => {
    setChallengeTrack(nextTrack);
    setChallengeIdx(0);
    setChallengeSelected('');
    setChallengeSubmitted(false);
    setChallengeScore(0);
    setChallengeFinished(false);
  };

  const handleChapterChange = (id: string) => {
    setSelectedChapterId(id);
    setMicroStep(0);
    setMicroChoice(null);
    setActiveUrduIdx(null);
    setShowPostSessionAd(false);
    resetPractice(0);
  };

  const handleSubmitQuestion = () => {
    if (!currentQ || !chapter) return;
    setPracticeError('');

    let ok = false;
    if (currentQ.questionType === 'short_answer' || currentQ.questionType === 'long_answer') {
      const effectivePoints =
        currentQ.markingPoints.length > 0
          ? currentQ.markingPoints
          : ['My written answer matches the key points in the model answer above.'];
      const needed = Math.max(1, Math.ceil(effectivePoints.length / 2));
      ok = checkedPoints.length >= needed;
    } else {
      const raw = currentQ.options.length > 0 ? selectedOption : typedAnswer;
      if (!raw.trim()) {
        setPracticeError(
          currentQ.options.length > 0
            ? 'Please select an answer option before submitting.'
            : 'Please enter your answer before submitting.',
        );
        return;
      }
      ok = isAnswerMatch(raw, currentQ.correctAnswer, currentQ.questionType);
    }

    setSubmitted(true);
    setIsCorrect(ok);
    bumpDailyGoalProgress(1, 0);
    onRecordAttempt({
      id: `att_${Date.now()}`,
      programmeId: currentQ.programmeId,
      questionId: currentQ.id,
      chapterId: chapter.chapterId,
      subjectName: chapter.subjectName,
      conceptTitle: concept?.title ?? chapter.title,
      isCorrect: ok,
      difficulty: currentQ.difficulty,
      timestamp: new Date().toISOString(),
    });
  };

  const handleNextQuestion = () => {
    if (qIndex + 1 < questions.length) {
      resetPractice(qIndex + 1);
    } else {
      setShowPostSessionAd(true);
    }
  };

  const handleSubmitChallengeQuestion = () => {
    if (!activeChallengeQ || !challengeSelected) return;
    const ok = challengeSelected === activeChallengeQ.correctAnswer;
    setChallengeSubmitted(true);
    if (ok) setChallengeScore((s) => s + 1);
    bumpDailyGoalProgress(1, 0);
    onRecordAttempt({
      id: `att_daily_${Date.now()}`,
      programmeId: challengeTrack === 'mdcat' ? 'mdcat' : 'ssc_hssc',
      questionId: activeChallengeQ.id,
      chapterId: activeChallengeQ.chapterId,
      subjectName: challengeTrack === 'mdcat' ? 'MDCAT Daily Challenge' : 'KPK Board Daily 10',
      conceptTitle: `Daily 10-MCQ (${challengeTrack === 'mdcat' ? 'MDCAT' : 'Board'})`,
      isCorrect: ok,
      difficulty: activeChallengeQ.difficulty,
      timestamp: new Date().toISOString(),
    });
  };

  const handleNextChallengeQuestion = () => {
    if (challengeIdx + 1 < challengeQuestions.length) {
      setChallengeIdx((i) => i + 1);
      setChallengeSelected('');
      setChallengeSubmitted(false);
    } else {
      setChallengeFinished(true);
      const trackKey = `${dailyGoal.todayDateIso}_${challengeTrack}`;
      setDailyGoal((prev) => ({
        ...prev,
        completedDailyTracks: {
          ...prev.completedDailyTracks,
          [trackKey]: {
            score: challengeScore,
            total: challengeQuestions.length,
            completedAt: new Date().toISOString(),
          },
        },
      }));
    }
  };

  const handleTapMatchRight = (pairId: string, label: string) => {
    if (!matchLeft || matchedIds.includes(pairId)) return;
    if (matchLeft === pairId) {
      setMatchedIds((prev) => [...prev, pairId]);
      setMatchFeedback(`Matched: ${label}`);
      setMatchLeft(null);
    } else {
      setMatchFeedback('Not a match — check the unit or formula carefully.');
    }
  };

  const dailyPct = Math.min(
    100,
    dailyGoal.todayLessonsCompleted >= 1
      ? 100
      : Math.round((dailyGoal.todayQuestionsCompleted / dailyGoal.dailyQuestionTarget) * 100),
  );

  if (!chapter) {
    return (
      <div className="rounded-xl border border-neutral-200 bg-white p-8 text-center dark:border-neutral-800 dark:bg-neutral-900">
        <p className="text-sm text-neutral-600 dark:text-neutral-300">
          No chapters available yet. Use Book Uploader to add or generate sample chapters.
        </p>
      </div>
    );
  }

  const microCards = concept?.microCards ?? [];
  const safeMicroStep =
    microCards.length > 0 ? Math.min(microStep, microCards.length - 1) : 0;
  const activeMicroCard = microCards[safeMicroStep];

  return (
    <div className="space-y-6">
      {/* Unified Calm Study Header: Context + Streak + Mode Switcher */}
      <div className="space-y-4 border-b border-neutral-200 pb-4 dark:border-neutral-800">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex flex-wrap items-center gap-3">
            <select
              aria-label="Select KPK BISE Board"
              value={board}
              onChange={(e) => setBoard(e.target.value)}
              className="min-h-10 rounded-lg border border-neutral-200 bg-white px-3 py-2 text-xs font-medium text-neutral-900 dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-100"
            >
              {KPK_BOARDS.map((b) => (
                <option key={b} value={b}>
                  {b}
                </option>
              ))}
            </select>

            <select
              aria-label="Select Chapter"
              value={chapter.chapterId}
              onChange={(e) => handleChapterChange(e.target.value)}
              className="min-h-10 rounded-lg border border-neutral-200 bg-white px-3 py-2 text-xs font-medium text-neutral-900 dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-100"
            >
              {chapters.map((ch) => (
                <option key={ch.chapterId} value={ch.chapterId}>
                  Grade {ch.grade} · {ch.subjectName} — Ch {ch.chapterNumber}: {ch.title}
                </option>
              ))}
            </select>
          </div>

          {/* 5-Minute Study Routine Status */}
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex items-center gap-1.5">
              <Flame className="h-4 w-4 text-[#B4690E] dark:text-[#E6A756]" />
              <span className="font-mono-tabular text-xs font-semibold text-neutral-900 dark:text-neutral-100">
                {dailyGoal.currentStreakDays}-day streak
              </span>
            </div>
            <span className="text-xs text-neutral-500 dark:text-neutral-400">
              Goal:{' '}
              <span className="font-mono-tabular font-semibold text-neutral-800 dark:text-neutral-200">
                {dailyGoal.todayQuestionsCompleted}/{dailyGoal.dailyQuestionTarget}
              </span>{' '}
              Qs · Grace:{' '}
              <span className="font-mono-tabular font-semibold">
                {dailyGoal.graceFreezesRemaining}
              </span>
            </span>
            <div className="h-1.5 w-24 overflow-hidden rounded-full bg-neutral-200 dark:bg-neutral-800">
              <div
                className="h-full bg-[#1B6B46] transition-all duration-200 dark:bg-[#6CD19B]"
                style={{ width: `${dailyPct}%` }}
              />
            </div>
          </div>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-1 overflow-x-auto rounded-lg bg-neutral-100 p-1 dark:bg-neutral-800/80">
            {(
              [
                ['learn', 'Learn Lesson'],
                ['practice', `Practice (${questions.length})`],
                ['daily10', 'Daily 10-MCQ'],
                ['pastpapers', 'Past Papers'],
                ['match', 'Formula Match'],
              ] as const
            ).map(([id, label]) => (
              <button
                key={id}
                type="button"
                onClick={() => {
                  setMode(id);
                  setShowPostSessionAd(false);
                }}
                className={`min-h-9 shrink-0 whitespace-nowrap rounded-md px-3 py-1.5 text-xs font-semibold transition-colors ${
                  mode === id
                    ? 'bg-white text-[#1B6B46] dark:bg-neutral-900 dark:text-[#6CD19B]'
                    : 'text-neutral-600 hover:text-neutral-900 dark:text-neutral-300 dark:hover:text-white'
                }`}
              >
                {label}
              </button>
            ))}
          </div>

          <label className="flex cursor-pointer items-center gap-2 whitespace-nowrap text-xs text-neutral-600 dark:text-neutral-300">
            <input
              type="checkbox"
              checked={showAdPreview}
              onChange={(e) => setShowAdPreview(e.target.checked)}
              className="accent-[#1B6B46]"
            />
            Ad Slot Preview
          </label>
        </div>
      </div>

      {/* Interactive Student Stage + Mobile Companion */}
      <div className="grid items-start gap-6 lg:grid-cols-[1fr_340px]">
        <div className="rounded-xl border border-neutral-200 bg-white p-6 dark:border-neutral-800 dark:bg-neutral-900">
          {/* LEARN LESSON */}
          {mode === 'learn' && concept && (
            <div className="space-y-6">
              <div className="flex flex-wrap items-start justify-between gap-4 border-b border-neutral-200 pb-4 dark:border-neutral-800">
                <div>
                  <p className="text-xs text-neutral-500 dark:text-neutral-400">
                    Grade {chapter.grade} · {chapter.subjectName} · {board}
                    {chapter.isSampleTestPack ? ' · Sample Test Draft' : ''}
                  </p>
                  <h2 className="mt-1 text-xl font-bold text-neutral-900 dark:text-neutral-100">
                    {concept.title}
                  </h2>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    onClick={() =>
                      setShareCard({
                        kicker: `Grade ${chapter.grade} ${chapter.subjectName}`,
                        title: concept.title,
                        lines: [
                          concept.simpleExplanation,
                          ...(concept.formulas[0]
                            ? [`Formula: ${concept.formulas[0].expression} (${concept.formulas[0].description})`]
                            : []),
                          ...(concept.quickRevisionSummary.length > 0
                            ? [`Key Summary: ${concept.quickRevisionSummary.join(' · ')}`]
                            : []),
                        ],
                      })
                    }
                    className="inline-flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-lg border border-neutral-200 px-3 py-1.5 text-xs font-semibold text-[#1B6B46] hover:bg-neutral-50 dark:border-neutral-700 dark:text-[#6CD19B] dark:hover:bg-neutral-800"
                  >
                    <MessageCircle className="h-3.5 w-3.5" />
                    Share Card
                  </button>

                  {concept.microCards.length > 0 && (
                    <div className="flex items-center gap-1 rounded-lg bg-neutral-100 p-1 dark:bg-neutral-800">
                      <button
                        type="button"
                        onClick={() => setGuidedMode(true)}
                        className={`shrink-0 whitespace-nowrap rounded-md px-3 py-1.5 text-xs font-semibold ${
                          guidedMode
                            ? 'bg-white text-[#1B6B46] shadow-sm dark:bg-neutral-900 dark:text-[#6CD19B]'
                            : 'text-neutral-600 dark:text-neutral-300'
                        }`}
                      >
                        5-Min Guided
                      </button>
                      <button
                        type="button"
                        onClick={() => setGuidedMode(false)}
                        className={`shrink-0 whitespace-nowrap rounded-md px-3 py-1.5 text-xs font-semibold ${
                          !guidedMode
                            ? 'bg-white text-[#1B6B46] shadow-sm dark:bg-neutral-900 dark:text-[#6CD19B]'
                            : 'text-neutral-600 dark:text-neutral-300'
                        }`}
                      >
                        Full Textbook
                      </button>
                    </div>
                  )}
                </div>
              </div>

              {guidedMode && activeMicroCard ? (
                <div className="space-y-5">
                  <div className="space-y-2">
                    <div className="flex justify-between text-xs text-neutral-500 dark:text-neutral-400">
                      <span>
                        Step {safeMicroStep + 1} of {microCards.length}
                      </span>
                      <span className="font-mono-tabular">
                        {Math.round(((safeMicroStep + 1) / microCards.length) * 100)}%
                      </span>
                    </div>
                    <div className="h-2 w-full overflow-hidden rounded-full bg-neutral-100 dark:bg-neutral-800">
                      <div
                        className="h-full bg-[#1B6B46] transition-all duration-200 dark:bg-[#6CD19B]"
                        style={{
                          width: `${((safeMicroStep + 1) / microCards.length) * 100}%`,
                        }}
                      />
                    </div>
                  </div>

                  <div className="space-y-4 py-2">
                    <h3 className="text-base font-semibold text-[#1B6B46] dark:text-[#6CD19B]">
                      {activeMicroCard.stageTitle}
                    </h3>
                    <p className="text-base leading-relaxed text-neutral-800 dark:text-neutral-200">
                      {activeMicroCard.body}
                    </p>

                    {activeMicroCard.quickCheckQuestion && (
                      <div className="space-y-3 border-t border-neutral-200 pt-4 dark:border-neutral-800">
                        <p className="text-sm font-semibold text-neutral-900 dark:text-neutral-100">
                          {activeMicroCard.quickCheckQuestion}
                        </p>
                        <div className="grid gap-2 sm:grid-cols-3">
                          {activeMicroCard.quickCheckOptions?.map((opt) => (
                            <button
                              key={opt}
                              type="button"
                              onClick={() => setMicroChoice(opt)}
                              className={`rounded-lg border px-3 py-2.5 text-left text-sm font-medium transition ${
                                microChoice === opt
                                  ? 'border-[#1B6B46] bg-[#D6F0E1]/40 text-[#0A3320] dark:border-[#6CD19B] dark:bg-[#174F33]/50 dark:text-[#ECF2EE]'
                                  : 'border-neutral-200 hover:bg-neutral-50 dark:border-neutral-700 dark:hover:bg-neutral-800'
                              }`}
                            >
                              {opt}
                            </button>
                          ))}
                        </div>
                        {microChoice && (
                          <p
                            className={`flex items-center gap-1.5 text-sm font-medium ${
                              microChoice === activeMicroCard.quickCheckAnswer
                                ? 'text-[#1E7E4E] dark:text-[#6CD19B]'
                                : 'text-[#B9382C] dark:text-[#F28B82]'
                            }`}
                          >
                            {microChoice === activeMicroCard.quickCheckAnswer ? (
                              <>
                                <CheckCircle2 className="h-4 w-4" />
                                Correct — clean intuition!
                              </>
                            ) : (
                              <>
                                <XCircle className="h-4 w-4" />
                                Not quite — correct answer is{' '}
                                {activeMicroCard.quickCheckAnswer}.
                              </>
                            )}
                          </p>
                        )}
                      </div>
                    )}
                  </div>

                  <div className="flex items-center justify-between border-t border-neutral-200 pt-4 dark:border-neutral-800">
                    <button
                      type="button"
                      disabled={safeMicroStep === 0}
                      onClick={() => {
                        setMicroStep((s) => Math.max(0, s - 1));
                        setMicroChoice(null);
                      }}
                      className="rounded-lg border border-neutral-200 px-4 py-2 text-xs font-semibold disabled:opacity-40 dark:border-neutral-700"
                    >
                      Previous
                    </button>

                    {safeMicroStep < microCards.length - 1 ? (
                      <button
                        type="button"
                        onClick={() => {
                          setMicroStep((s) => Math.min(microCards.length - 1, s + 1));
                          setMicroChoice(null);
                        }}
                        className="rounded-lg bg-[#1B6B46] px-4 py-2 text-xs font-semibold text-white hover:bg-[#155537]"
                      >
                        Next Step
                      </button>
                    ) : (
                      <button
                        type="button"
                        onClick={() => {
                          bumpDailyGoalProgress(0, 1);
                          setMode('practice');
                          resetPractice(0);
                        }}
                        className="rounded-lg bg-[#1B6B46] px-4 py-2 text-xs font-semibold text-white hover:bg-[#155537]"
                      >
                        Complete 5-Min Lesson & Practise
                      </button>
                    )}
                  </div>
                </div>
              ) : (
                <div className="space-y-6">
                  <p className="text-base leading-relaxed text-neutral-800 dark:text-neutral-200">
                    {concept.simpleExplanation}
                  </p>

                  {concept.diagramSvg && (
                    <div
                      className="overflow-hidden rounded-lg border border-neutral-200 bg-neutral-50 p-4 dark:border-neutral-800 dark:bg-neutral-950"
                      dangerouslySetInnerHTML={{ __html: concept.diagramSvg }}
                    />
                  )}

                  {concept.formulas.length > 0 && (
                    <div className="space-y-2 border-t border-neutral-200 pt-4 dark:border-neutral-800">
                      <h3 className="text-sm font-semibold text-neutral-900 dark:text-neutral-100">
                        Key Formulas
                      </h3>
                      <div className="grid gap-3 sm:grid-cols-2">
                        {concept.formulas.map((f, idx) => (
                          <div key={idx} className="rounded-lg bg-neutral-50 p-3 dark:bg-neutral-800">
                            <div className="font-mono-tabular text-base font-bold text-[#1B6B46] dark:text-[#6CD19B]">
                              {f.expression}
                            </div>
                            <div className="mt-1 text-xs text-neutral-600 dark:text-neutral-300">
                              {f.description}
                              {f.unit ? ` · Unit: ${f.unit}` : ''}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {concept.glossaryHints.length > 0 && (
                <div className="space-y-3 border-t border-neutral-200 pt-4 dark:border-neutral-800">
                  <div className="flex items-center gap-2 text-sm font-semibold text-neutral-900 dark:text-neutral-100">
                    <Volume2 className="h-4 w-4 text-[#1B6B46] dark:text-[#6CD19B]" />
                    1-Tap Urdu Meaning Help (Tap any term)
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {concept.glossaryHints.map((g, idx) => (
                      <button
                        key={g.term}
                        type="button"
                        onClick={() => setActiveUrduIdx(activeUrduIdx === idx ? null : idx)}
                        className={`rounded-lg border px-3 py-1.5 text-xs font-medium ${
                          activeUrduIdx === idx
                            ? 'border-[#1B6B46] bg-[#D6F0E1]/50 text-[#0A3320] dark:border-[#6CD19B] dark:bg-[#174F33] dark:text-white'
                            : 'border-neutral-200 hover:bg-neutral-50 dark:border-neutral-700 dark:hover:bg-neutral-800'
                        }`}
                      >
                        {g.term}
                      </button>
                    ))}
                  </div>
                  {activeUrduIdx !== null && concept.glossaryHints[activeUrduIdx] && (
                    <div className="rounded-lg bg-neutral-50 p-3 text-sm dark:bg-neutral-800">
                      <div dir="rtl" className="text-base font-semibold text-neutral-900 dark:text-white">
                        {concept.glossaryHints[activeUrduIdx].urduMeaning}
                      </div>
                      <p className="mt-1 text-xs text-neutral-600 dark:text-neutral-300">
                        {concept.glossaryHints[activeUrduIdx].simpleHint}
                      </p>
                    </div>
                  )}
                </div>
              )}

              {concept.videoLinks.length > 0 && (
                <div className="space-y-2 border-t border-neutral-200 pt-4 dark:border-neutral-800">
                  <div className="text-sm font-semibold text-neutral-900 dark:text-neutral-100">
                    Curated Video Explanations (Requires Internet)
                  </div>
                  <div className="divide-y divide-neutral-200 dark:divide-neutral-800">
                    {concept.videoLinks.map((v, idx) => (
                      <div
                        key={idx}
                        className="flex flex-wrap items-center justify-between gap-3 py-3 first:pt-1 last:pb-1"
                      >
                        <div className="flex items-start gap-3">
                          <PlayCircle className="mt-0.5 h-5 w-5 shrink-0 text-[#1B6B46] dark:text-[#6CD19B]" />
                          <div>
                            <div className="text-sm font-medium text-neutral-900 dark:text-neutral-100">
                              {v.title}
                            </div>
                            <div className="text-xs text-neutral-500 dark:text-neutral-400">
                              {v.channelName} · {v.durationLabel} · {v.language.toUpperCase()}
                            </div>
                          </div>
                        </div>
                        <a
                          href={v.youtubeUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex min-h-9 shrink-0 items-center gap-1.5 whitespace-nowrap rounded-lg border border-neutral-200 px-3 py-1.5 text-xs font-semibold text-[#1B6B46] hover:bg-neutral-50 dark:border-neutral-700 dark:text-[#6CD19B] dark:hover:bg-neutral-800"
                        >
                          Watch on YouTube
                          <ExternalLink className="h-3.5 w-3.5" />
                        </a>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <p className="border-t border-neutral-200 pt-3 text-xs text-neutral-500 dark:border-neutral-800 dark:text-neutral-400">
                Source: {concept.sourceBook} · {concept.sourcePage}
              </p>
            </div>
          )}

          {/* PRACTICE ENGINE */}
          {mode === 'practice' && (
            <div className="space-y-5">
              {showPostSessionAd ? (
                <div className="space-y-4 py-4">
                  <h3 className="text-lg font-bold text-neutral-900 dark:text-neutral-100">
                    Practice Set Complete
                  </h3>
                  <p className="text-sm text-neutral-600 dark:text-neutral-300">
                    All attempts were logged to Analytics & Spaced Revision (1d → 3d → 7d).
                  </p>
                  {showAdPreview && (
                    <div className="rounded-xl border border-dashed border-amber-500/60 bg-amber-50/70 p-4 text-xs dark:bg-amber-950/30">
                      <div className="font-semibold text-amber-800 dark:text-amber-300">
                        Post-Session Interstitial / Rewarded Ad Slot (Respectful Timing)
                      </div>
                      <p className="mt-1 text-neutral-700 dark:text-neutral-300">
                        Only appears after finishing a full set—never mid-question or during reading. Also supports optional Rewarded Video to unlock extra Timed Mock Papers.
                      </p>
                    </div>
                  )}
                  <div className="flex flex-wrap gap-2.5">
                    <button
                      type="button"
                      onClick={() => {
                        setShowPostSessionAd(false);
                        resetPractice(0);
                      }}
                      className="inline-flex items-center gap-1.5 rounded-lg bg-[#1B6B46] px-4 py-2 text-xs font-semibold text-white"
                    >
                      <RotateCcw className="h-3.5 w-3.5" />
                      Practise Again
                    </button>
                    <button
                      type="button"
                      onClick={() =>
                        setShareCard({
                          kicker: `${board} · Grade ${chapter.grade}`,
                          title: `Completed ${chapter.title} Practice`,
                          highlightMetric: `${questions.length} Questions Practised`,
                          lines: [
                            `Subject: ${chapter.subjectName}`,
                            `Daily Streak: ${dailyGoal.currentStreakDays} day(s)`,
                            `Today's Progress: ${dailyGoal.todayQuestionsCompleted}/${dailyGoal.dailyQuestionTarget} Qs`,
                          ],
                        })
                      }
                      className="inline-flex items-center gap-1.5 rounded-lg border border-neutral-200 px-4 py-2 text-xs font-semibold text-[#1B6B46] dark:border-neutral-700 dark:text-[#6CD19B]"
                    >
                      <MessageCircle className="h-3.5 w-3.5" />
                      Share Progress on WhatsApp
                    </button>
                  </div>
                </div>
              ) : currentQ ? (
                <>
                  <div className="flex flex-wrap items-center justify-between gap-2 border-b border-neutral-200 pb-3 dark:border-neutral-800">
                    <span className="text-xs text-neutral-500 dark:text-neutral-400">
                      Question {qIndex + 1} of {questions.length} · Level {currentQ.difficulty} ·{' '}
                      {currentQ.questionType.replace('_', ' ')} ·{' '}
                      {currentQ.sourceType.replaceAll('_', ' ')}
                    </span>
                    <span className="font-mono-tabular text-xs font-semibold text-[#1B6B46] dark:text-[#6CD19B]">
                      {currentQ.marks} {currentQ.marks === 1 ? 'mark' : 'marks'}
                    </span>
                  </div>

                  <h3 className="text-base font-semibold text-neutral-900 dark:text-neutral-100">
                    {currentQ.statement}
                  </h3>

                  {!submitted && currentQ.hints.length > 0 && (
                    <div className="space-y-2">
                      {hintsShown > 0 && (
                        <div className="space-y-1 rounded-lg bg-neutral-50 p-3 text-xs text-neutral-700 dark:bg-neutral-800 dark:text-neutral-200">
                          {currentQ.hints.slice(0, hintsShown).map((h, i) => (
                            <p key={i}>
                              Hint {i + 1}: {h}
                            </p>
                          ))}
                        </div>
                      )}
                      {hintsShown < currentQ.hints.length && (
                        <button
                          type="button"
                          onClick={() => setHintsShown((h) => h + 1)}
                          className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#1B6B46] dark:text-[#6CD19B]"
                        >
                          <Lightbulb className="h-3.5 w-3.5" />
                          Show Progressive Hint ({hintsShown + 1}/{currentQ.hints.length})
                        </button>
                      )}
                    </div>
                  )}

                  {currentQ.options.length > 0 ? (
                    <div className="space-y-2">
                      {currentQ.options.map((opt) => (
                        <label
                          key={opt}
                          className={`flex cursor-pointer items-center gap-3 rounded-lg border px-4 py-3 text-sm ${
                            selectedOption === opt
                              ? 'border-[#1B6B46] bg-[#D6F0E1]/35 dark:border-[#6CD19B] dark:bg-[#174F33]/40'
                              : 'border-neutral-200 dark:border-neutral-700'
                          }`}
                        >
                          <input
                            type="radio"
                            name="sandbox_opt"
                            disabled={submitted}
                            checked={selectedOption === opt}
                            onChange={() => setSelectedOption(opt)}
                            className="accent-[#1B6B46]"
                          />
                          <span>{opt}</span>
                        </label>
                      ))}
                    </div>
                  ) : currentQ.questionType === 'short_answer' ||
                    currentQ.questionType === 'long_answer' ? (
                    <div className="space-y-3 rounded-lg border border-neutral-200 p-4 text-sm dark:border-neutral-800">
                      <p className="text-xs text-neutral-500 dark:text-neutral-400">
                        Write on paper first, then tick the marking points you included honestly:
                      </p>
                      <p className="font-medium text-neutral-900 dark:text-neutral-100">
                        Model Answer: {currentQ.correctAnswer}
                      </p>
                      <div className="space-y-1.5">
                        {(currentQ.markingPoints.length > 0
                          ? currentQ.markingPoints
                          : ['My written answer matches the key points in the model answer above.']
                        ).map((pt, i) => (
                          <label key={i} className="flex items-start gap-2 text-xs">
                            <input
                              type="checkbox"
                              disabled={submitted}
                              checked={checkedPoints.includes(i)}
                              onChange={(e) =>
                                setCheckedPoints((prev) =>
                                  e.target.checked
                                    ? [...prev, i]
                                    : prev.filter((x) => x !== i),
                                )
                              }
                              className="mt-0.5 accent-[#1B6B46]"
                            />
                            <span>{pt}</span>
                          </label>
                        ))}
                      </div>
                    </div>
                  ) : (
                    <input
                      value={typedAnswer}
                      disabled={submitted}
                      onChange={(e) => setTypedAnswer(e.target.value)}
                      placeholder={
                        currentQ.questionType === 'numerical'
                          ? 'Enter numerical answer with unit (e.g. 54 m)'
                          : 'Enter your answer'
                      }
                      className="w-full rounded-lg border border-neutral-200 bg-white px-3 py-2.5 text-sm dark:border-neutral-700 dark:bg-neutral-800"
                    />
                  )}

                  {practiceError && (
                    <div className="flex items-center gap-2 rounded-lg border border-[#B9382C]/35 bg-[#FCECEA] px-3 py-2 text-xs font-medium text-[#B9382C] dark:bg-[#3A1B18] dark:text-[#F28B82]">
                      <ShieldAlert className="h-4 w-4 shrink-0" />
                      <span>{practiceError}</span>
                    </div>
                  )}

                  {!submitted ? (
                    <button
                      type="button"
                      onClick={handleSubmitQuestion}
                      className="min-h-10 rounded-lg bg-[#1B6B46] px-4 py-2 text-xs font-semibold text-white hover:bg-[#155537]"
                    >
                      Submit Attempt
                    </button>
                  ) : (
                    <div className="space-y-3 border-t border-neutral-200 pt-4 text-sm dark:border-neutral-800">
                      <div
                        className={`flex items-center gap-2 font-semibold ${
                          isCorrect
                            ? 'text-[#1E7E4E] dark:text-[#6CD19B]'
                            : 'text-[#B9382C] dark:text-[#F28B82]'
                        }`}
                      >
                        {isCorrect ? (
                          <CheckCircle2 className="h-4 w-4" />
                        ) : (
                          <ShieldAlert className="h-4 w-4" />
                        )}
                        {isCorrect
                          ? 'Correct — Spaced revision advanced'
                          : 'Incorrect — Scheduled for 1-day revision'}
                      </div>

                      {!isCorrect &&
                        selectedOption &&
                        currentQ.optionMisconceptions?.[selectedOption] && (
                          <p className="text-xs text-[#B9382C] dark:text-[#F28B82]">
                            Why your choice is wrong: {currentQ.optionMisconceptions[selectedOption]}
                          </p>
                        )}

                      <p className="text-xs text-neutral-700 dark:text-neutral-300">
                        <strong>Answer:</strong> {currentQ.correctAnswer} — {currentQ.explanation}
                      </p>

                      {currentQ.numericalSteps && (
                        <div className="space-y-1 rounded-lg bg-neutral-50 p-3 text-xs dark:bg-neutral-800">
                          <div className="font-semibold text-[#1B6B46] dark:text-[#6CD19B]">
                            6-Step Numerical Solution
                          </div>
                          <div>Given: {currentQ.numericalSteps.given.join(', ')}</div>
                          <div>Required: {currentQ.numericalSteps.required}</div>
                          <div>Formula: {currentQ.numericalSteps.formula}</div>
                          <div>Substitution: {currentQ.numericalSteps.substitution}</div>
                          <div>Calculation: {currentQ.numericalSteps.calculation}</div>
                          <div className="font-semibold">
                            Answer: {currentQ.numericalSteps.answerWithUnit}
                          </div>
                        </div>
                      )}

                      <div className="flex flex-wrap items-center gap-2.5">
                        <button
                          type="button"
                          onClick={handleNextQuestion}
                          className="rounded-lg bg-[#1B6B46] px-4 py-2 text-xs font-semibold text-white"
                        >
                          {qIndex + 1 < questions.length ? 'Next Question' : 'Finish Set'}
                        </button>

                        <button
                          type="button"
                          onClick={() =>
                            setShareCard({
                              kicker: `Grade ${chapter.grade} · ${chapter.subjectName}`,
                              title: currentQ.statement,
                              highlightMetric: `Answer: ${currentQ.correctAnswer}`,
                              lines: currentQ.numericalSteps
                                ? [
                                    `Given: ${currentQ.numericalSteps.given.join(', ')}`,
                                    `Formula: ${currentQ.numericalSteps.formula}`,
                                    `Substitution: ${currentQ.numericalSteps.substitution}`,
                                    `Answer: ${currentQ.numericalSteps.answerWithUnit}`,
                                  ]
                                : [currentQ.explanation],
                            })
                          }
                          className="inline-flex items-center gap-1.5 rounded-lg border border-neutral-200 px-3 py-2 text-xs font-semibold text-[#1B6B46] dark:border-neutral-700 dark:text-[#6CD19B]"
                        >
                          <MessageCircle className="h-3.5 w-3.5" />
                          Share Solution Card
                        </button>
                      </div>
                    </div>
                  )}
                </>
              ) : (
                <p className="text-sm text-neutral-500">No questions in this chapter yet.</p>
              )}
            </div>
          )}

          {/* DAILY 10-MCQ BOARD & MDCAT CHALLENGE */}
          {mode === 'daily10' && (
            <div className="space-y-5">
              <div className="flex flex-wrap items-start justify-between gap-4 border-b border-neutral-200 pb-4 dark:border-neutral-800">
                <div>
                  <p className="text-xs text-neutral-500 dark:text-neutral-400">
                    {challengeTrack === 'mdcat'
                      ? 'Isolated Entrance Prep · Never mixed into SSC/HSSC board scores'
                      : `${board} · Grades 9–12 SSC/HSSC SLO Pattern`}
                  </p>
                  <h2 className="mt-0.5 text-lg font-bold text-neutral-900 dark:text-neutral-100">
                    Daily 10-MCQ Challenge ({dailyGoal.todayDateIso})
                  </h2>
                </div>

                <div className="flex items-center gap-1 rounded-lg bg-neutral-100 p-1 dark:bg-neutral-800">
                  <button
                    type="button"
                    onClick={() => resetDailyChallenge('board')}
                    className={`shrink-0 whitespace-nowrap rounded-md px-3 py-1.5 text-xs font-semibold ${
                      challengeTrack === 'board'
                        ? 'bg-white text-[#1B6B46] shadow-sm dark:bg-neutral-900 dark:text-[#6CD19B]'
                        : 'text-neutral-600 dark:text-neutral-300'
                    }`}
                  >
                    KPK Board (SSC/HSSC)
                  </button>
                  <button
                    type="button"
                    onClick={() => resetDailyChallenge('mdcat')}
                    className={`shrink-0 whitespace-nowrap rounded-md px-3 py-1.5 text-xs font-semibold ${
                      challengeTrack === 'mdcat'
                        ? 'bg-white text-[#1B6B46] shadow-sm dark:bg-neutral-900 dark:text-[#6CD19B]'
                        : 'text-neutral-600 dark:text-neutral-300'
                    }`}
                  >
                    MDCAT (Isolated)
                  </button>
                </div>
              </div>

              {challengeFinished ? (
                <div className="space-y-4 py-3">
                  <div className="flex items-center gap-2 text-base font-bold text-[#1B6B46] dark:text-[#6CD19B]">
                    <ShieldCheck className="h-5 w-5" />
                    Daily 10-MCQ Complete
                  </div>
                  <div className="font-mono-tabular text-3xl font-bold text-neutral-900 dark:text-white">
                    {challengeScore} / {challengeQuestions.length} Correct (
                    {Math.round((challengeScore / Math.max(1, challengeQuestions.length)) * 100)}%)
                  </div>
                  <p className="text-xs text-neutral-600 dark:text-neutral-300">
                    Your 5-minute daily goal and streak are updated locally. Track:{' '}
                    {challengeTrack === 'mdcat'
                      ? 'MDCAT Admission Prep (Isolated)'
                      : 'KPK Board SSC/HSSC'}
                    .
                  </p>
                  <div className="flex flex-wrap gap-2.5">
                    <button
                      type="button"
                      onClick={() =>
                        setShareCard({
                          kicker:
                            challengeTrack === 'mdcat'
                              ? 'Daily 10-MCQ MDCAT Challenge'
                              : `Daily 10-MCQ Board Challenge (${board})`,
                          title: `Today's Score (${dailyGoal.todayDateIso})`,
                          highlightMetric: `${challengeScore} / ${challengeQuestions.length} (${Math.round(
                            (challengeScore / Math.max(1, challengeQuestions.length)) * 100,
                          )}%)`,
                          lines: [
                            `Current Study Streak: ${dailyGoal.currentStreakDays} day(s)`,
                            `Track: ${
                              challengeTrack === 'mdcat'
                                ? 'MDCAT Entrance Prep'
                                : 'KPK BISE SSC/HSSC'
                            }`,
                          ],
                        })
                      }
                      className="inline-flex items-center gap-1.5 rounded-lg bg-[#1B6B46] px-4 py-2 text-xs font-semibold text-white"
                    >
                      <MessageCircle className="h-3.5 w-3.5" />
                      Share Score on WhatsApp
                    </button>
                    <button
                      type="button"
                      onClick={() => resetDailyChallenge(challengeTrack)}
                      className="inline-flex items-center gap-1.5 rounded-lg border border-neutral-200 px-4 py-2 text-xs font-semibold text-neutral-800 dark:border-neutral-700 dark:text-neutral-100"
                    >
                      <RotateCcw className="h-3.5 w-3.5" />
                      Retake Challenge
                    </button>
                  </div>
                </div>
              ) : activeChallengeQ ? (
                <div className="space-y-4">
                  <div className="flex items-center justify-between text-xs text-neutral-500 dark:text-neutral-400">
                    <span>
                      Question {challengeIdx + 1} of {challengeQuestions.length} · Grade{' '}
                      {activeChallengeQ.grade} · Level {activeChallengeQ.difficulty}
                    </span>
                    <span className="font-mono-tabular font-semibold text-[#1B6B46] dark:text-[#6CD19B]">
                      Score: {challengeScore}
                    </span>
                  </div>

                  <div className="h-1.5 w-full overflow-hidden rounded-full bg-neutral-100 dark:bg-neutral-800">
                    <div
                      className="h-full bg-[#1B6B46] transition-all duration-200 dark:bg-[#6CD19B]"
                      style={{
                        width: `${((challengeIdx + 1) / challengeQuestions.length) * 100}%`,
                      }}
                    />
                  </div>

                  <h3 className="text-base font-semibold text-neutral-900 dark:text-neutral-100">
                    {activeChallengeQ.statement}
                  </h3>

                  <div className="space-y-2">
                    {activeChallengeQ.options.map((opt) => (
                      <label
                        key={opt}
                        className={`flex cursor-pointer items-center gap-3 rounded-lg border px-4 py-3 text-sm ${
                          challengeSelected === opt
                            ? 'border-[#1B6B46] bg-[#D6F0E1]/35 dark:border-[#6CD19B] dark:bg-[#174F33]/40'
                            : 'border-neutral-200 dark:border-neutral-700'
                        }`}
                      >
                        <input
                          type="radio"
                          name="daily10_opt"
                          disabled={challengeSubmitted}
                          checked={challengeSelected === opt}
                          onChange={() => setChallengeSelected(opt)}
                          className="accent-[#1B6B46]"
                        />
                        <span>{opt}</span>
                      </label>
                    ))}
                  </div>

                  {!challengeSubmitted ? (
                    <button
                      type="button"
                      disabled={!challengeSelected}
                      onClick={handleSubmitChallengeQuestion}
                      className="rounded-lg bg-[#1B6B46] px-4 py-2 text-xs font-semibold text-white disabled:opacity-50"
                    >
                      Check Answer
                    </button>
                  ) : (
                    <div className="space-y-2.5 border-t border-neutral-200 pt-3 text-xs dark:border-neutral-800">
                      <div
                        className={`flex items-center gap-1.5 font-semibold ${
                          challengeSelected === activeChallengeQ.correctAnswer
                            ? 'text-[#1E7E4E] dark:text-[#6CD19B]'
                            : 'text-[#B9382C] dark:text-[#F28B82]'
                        }`}
                      >
                        {challengeSelected === activeChallengeQ.correctAnswer ? (
                          <>
                            <CheckCircle2 className="h-4 w-4" />
                            Correct
                          </>
                        ) : (
                          <>
                            <XCircle className="h-4 w-4" />
                            Incorrect — Correct answer: {activeChallengeQ.correctAnswer}
                          </>
                        )}
                      </div>
                      {challengeSelected !== activeChallengeQ.correctAnswer &&
                        activeChallengeQ.optionMisconceptions?.[challengeSelected] && (
                          <p className="text-[#B9382C] dark:text-[#F28B82]">
                            Misconception: {activeChallengeQ.optionMisconceptions[challengeSelected]}
                          </p>
                        )}
                      <p className="text-neutral-600 dark:text-neutral-300">
                        {activeChallengeQ.explanation}
                      </p>
                      <button
                        type="button"
                        onClick={handleNextChallengeQuestion}
                        className="rounded-lg bg-[#1B6B46] px-4 py-2 text-xs font-semibold text-white"
                      >
                        {challengeIdx + 1 < challengeQuestions.length
                          ? 'Next MCQ'
                          : 'View Final Score'}
                      </button>
                    </div>
                  )}
                </div>
              ) : null}
            </div>
          )}

          {/* CHAPTER-WISE SOLVED PAST PAPER BROWSER */}
          {mode === 'pastpapers' && (
            <div className="space-y-5">
              <div className="border-b border-neutral-200 pb-4 dark:border-neutral-800">
                <h2 className="text-lg font-bold text-neutral-900 dark:text-neutral-100">
                  Chapter-Wise Solved Past Paper Browser
                </h2>
                <p className="mt-1 text-xs text-neutral-500 dark:text-neutral-400">
                  Filter solved KPK BISE model & practice questions by board, grade, subject, and type. Verified source labels appear only when supplied; no question is guaranteed on future papers.
                </p>

                <div className="mt-4 grid gap-2.5 sm:grid-cols-2 lg:grid-cols-4">
                  <select
                    aria-label="Filter by BISE Board"
                    value={ppBoardFilter}
                    onChange={(e) => setPpBoardFilter(e.target.value)}
                    className="rounded-lg border border-neutral-200 bg-neutral-50 px-2.5 py-2 text-xs dark:border-neutral-700 dark:bg-neutral-800"
                  >
                    <option value="ALL">All 8 KPK BISE Boards</option>
                    {KPK_BOARDS.map((b) => (
                      <option key={b} value={b}>
                        {b}
                      </option>
                    ))}
                  </select>

                  <select
                    aria-label="Filter by Grade"
                    value={ppGradeFilter}
                    onChange={(e) => setPpGradeFilter(e.target.value)}
                    className="rounded-lg border border-neutral-200 bg-neutral-50 px-2.5 py-2 text-xs dark:border-neutral-700 dark:bg-neutral-800"
                  >
                    <option value="ALL">All Grades (9–12)</option>
                    <option value="9">Grade 9 (SSC I)</option>
                    <option value="10">Grade 10 (SSC II)</option>
                    <option value="11">Grade 11 (HSSC I)</option>
                    <option value="12">Grade 12 (HSSC II)</option>
                  </select>

                  <select
                    aria-label="Filter by Subject"
                    value={ppSubjectFilter}
                    onChange={(e) => setPpSubjectFilter(e.target.value)}
                    className="rounded-lg border border-neutral-200 bg-neutral-50 px-2.5 py-2 text-xs dark:border-neutral-700 dark:bg-neutral-800"
                  >
                    <option value="ALL">All Subjects</option>
                    {availableSubjects.map((s) => (
                      <option key={s} value={s}>
                        {s}
                      </option>
                    ))}
                  </select>

                  <select
                    aria-label="Filter by Question Type"
                    value={ppTypeFilter}
                    onChange={(e) => setPpTypeFilter(e.target.value)}
                    className="rounded-lg border border-neutral-200 bg-neutral-50 px-2.5 py-2 text-xs dark:border-neutral-700 dark:bg-neutral-800"
                  >
                    <option value="ALL">All Question Types</option>
                    <option value="mcq">MCQs</option>
                    <option value="numerical">6-Step Numericals</option>
                    <option value="short_answer">Short Answers</option>
                    <option value="long_answer">Long Answers</option>
                  </select>
                </div>
              </div>

              {filteredPastPapers.length === 0 ? (
                <div className="space-y-3 py-6 text-center text-xs text-neutral-500 dark:text-neutral-400">
                  <p>
                    No solved questions match those exact filters. Try selecting "All 8 KPK BISE Boards" or resetting filters.
                  </p>
                  <button
                    type="button"
                    onClick={() => {
                      setPpBoardFilter('ALL');
                      setPpGradeFilter('ALL');
                      setPpSubjectFilter('ALL');
                      setPpTypeFilter('ALL');
                    }}
                    className="inline-flex items-center gap-1.5 rounded-lg border border-neutral-200 px-3 py-1.5 text-xs font-semibold text-[#1B6B46] hover:bg-neutral-50 dark:border-neutral-700 dark:text-[#6CD19B] dark:hover:bg-neutral-800"
                  >
                    <RotateCcw className="h-3.5 w-3.5" />
                    Reset Filters
                  </button>
                </div>
              ) : (
                <div className="divide-y divide-neutral-200 dark:divide-neutral-800">
                  {filteredPastPapers.map(({ question, subjectName, chapterNumber, chapterTitle }) => {
                    const isOpen = expandedPaperId === question.id;
                    return (
                      <div key={question.id} className="py-4 first:pt-1 last:pb-1">
                        <div className="flex flex-wrap items-start justify-between gap-3">
                          <div className="space-y-1">
                            <p className="text-xs text-neutral-500 dark:text-neutral-400">
                              Grade {question.grade} · {subjectName} · Ch {chapterNumber}: {chapterTitle} ·{' '}
                              {question.sourceBoardId ?? 'KPK Practice Standard'}
                              {question.sourceYear ? ` (${question.sourceYear})` : ''} ·{' '}
                              <span className="font-mono-tabular font-semibold">
                                {question.marks} {question.marks === 1 ? 'mark' : 'marks'}
                              </span>
                            </p>
                            <h3 className="text-sm font-semibold text-neutral-900 dark:text-neutral-100">
                              {question.statement}
                            </h3>
                          </div>

                          <div className="flex items-center gap-2">
                            <button
                              type="button"
                              onClick={() =>
                                setExpandedPaperId(isOpen ? null : question.id)
                              }
                              className="shrink-0 whitespace-nowrap rounded-lg border border-neutral-200 px-3 py-1.5 text-xs font-semibold text-neutral-800 hover:bg-neutral-50 dark:border-neutral-700 dark:text-neutral-100 dark:hover:bg-neutral-800"
                            >
                              {isOpen ? 'Hide Solution' : 'View Solution'}
                            </button>
                            <button
                              type="button"
                              onClick={() =>
                                setShareCard({
                                  kicker: `${question.sourceBoardId ?? 'KPK Board'} · Grade ${question.grade}`,
                                  title: question.statement,
                                  highlightMetric: `Answer: ${question.correctAnswer}`,
                                  lines: question.numericalSteps
                                    ? [
                                        `Given: ${question.numericalSteps.given.join(', ')}`,
                                        `Formula: ${question.numericalSteps.formula}`,
                                        `Substitution: ${question.numericalSteps.substitution}`,
                                        `Answer: ${question.numericalSteps.answerWithUnit}`,
                                      ]
                                    : question.markingPoints.length > 0
                                      ? question.markingPoints
                                      : [question.explanation],
                                })
                              }
                              aria-label="Share solved question on WhatsApp"
                              className="shrink-0 rounded-lg border border-neutral-200 p-1.5 text-[#1B6B46] hover:bg-neutral-50 dark:border-neutral-700 dark:text-[#6CD19B] dark:hover:bg-neutral-800"
                            >
                              <MessageCircle className="h-3.5 w-3.5" />
                            </button>
                          </div>
                        </div>

                        {isOpen && (
                          <div className="mt-3 space-y-2 rounded-lg bg-neutral-50 p-3.5 text-xs text-neutral-700 dark:bg-neutral-800 dark:text-neutral-200">
                            <p>
                              <strong>Model Answer:</strong> {question.correctAnswer}
                            </p>
                            <p>{question.explanation}</p>
                            {question.numericalSteps && (
                              <div className="space-y-1 border-t border-neutral-200 pt-2 dark:border-neutral-700">
                                <div className="font-semibold text-[#1B6B46] dark:text-[#6CD19B]">
                                  6-Step Numerical Solution
                                </div>
                                <div>Given: {question.numericalSteps.given.join(', ')}</div>
                                <div>Required: {question.numericalSteps.required}</div>
                                <div>Formula: {question.numericalSteps.formula}</div>
                                <div>Substitution: {question.numericalSteps.substitution}</div>
                                <div>Calculation: {question.numericalSteps.calculation}</div>
                                <div className="font-semibold">
                                  Answer: {question.numericalSteps.answerWithUnit}
                                </div>
                              </div>
                            )}
                            {question.markingPoints.length > 0 && (
                              <div className="border-t border-neutral-200 pt-2 dark:border-neutral-700">
                                <div className="font-semibold text-[#1B6B46] dark:text-[#6CD19B]">
                                  Board Marking Scheme
                                </div>
                                <ul className="mt-1 list-disc space-y-0.5 pl-4">
                                  {question.markingPoints.map((pt, i) => (
                                    <li key={i}>{pt}</li>
                                  ))}
                                </ul>
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* FORMULA MATCH GAME */}
          {mode === 'match' && (
            <div className="space-y-4">
              <div>
                <h3 className="text-base font-bold text-neutral-900 dark:text-neutral-100">
                  2-Minute Formula & Unit Match
                </h3>
                <p className="text-xs text-neutral-500 dark:text-neutral-400">
                  Tap a quantity on the left, then tap its matching formula or SI unit on the right.
                </p>
              </div>
              {matchFeedback && (
                <p className="text-xs font-semibold text-[#1B6B46] dark:text-[#6CD19B]">
                  {matchFeedback}
                </p>
              )}
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  {MATCH_PAIRS.map((p) => (
                    <button
                      key={p.id}
                      type="button"
                      disabled={matchedIds.includes(p.id)}
                      onClick={() => setMatchLeft(p.id)}
                      className={`w-full rounded-lg border px-3 py-3 text-left text-xs font-semibold disabled:opacity-40 ${
                        matchLeft === p.id
                          ? 'border-[#1B6B46] bg-[#D6F0E1]/40 dark:border-[#6CD19B] dark:bg-[#174F33]/50'
                          : 'border-neutral-200 dark:border-neutral-700'
                      }`}
                    >
                      {p.left}
                    </button>
                  ))}
                </div>
                <div className="space-y-2">
                  {[MATCH_PAIRS[2], MATCH_PAIRS[0], MATCH_PAIRS[3], MATCH_PAIRS[1]].map((p) => (
                    <button
                      key={p.id}
                      type="button"
                      disabled={matchedIds.includes(p.id)}
                      onClick={() => handleTapMatchRight(p.id, p.left)}
                      className="w-full rounded-lg border border-neutral-200 bg-neutral-50 px-3 py-3 text-left text-xs font-medium hover:bg-neutral-100 disabled:opacity-40 dark:border-neutral-700 dark:bg-neutral-800"
                    >
                      {p.right}
                    </button>
                  ))}
                </div>
              </div>
              {matchedIds.length === MATCH_PAIRS.length && (
                <button
                  type="button"
                  onClick={() => {
                    setMatchedIds([]);
                    setMatchLeft(null);
                    setMatchFeedback('');
                  }}
                  className="inline-flex items-center gap-1.5 rounded-lg bg-[#1B6B46] px-4 py-2 text-xs font-semibold text-white"
                >
                  <Sparkles className="h-3.5 w-3.5" />
                  All Matched — Play Again
                </button>
              )}
            </div>
          )}
        </div>

        {/* Right Companion */}
        <aside className="space-y-4">
          <div className="rounded-xl border border-neutral-200 bg-white p-5 dark:border-neutral-800 dark:bg-neutral-900">
            <div className="flex items-center gap-2 text-sm font-bold text-neutral-900 dark:text-neutral-100">
              <BookOpen className="h-4 w-4 text-[#1B6B46] dark:text-[#6CD19B]" />
              Daily Retention Loop
            </div>
            <ul className="mt-3 space-y-2 text-xs leading-relaxed text-neutral-600 dark:text-neutral-300">
              <li>1. 5-minute streak & forgiving load-shedding grace freezes keep habits intact.</li>
              <li>2. Daily 10-MCQ separates KPK Board prep from MDCAT entrance accuracy.</li>
              <li>3. Solved Past Papers across all 8 BISE boards with 6-step numericals.</li>
              <li>4. 1-tap WhatsApp Study Cards drive organic peer downloads across KPK.</li>
            </ul>
          </div>

          {showAdPreview && (
            <div className="rounded-xl border border-dashed border-neutral-300 bg-neutral-50 p-4 text-xs dark:border-neutral-700 dark:bg-neutral-900">
              <div className="font-semibold text-neutral-800 dark:text-neutral-200">
                Home / Browser AdMob Banner Slot
              </div>
              <p className="mt-1 text-neutral-500 dark:text-neutral-400">
                320×50 adaptive banner placed quietly below the fold on Home & Chapter Lists—never inside active reading or timed mocks. Collapses automatically offline.
              </p>
            </div>
          )}
        </aside>
      </div>

      <WhatsAppShareModal card={shareCard} onClose={() => setShareCard(null)} />
    </div>
  );
}
