import { useEffect, useMemo, useState } from 'react';
import {
  Award,
  Bookmark,
  BookOpen,
  CheckCircle2,
  Clock,
  Compass,
  ExternalLink,
  Flame,
  GraduationCap,
  Layers,
  MessageCircle,
  PlayCircle,
  RotateCcw,
  Search,
  ShieldCheck,
  Target,
  User,
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
  ExamBlueprint,
  ExamScoreResponse,
  ProgrammeId,
  SandboxAttemptRecord,
} from '../types/cms';
import { isAnswerMatch } from '../utils/answerMatch';
import { MathGraphView } from './MathGraphView';
import { MathText } from './MathText';
import { MotionGraphicPlayer } from './MotionGraphicPlayer';
import {
  MotionProgressTrack,
  MotionReveal,
  MotionScreenSwap,
} from './MotionSystem';
import { PdfBookLibrary } from './PdfBookLibrary';
import { StudentPracticeRunner } from './StudentPracticeRunner';
import {
  WhatsAppShareModal,
  type ShareCardPayload,
} from './WhatsAppShareModal';

interface StudentPreviewProps {
  chapters: CmsChapter[];
  attempts?: SandboxAttemptRecord[];
  onRecordAttempt: (attempt: SandboxAttemptRecord) => void;
  onClearAttempts?: () => void;
}

type StudentSection =
  | 'home'
  | 'learn'
  | 'practice'
  | 'preparation'
  | 'exams'
  | 'books'
  | 'profile';

interface LocalStudentPrefs {
  board: string;
  targetGrade: 9 | 10 | 11 | 12;
  programmeTrack: ProgrammeId;
  lastChapterId: string;
  completedConceptIds: string[];
  bookmarkedChapterIds: string[];
  prepChecklist: Record<string, boolean>;
  onboardingCompleted?: boolean;
  selectedSubjects?: string[];
}

interface PersistedExamState {
  examId: string;
  submissionUuid?: string;
  started: boolean;
  finished: boolean;
  timed: boolean;
  secondsLeft: number;
  answers: Record<string, string>;
  subjectiveChecked: Record<string, boolean>;
  scoreResult?: ExamScoreResponse | null;
}

const STORAGE_DAILY_GOAL_KEY = 'roshan_study_daily_goal_v1';
const STORAGE_PREFS_KEY = 'roshan_study_student_prefs_v1';
const STORAGE_ACTIVE_EXAM_KEY = 'roshan_study_active_exam_v1';

const BOARD_PREP_CHECKLIST = [
  'Read chapter Learning Objectives & Textbook Concept Notes',
  'Study Motion Graphics & Graphs to visualize key laws',
  'Practise all MCQs and review misconception explanations',
  'Solve numericals using all 6 KPK Board steps with SI units',
  'Attempt at least 1 timed Section A/B/C Exam Paper',
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

function loadInitialPrefs(defaultChapterId: string): LocalStudentPrefs {
  const fallback: LocalStudentPrefs = {
    board: KPK_BOARDS[0],
    targetGrade: 9,
    programmeTrack: 'ssc_hssc',
    lastChapterId: defaultChapterId,
    completedConceptIds: [],
    bookmarkedChapterIds: [],
    prepChecklist: {},
  };
  try {
    const raw = localStorage.getItem(STORAGE_PREFS_KEY);
    if (!raw) return fallback;
    const parsed = JSON.parse(raw) as Partial<LocalStudentPrefs>;
    return {
      ...fallback,
      ...parsed,
      completedConceptIds: Array.isArray(parsed.completedConceptIds)
        ? parsed.completedConceptIds
        : [],
      bookmarkedChapterIds: Array.isArray(parsed.bookmarkedChapterIds)
        ? parsed.bookmarkedChapterIds
        : [],
      prepChecklist: parsed.prepChecklist ?? {},
    };
  } catch {
    return fallback;
  }
}

function loadPersistedExam(): PersistedExamState | null {
  try {
    const raw = localStorage.getItem(STORAGE_ACTIVE_EXAM_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as PersistedExamState;
  } catch {
    return null;
  }
}

export function StudentPreview({
  chapters,
  attempts = [],
  onRecordAttempt,
  onClearAttempts,
}: StudentPreviewProps) {
  const [section, setSection] = useState<StudentSection>('home');
  const [prefs, setPrefs] = useState<LocalStudentPrefs>(() =>
    loadInitialPrefs(chapters[0]?.chapterId ?? ''),
  );
  const [dailyGoal, setDailyGoal] = useState<DailyGoalState>(loadInitialDailyGoal);
  const [shareCard, setShareCard] = useState<ShareCardPayload | null>(null);

  // Learn / Hierarchy explorer state
  const [catalogSearch, setCatalogSearch] = useState('');
  const [catalogGrade, setCatalogGrade] = useState<string>('ALL');
  const [catalogGroup, setCatalogGroup] = useState<string>('ALL');
  const [catalogSubject, setCatalogSubject] = useState<string>('ALL');
  const [catalogPage, setCatalogPage] = useState(1);
  const [selectedChapterId, setSelectedChapterId] = useState<string>(
    prefs.lastChapterId || chapters[0]?.chapterId || '',
  );
  const [selectedConceptIdx, setSelectedConceptIdx] = useState(0);
  const [guidedMode, setGuidedMode] = useState(true);
  const [microStep, setMicroStep] = useState(0);
  const [microChoice, setMicroChoice] = useState<string | null>(null);
  const [activeUrduIdx, setActiveUrduIdx] = useState<number | null>(null);
  const [flashcardIdx, setFlashcardIdx] = useState(0);
  const [flashcardFlipped, setFlashcardFlipped] = useState(false);

  // Practice filter state
  const [practiceTypeFilter, setPracticeTypeFilter] = useState<string>('ALL');
  const [practiceSessionDone, setPracticeSessionDone] = useState(false);

  // Preparation: Daily 10-MCQ & Past Papers
  const [prepSubTab, setPrepSubTab] = useState<'overview' | 'daily10' | 'pastpapers'>(
    'overview',
  );
  const [challengeIdx, setChallengeIdx] = useState(0);
  const [challengeSelected, setChallengeSelected] = useState('');
  const [challengeSubmitted, setChallengeSubmitted] = useState(false);
  const [challengeScore, setChallengeScore] = useState(0);
  const [challengeFinished, setChallengeFinished] = useState(false);

  const [ppBoardFilter, setPpBoardFilter] = useState<string>('ALL');
  const [ppGradeFilter, setPpGradeFilter] = useState<string>('ALL');
  const [ppSubjectFilter, setPpSubjectFilter] = useState<string>('ALL');
  const [ppTypeFilter, setPpTypeFilter] = useState<string>('ALL');
  const [ppVerifiedOnly, setPpVerifiedOnly] = useState<boolean>(false);
  const [expandedPaperId, setExpandedPaperId] = useState<string | null>(null);

  // Exams engine state (persisted in localStorage)
  const initialSavedExam = useMemo(loadPersistedExam, []);
  const [publishedExams, setPublishedExams] = useState<ExamBlueprint[]>([]);
  const [selectedExamId, setSelectedExamId] = useState<string>(
    initialSavedExam?.examId ?? '',
  );
  const [examStarted, setExamStarted] = useState<boolean>(
    initialSavedExam?.started ?? false,
  );
  const [examFinished, setExamFinished] = useState<boolean>(
    initialSavedExam?.finished ?? false,
  );
  const [examTimed, setExamTimed] = useState<boolean>(
    initialSavedExam?.timed ?? true,
  );
  const [examSecondsLeft, setExamSecondsLeft] = useState<number>(
    initialSavedExam?.secondsLeft ?? 1500,
  );
  const [examAnswers, setExamAnswers] = useState<Record<string, string>>(
    initialSavedExam?.answers ?? {},
  );
  const [examSubjectiveChecked, setExamSubjectiveChecked] = useState<
    Record<string, boolean>
  >(initialSavedExam?.subjectiveChecked ?? {});
  const [examSubmissionUuid, setExamSubmissionUuid] = useState<string>(
    initialSavedExam?.submissionUuid || `sub_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
  );
  const [examScoreResult, setExamScoreResult] = useState<ExamScoreResponse | null>(
    initialSavedExam?.scoreResult ?? null,
  );
  const [examScoringLoading, setExamScoringLoading] = useState(false);
  const [examScoringError, setExamScoringError] = useState('');
  const [completedExamsCount, setCompletedExamsCount] = useState(0);
  const [onboardingStep, setOnboardingStep] = useState<number>(0);
  const [showOnboardingBanner, setShowOnboardingBanner] = useState<boolean>(
    () => !prefs.onboardingCompleted,
  );

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_DAILY_GOAL_KEY, JSON.stringify(dailyGoal));
    } catch {
      // ignore
    }
  }, [dailyGoal]);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_PREFS_KEY, JSON.stringify(prefs));
    } catch {
      // ignore
    }
  }, [prefs]);

  useEffect(() => {
    try {
      if (!selectedExamId) return;
      const state: PersistedExamState = {
        examId: selectedExamId,
        submissionUuid: examSubmissionUuid,
        started: examStarted,
        finished: examFinished,
        timed: examTimed,
        secondsLeft: examSecondsLeft,
        answers: examAnswers,
        subjectiveChecked: examSubjectiveChecked,
        scoreResult: examScoreResult,
      };
      localStorage.setItem(STORAGE_ACTIVE_EXAM_KEY, JSON.stringify(state));
    } catch {
      // ignore
    }
  }, [
    selectedExamId,
    examSubmissionUuid,
    examStarted,
    examFinished,
    examTimed,
    examSecondsLeft,
    examAnswers,
    examSubjectiveChecked,
    examScoreResult,
  ]);

  useEffect(() => {
    let active = true;
    const loadExams = async () => {
      try {
        const res = await fetch(
          `/api/v1/exams?programme=${encodeURIComponent(prefs.programmeTrack)}`,
        );
        if (!res.ok) return;
        const data = (await res.json()) as { exams?: ExamBlueprint[] };
        if (active && Array.isArray(data.exams)) {
          setPublishedExams(data.exams);
        }
      } catch {
        // Offline / fallback handled below
      }
    };
    void loadExams();
    return () => {
      active = false;
    };
  }, [chapters.length, prefs.programmeTrack]);

  useEffect(() => {
    if (section !== 'exams' || !examStarted || examFinished || !examTimed) return;
    const timer = window.setInterval(() => {
      setExamSecondsLeft((sec) => {
        if (sec <= 1) {
          setExamFinished(true);
          setCompletedExamsCount((c) => c + 1);
          return 0;
        }
        return sec - 1;
      });
    }, 1000);
    return () => window.clearInterval(timer);
  }, [section, examStarted, examFinished, examTimed]);

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

  // Strict Track Isolation: SSC/HSSC chapters vs Admission track chapters
  const trackChapters = useMemo(() => {
    const matching = chapters.filter((c) => c.programmeId === prefs.programmeTrack);
    return matching.length > 0 ? matching : chapters.filter((c) => c.programmeId === 'ssc_hssc');
  }, [chapters, prefs.programmeTrack]);

  const trackAttempts = useMemo(
    () =>
      attempts.filter((a) =>
        prefs.programmeTrack === 'ssc_hssc'
          ? !a.programmeId || a.programmeId === 'ssc_hssc'
          : a.programmeId === prefs.programmeTrack,
      ),
    [attempts, prefs.programmeTrack],
  );

  const dynamicCatalogGroups = useMemo(
    () => Array.from(new Set(trackChapters.map((c) => c.groupId))).sort(),
    [trackChapters],
  );

  const dynamicCatalogSubjects = useMemo(
    () => Array.from(new Set(trackChapters.map((c) => c.subjectName))).sort(),
    [trackChapters],
  );

  const filteredCatalogChapters = useMemo(() => {
    const q = catalogSearch.trim().toLowerCase();
    return trackChapters.filter((ch) => {
      if (catalogGrade !== 'ALL' && ch.grade !== Number(catalogGrade)) return false;
      if (catalogGroup !== 'ALL' && ch.groupId !== catalogGroup) return false;
      if (catalogSubject !== 'ALL' && ch.subjectName !== catalogSubject) return false;
      if (q) {
        const hay = `${ch.title} ${ch.subjectName} ${ch.grade} ${ch.learningOutcomes.join(' ')}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [trackChapters, catalogSearch, catalogGrade, catalogGroup, catalogSubject]);

  const CATALOG_PAGE_SIZE = 12;
  const totalCatalogPages = Math.max(
    1,
    Math.ceil(filteredCatalogChapters.length / CATALOG_PAGE_SIZE),
  );
  const safeCatalogPage = Math.min(catalogPage, totalCatalogPages);
  const pagedCatalogChapters = useMemo(() => {
    const start = (safeCatalogPage - 1) * CATALOG_PAGE_SIZE;
    return filteredCatalogChapters.slice(start, start + CATALOG_PAGE_SIZE);
  }, [filteredCatalogChapters, safeCatalogPage]);

  const chapter = useMemo(
    () =>
      filteredCatalogChapters.find((c) => c.chapterId === selectedChapterId) ??
      trackChapters.find((c) => c.chapterId === selectedChapterId) ??
      filteredCatalogChapters[0] ??
      trackChapters[0],
    [trackChapters, filteredCatalogChapters, selectedChapterId],
  );

  const concepts = chapter?.concepts ?? [];
  const safeConceptIdx =
    concepts.length > 0 ? Math.min(selectedConceptIdx, concepts.length - 1) : 0;
  const concept = concepts[safeConceptIdx];

  const practiceQuestions = useMemo(() => {
    if (!chapter) return [];
    if (practiceTypeFilter === 'ALL') return chapter.questions;
    return chapter.questions.filter((q) => q.questionType === practiceTypeFilter);
  }, [chapter, practiceTypeFilter]);

  const handleSelectChapter = (id: string, targetSection?: StudentSection) => {
    setSelectedChapterId(id);
    setSelectedConceptIdx(0);
    setMicroStep(0);
    setMicroChoice(null);
    setActiveUrduIdx(null);
    setFlashcardIdx(0);
    setFlashcardFlipped(false);
    setPracticeSessionDone(false);
    setPrefs((prev) => ({ ...prev, lastChapterId: id }));
    if (targetSection) setSection(targetSection);
  };

  const toggleChapterBookmark = (chapterId: string) => {
    setPrefs((prev) => {
      const exists = prev.bookmarkedChapterIds.includes(chapterId);
      return {
        ...prev,
        bookmarkedChapterIds: exists
          ? prev.bookmarkedChapterIds.filter((id) => id !== chapterId)
          : [...prev.bookmarkedChapterIds, chapterId],
      };
    });
  };

  const markConceptCompleted = (conceptId: string) => {
    setPrefs((prev) =>
      prev.completedConceptIds.includes(conceptId)
        ? prev
        : { ...prev, completedConceptIds: [...prev.completedConceptIds, conceptId] },
    );
  };

  // Real Weak Areas computed strictly from actual attempt history
  const weakAreas = useMemo(() => {
    const byChapter = new Map<
      string,
      { chapterId: string; subjectName: string; total: number; wrong: number }
    >();
    for (const att of trackAttempts) {
      const cur = byChapter.get(att.chapterId) ?? {
        chapterId: att.chapterId,
        subjectName: att.subjectName,
        total: 0,
        wrong: 0,
      };
      cur.total += 1;
      if (!att.isCorrect) cur.wrong += 1;
      byChapter.set(att.chapterId, cur);
    }
    return Array.from(byChapter.values())
      .filter((entry) => entry.wrong > 0)
      .sort((a, b) => b.wrong / b.total - a.wrong / a.total)
      .slice(0, 4);
  }, [trackAttempts]);

  // Evidence-Based Readiness Metrics (no fake predictions!)
  const readinessMetrics = useMemo(() => {
    const publishedTrackChapters = trackChapters.filter(
      (c) => c.publicationStatus === 'published',
    );
    const totalTrackConcepts = trackChapters.reduce((sum, c) => sum + c.concepts.length, 0);
    const studiedConceptsCount = trackChapters.reduce(
      (sum, c) =>
        sum +
        c.concepts.filter((con) => prefs.completedConceptIds.includes(con.id)).length,
      0,
    );
    const correctAttempts = trackAttempts.filter((a) => a.isCorrect).length;
    const accuracyPct =
      trackAttempts.length > 0
        ? Math.round((correctAttempts / trackAttempts.length) * 100)
        : 0;
    const coveragePct =
      totalTrackConcepts > 0
        ? Math.round((studiedConceptsCount / totalTrackConcepts) * 100)
        : 0;

    return {
      publishedCount: publishedTrackChapters.length,
      totalChapters: trackChapters.length,
      studiedConceptsCount,
      totalTrackConcepts,
      coveragePct,
      attemptsCount: trackAttempts.length,
      accuracyPct,
      completedExamsCount,
    };
  }, [trackChapters, prefs.completedConceptIds, trackAttempts, completedExamsCount]);

  // Exams list: published server blueprints + synthesized chapter tests for SSC/HSSC
  const availableExams = useMemo<ExamBlueprint[]>(() => {
    const localTests: ExamBlueprint[] = trackChapters
      .filter((c) => c.questions.length > 0)
      .slice(0, 8)
      .map((c) => {
        const mcqs = c.questions.filter(
          (q) =>
            q.questionType === 'mcq' ||
            q.questionType === 'true_false' ||
            q.questionType === 'multi_select',
        );
        const shorts = c.questions.filter(
          (q) =>
            q.questionType === 'short_answer' ||
            q.questionType === 'conceptual' ||
            q.questionType === 'fill_in',
        );
        const longs = c.questions.filter(
          (q) => q.questionType === 'long_answer' || q.questionType === 'numerical',
        );
        const sections: ExamBlueprint['sections'] = [];
        if (mcqs.length > 0) {
          sections.push({
            label: 'Section A — Objective MCQs',
            questionType: 'mcq',
            marksEach: 1,
            questionIds: mcqs.map((q) => q.id),
          });
        }
        if (shorts.length > 0) {
          sections.push({
            label: 'Section B — Short Questions',
            questionType: 'short_answer',
            marksEach: 3,
            questionIds: shorts.map((q) => q.id),
          });
        }
        if (longs.length > 0) {
          sections.push({
            label: 'Section C — Long Questions & 6-Step Numericals',
            questionType: longs[0]?.questionType === 'numerical' ? 'numerical' : 'long_answer',
            marksEach: 5,
            questionIds: longs.map((q) => q.id),
          });
        }
        const totalMarks = sections.reduce(
          (acc, s) => acc + s.questionIds.length * s.marksEach,
          0,
        );
        const nowIso = c.updatedAt ?? new Date().toISOString();
        return {
          id: `local_test_${c.chapterId}`,
          programmeId: c.programmeId,
          grade: c.grade,
          groupId: c.groupId,
          subjectId: c.subjectId,
          subjectName: c.subjectName,
          chapterId: c.chapterId,
          examKind: 'chapter_test',
          title: `G${c.grade} Ch ${c.chapterNumber}: ${c.title} — BISE Chapter Paper`,
          durationMinutes: 25,
          totalMarks: Math.max(1, totalMarks),
          sections,
          publicationStatus: c.publicationStatus,
          reviewStage: 'published',
          packVersion: c.packVersion,
          reviewedBy: 'Built-in Practice Engine',
          createdAt: nowIso,
          updatedAt: nowIso,
        };
      });

    const mergedIds = new Set(publishedExams.map((e) => e.id));
    return [...publishedExams, ...localTests.filter((e) => !mergedIds.has(e.id))];
  }, [publishedExams, trackChapters]);

  const activeExam = useMemo(
    () => availableExams.find((e) => e.id === selectedExamId) ?? availableExams[0],
    [availableExams, selectedExamId],
  );

  const examQuestionLookup = useMemo(() => {
    const map = new Map<string, CmsQuestion>();
    for (const c of chapters) {
      for (const q of c.questions) {
        map.set(q.id, q);
      }
    }
    return map;
  }, [chapters]);

  const startExamAttempt = (exam: ExamBlueprint) => {
    setSelectedExamId(exam.id);
    setExamSubmissionUuid(`sub_${exam.id}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`);
    setExamStarted(true);
    setExamFinished(false);
    setExamAnswers({});
    setExamSubjectiveChecked({});
    setExamScoreResult(null);
    setExamScoringError('');
    setExamSecondsLeft(Math.max(60, exam.durationMinutes * 60));
  };

  const computeLocalExamScore = (exam: ExamBlueprint, submissionId: string): ExamScoreResponse => {
    let scoreObtained = 0;
    let totalMarks = 0;
    let gradedCount = 0;
    const sectionBreakdown: ExamScoreResponse['sectionBreakdown'] = [];
    const conceptMiss = new Map<
      string,
      { conceptId: string; conceptTitle: string; missedCount: number; totalCount: number }
    >();
    const items: ExamScoreResponse['items'] = [];

    for (const sec of exam.sections) {
      let secObtained = 0;
      let secPossible = 0;
      for (const qid of sec.questionIds) {
        const q = examQuestionLookup.get(qid);
        if (!q) continue;
        secPossible += sec.marksEach;
        totalMarks += sec.marksEach;
        const rawResp = (examAnswers[qid] ?? '').trim();
        const isObjective =
          q.questionType === 'mcq' ||
          q.questionType === 'true_false' ||
          q.questionType === 'fill_in' ||
          q.questionType === 'numerical';
        const correct = isObjective
          ? Boolean(rawResp) && isAnswerMatch(rawResp, q.correctAnswer, q.questionType)
          : Boolean(examSubjectiveChecked[qid] || rawResp.length >= 12);
        const awarded = correct ? sec.marksEach : 0;
        secObtained += awarded;
        scoreObtained += awarded;
        gradedCount += 1;

        const cKey = q.conceptId || q.topicId || q.chapterId;
        const prev = conceptMiss.get(cKey) ?? {
          conceptId: cKey,
          conceptTitle: chapter?.concepts.find((c) => c.id === q.conceptId)?.title || q.topicId || q.chapterId,
          missedCount: 0,
          totalCount: 0,
        };
        prev.totalCount += 1;
        if (!correct) prev.missedCount += 1;
        conceptMiss.set(cKey, prev);

        items.push({
          questionId: q.id,
          questionType: q.questionType,
          marksPossible: sec.marksEach,
          marksAwarded: awarded,
          isCorrect: correct,
          correctAnswer: q.correctAnswer,
          explanation: q.explanation,
        });
      }
      sectionBreakdown.push({
        label: sec.label,
        obtained: secObtained,
        possible: secPossible,
      });
    }

    const weakTopics = Array.from(conceptMiss.values())
      .filter((entry) => entry.missedCount > 0)
      .map((entry) => ({
        topicId: entry.conceptId,
        conceptId: entry.conceptId,
        conceptTitle: entry.conceptTitle,
        missedCount: entry.missedCount,
        totalCount: entry.totalCount,
        accuracyPercent: Math.round(((entry.totalCount - entry.missedCount) / Math.max(1, entry.totalCount)) * 100),
      }));

    return {
      submissionUuid: submissionId,
      examId: exam.id,
      examTitle: exam.title,
      scoreObtained,
      totalMarks: Math.max(1, totalMarks),
      percentage: Math.round((scoreObtained / Math.max(1, totalMarks)) * 100),
      gradedCount,
      sectionBreakdown,
      weakTopics,
      items,
      scoredAt: new Date().toISOString(),
      idempotentReplay: false,
    };
  };

  const finishExamAttempt = async () => {
    if (!activeExam) return;
    setExamFinished(true);
    setExamScoringLoading(true);
    setExamScoringError('');
    setCompletedExamsCount((c) => c + 1);

    const answerList = activeExam.sections.flatMap((sec) =>
      sec.questionIds.map((qid) => ({
        questionId: qid,
        response: examAnswers[qid] ?? '',
        selfScore: examSubjectiveChecked[qid] ? 1 : undefined,
      })),
    );
    const totalSec = Math.max(60, activeExam.durationMinutes * 60);
    const spentSec = Math.max(1, totalSec - examSecondsLeft);

    try {
      const res = await fetch(`/api/v1/exams/${encodeURIComponent(activeExam.id)}/score`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          submissionUuid: examSubmissionUuid,
          timeSpentSec: spentSec,
          answers: answerList,
        }),
      });
      if (res.ok) {
        const result = (await res.json()) as ExamScoreResponse;
        setExamScoreResult(result);
      } else if (activeExam.id.startsWith('local_test_') || res.status === 404) {
        setExamScoreResult(computeLocalExamScore(activeExam, examSubmissionUuid));
      } else {
        setExamScoringError('Could not retrieve authoritative server score. Retry below.');
        setExamScoreResult(computeLocalExamScore(activeExam, examSubmissionUuid));
      }
    } catch {
      setExamScoringError('Offline mode: calculated local score. Reconnect and Retry to sync.');
      setExamScoreResult(computeLocalExamScore(activeExam, examSubmissionUuid));
    } finally {
      setExamScoringLoading(false);
    }

    let recorded = 0;
    for (const sec of activeExam.sections) {
      for (const qid of sec.questionIds) {
        const q = examQuestionLookup.get(qid);
        if (q && (q.questionType === 'mcq' || q.questionType === 'true_false') && examAnswers[qid]) {
          recorded += 1;
          onRecordAttempt({
            id: `att_exam_${qid}_${Date.now()}_${recorded}`,
            programmeId: q.programmeId,
            questionId: q.id,
            chapterId: q.chapterId,
            subjectName: activeExam.subjectName || activeExam.title,
            conceptTitle: activeExam.examKind.replaceAll('_', ' '),
            isCorrect: isAnswerMatch(examAnswers[qid], q.correctAnswer, q.questionType),
            difficulty: q.difficulty,
            timestamp: new Date().toISOString(),
          });
        }
      }
    }
    if (recorded > 0) bumpDailyGoalProgress(recorded, 0);
  };

  // Daily 10-MCQ strictly respects active track isolation
  const isAdmissionTrack = prefs.programmeTrack !== 'ssc_hssc';
  const challengeQuestions = useMemo(() => {
    if (isAdmissionTrack) {
      return MDCAT_CHALLENGE_BANK.slice(0, 10);
    }
    const chapterMcqs = trackChapters.flatMap((c) =>
      c.questions.filter((q) => q.programmeId === 'ssc_hssc' && q.questionType === 'mcq'),
    );
    const seen = new Set(chapterMcqs.map((q) => q.id));
    const merged = [
      ...chapterMcqs,
      ...BOARD_CHALLENGE_MCQS.filter((q) => !seen.has(q.id)),
    ];
    return merged.slice(0, 10);
  }, [isAdmissionTrack, trackChapters]);

  const activeChallengeQ = challengeQuestions[challengeIdx];

  const resetDailyChallenge = () => {
    setChallengeIdx(0);
    setChallengeSelected('');
    setChallengeSubmitted(false);
    setChallengeScore(0);
    setChallengeFinished(false);
  };

  // Past papers browser index
  const pastPaperEntries = useMemo(() => {
    const fromChapters = trackChapters.flatMap((ch) =>
      ch.questions.map((q) => ({
        question: q,
        subjectName: ch.subjectName,
        chapterNumber: ch.chapterNumber,
        chapterTitle: ch.title,
      })),
    );
    if (isAdmissionTrack) return fromChapters;
    const seen = new Set(fromChapters.map((e) => e.question.id));
    const extra = BOARD_CHALLENGE_MCQS.filter((q) => !seen.has(q.id)).map((q) => ({
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
      chapterTitle: 'KPK Board Core Concepts',
    }));
    return [...fromChapters, ...extra];
  }, [trackChapters, isAdmissionTrack]);

  const availablePpSubjects = useMemo(
    () => Array.from(new Set(pastPaperEntries.map((e) => e.subjectName))),
    [pastPaperEntries],
  );

  const filteredPastPapers = useMemo(() => {
    return pastPaperEntries.filter(({ question, subjectName }) => {
      if (
        ppVerifiedOnly &&
        question.sourceType !== 'official_past_paper' &&
        question.sourceType !== 'official_model_paper'
      ) {
        return false;
      }
      if (ppBoardFilter !== 'ALL' && question.sourceBoardId !== ppBoardFilter) return false;
      if (ppGradeFilter !== 'ALL' && question.grade !== Number(ppGradeFilter)) return false;
      if (ppSubjectFilter !== 'ALL' && subjectName !== ppSubjectFilter) return false;
      if (ppTypeFilter !== 'ALL' && question.questionType !== ppTypeFilter) return false;
      return true;
    });
  }, [
    pastPaperEntries,
    ppVerifiedOnly,
    ppBoardFilter,
    ppGradeFilter,
    ppSubjectFilter,
    ppTypeFilter,
  ]);

  const dailyPct = Math.min(
    100,
    dailyGoal.todayLessonsCompleted >= 1
      ? 100
      : Math.round((dailyGoal.todayQuestionsCompleted / Math.max(1, dailyGoal.dailyQuestionTarget)) * 100),
  );

  const microCards = concept?.microCards ?? [];
  const safeMicroStep =
    microCards.length > 0 ? Math.min(microStep, microCards.length - 1) : 0;
  const activeMicroCard = microCards[safeMicroStep];
  const flashcards = concept?.flashcards ?? [];
  const safeFlashcardIdx =
    flashcards.length > 0 ? Math.min(flashcardIdx, flashcards.length - 1) : 0;
  const activeFlashcard = flashcards[safeFlashcardIdx];

  return (
    <div className="space-y-6">
      {/* Unified Student Navigation & Isolated Programme Track Bar */}
      <div className="space-y-3 rounded-xl border border-neutral-200 bg-white p-4 dark:border-neutral-800 dark:bg-neutral-900">
        <div className="flex flex-wrap items-center justify-between gap-3">
          {/* 7 Core Student App Sections */}
          <nav
            aria-label="Student App Sections"
            className="flex items-center gap-1 overflow-x-auto rounded-lg bg-neutral-100 p-1 dark:bg-neutral-800"
          >
            {(
              [
                ['home', 'Home', Compass],
                ['learn', 'Learn', BookOpen],
                ['practice', 'Practice', Target],
                ['preparation', 'Preparation', Award],
                ['exams', 'Exams', Clock],
                ['books', 'Books', Layers],
                ['profile', 'Profile', User],
              ] as const
            ).map(([id, label, Icon]) => (
              <button
                key={id}
                type="button"
                onClick={() => setSection(id)}
                className={`inline-flex min-h-9 shrink-0 items-center gap-1.5 whitespace-nowrap rounded-md px-3 py-1.5 text-xs font-semibold transition-colors ${
                  section === id
                    ? 'bg-white text-[#1B6B46] shadow-sm dark:bg-neutral-900 dark:text-[#6CD19B]'
                    : 'text-neutral-600 hover:text-neutral-900 dark:text-neutral-300 dark:hover:text-white'
                }`}
              >
                <Icon className="h-3.5 w-3.5" />
                {label}
              </button>
            ))}
          </nav>

          {/* Isolated Track + KPK Board + Streak */}
          <div className="flex flex-wrap items-center gap-2.5">
            <select
              aria-label="Study Track"
              value={prefs.programmeTrack}
              onChange={(e) => {
                const nextTrack = e.target.value as ProgrammeId;
                setPrefs((prev) => ({ ...prev, programmeTrack: nextTrack }));
                resetDailyChallenge();
              }}
              className="min-h-9 rounded-lg border border-neutral-200 bg-white px-2.5 text-xs font-semibold dark:border-neutral-700 dark:bg-neutral-800"
            >
              <option value="ssc_hssc">KPK Board (Grades 9–12)</option>
              <option value="mdcat">MDCAT Admission (Isolated)</option>
              <option value="etea_eng">ETEA Engineering (Isolated)</option>
              <option value="uni_entrance">University Entrance (Isolated)</option>
            </select>

            <div className="flex items-center gap-1.5 rounded-lg border border-neutral-200 px-2.5 py-1.5 text-xs dark:border-neutral-700">
              <Flame className="h-3.5 w-3.5 text-[#B4690E] dark:text-[#E6A756]" />
              <span className="font-mono-tabular font-semibold">
                {dailyGoal.currentStreakDays}d streak
              </span>
              <span className="text-neutral-400">·</span>
              <span className="font-mono-tabular text-neutral-600 dark:text-neutral-300">
                {dailyGoal.todayQuestionsCompleted}/{dailyGoal.dailyQuestionTarget} Qs
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Guided 4-Step Student Study Setup Wizard (Non-Blocking & Persisted) */}
      {showOnboardingBanner && (
        <MotionReveal className="rounded-xl border border-[#1B6B46]/35 bg-white p-5 dark:border-[#6CD19B]/30 dark:bg-neutral-900">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-neutral-200 pb-3 dark:border-neutral-800">
            <div>
              <div className="text-[11px] font-semibold text-[#1B6B46] dark:text-[#6CD19B]">
                Step {onboardingStep + 1} of 4 · Student Setup
              </div>
              <h2 className="font-display text-base font-bold text-neutral-900 dark:text-neutral-100">
                {onboardingStep === 0 && 'Welcome to Roshan Study — Offline KPK Board Prep'}
                {onboardingStep === 1 && 'Choose Your Target Class (Grades 9–12)'}
                {onboardingStep === 2 && 'Select Your KPK BISE Board'}
                {onboardingStep === 3 && 'Choose Your Study Track & Daily Question Goal'}
              </h2>
            </div>
            <button
              type="button"
              onClick={() => {
                setPrefs((p) => ({ ...p, onboardingCompleted: true }));
                setShowOnboardingBanner(false);
              }}
              className="text-xs font-semibold text-neutral-500 hover:underline dark:text-neutral-400"
            >
              Skip Setup
            </button>
          </div>

          <div className="mt-4 text-xs">
            {onboardingStep === 0 && (
              <p className="max-w-2xl leading-relaxed text-neutral-600 dark:text-neutral-300">
                Master concepts in 5 guided steps, solve 8 KPK board formats including 6-step
                numericals, and practise timed papers completely offline with zero account required.
              </p>
            )}

            {onboardingStep === 1 && (
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                {([9, 10, 11, 12] as const).map((g) => (
                  <button
                    key={g}
                    type="button"
                    onClick={() => setPrefs((p) => ({ ...p, targetGrade: g }))}
                    className={`rounded-lg border px-3 py-2.5 text-left font-semibold transition ${
                      prefs.targetGrade === g
                        ? 'border-[#1B6B46] bg-[#D6F0E1]/40 text-[#1B6B46] dark:border-[#6CD19B] dark:text-[#6CD19B]'
                        : 'border-neutral-200 dark:border-neutral-700'
                    }`}
                  >
                    Grade {g} ({g <= 10 ? `SSC ${g === 9 ? 'I' : 'II'}` : `HSSC ${g === 11 ? 'I' : 'II'}`})
                  </button>
                ))}
              </div>
            )}

            {onboardingStep === 2 && (
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                {KPK_BOARDS.map((b) => (
                  <button
                    key={b}
                    type="button"
                    onClick={() => setPrefs((p) => ({ ...p, board: b }))}
                    className={`rounded-lg border px-3 py-2 text-left font-semibold transition ${
                      prefs.board === b
                        ? 'border-[#1B6B46] bg-[#D6F0E1]/40 text-[#1B6B46] dark:border-[#6CD19B] dark:text-[#6CD19B]'
                        : 'border-neutral-200 dark:border-neutral-700'
                    }`}
                  >
                    {b}
                  </button>
                ))}
              </div>
            )}

            {onboardingStep === 3 && (
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label className="mb-1 block font-semibold">Study Track</label>
                  <select
                    value={prefs.programmeTrack}
                    onChange={(e) =>
                      setPrefs((p) => ({ ...p, programmeTrack: e.target.value as ProgrammeId }))
                    }
                    className="w-full rounded-lg border border-neutral-200 bg-white px-3 py-2 dark:border-neutral-700 dark:bg-neutral-800"
                  >
                    <option value="ssc_hssc">KPK Board (SSC / HSSC)</option>
                    <option value="mdcat">MDCAT Admission</option>
                    <option value="etea_eng">ETEA Engineering</option>
                    <option value="uni_entrance">University Entrance</option>
                  </select>
                </div>
                <div>
                  <div className="mb-1 flex justify-between font-semibold">
                    <span>Daily Question Target</span>
                    <span className="font-mono-tabular">{dailyGoal.dailyQuestionTarget} Qs / day</span>
                  </div>
                  <input
                    type="range"
                    min={5}
                    max={30}
                    step={5}
                    value={dailyGoal.dailyQuestionTarget}
                    onChange={(e) =>
                      setDailyGoal((d) => ({ ...d, dailyQuestionTarget: Number(e.target.value) }))
                    }
                    className="w-full accent-[#1B6B46]"
                  />
                </div>
              </div>
            )}
          </div>

          <div className="mt-4 flex items-center justify-between border-t border-neutral-200 pt-3 dark:border-neutral-800">
            <button
              type="button"
              disabled={onboardingStep === 0}
              onClick={() => setOnboardingStep((s) => Math.max(0, s - 1))}
              className="rounded-lg border border-neutral-200 px-3 py-1.5 text-xs font-semibold disabled:opacity-40 dark:border-neutral-700"
            >
              Back
            </button>
            {onboardingStep < 3 ? (
              <button
                type="button"
                onClick={() => setOnboardingStep((s) => Math.min(3, s + 1))}
                className="rounded-lg bg-[#1B6B46] px-4 py-1.5 text-xs font-semibold text-white"
              >
                Continue
              </button>
            ) : (
              <button
                type="button"
                onClick={() => {
                  setPrefs((p) => ({ ...p, onboardingCompleted: true }));
                  setShowOnboardingBanner(false);
                }}
                className="rounded-lg bg-[#1B6B46] px-4 py-1.5 text-xs font-semibold text-white"
              >
                Finish Setup &amp; Start Studying
              </button>
            )}
          </div>
        </MotionReveal>
      )}

      {/* SECTION 1: HOME */}
      <MotionScreenSwap motionKey={section}>
      {section === 'home' && (
        <div className="grid items-start gap-6 lg:grid-cols-[1.5fr_1fr]">
          <div className="space-y-6">
            {/* Hero Focal Anchor: Continue Learning */}
            <div className="rounded-xl border border-neutral-200 bg-white p-6 dark:border-neutral-800 dark:bg-neutral-900">
              <div className="text-xs text-neutral-500 dark:text-neutral-400">
                {prefs.programmeTrack === 'ssc_hssc'
                  ? `${prefs.board} · Grade ${chapter?.grade ?? prefs.targetGrade} Board Track`
                  : `${prefs.programmeTrack.toUpperCase()} Isolated Admission Track`}
              </div>
              <h2 className="font-display mt-1 text-2xl font-bold text-neutral-900 dark:text-neutral-100">
                {chapter
                  ? `Continue: Ch ${chapter.chapterNumber} — ${chapter.title}`
                  : 'Explore KPK BISE Chapters'}
              </h2>
              <p className="mt-2 max-w-2xl text-sm leading-relaxed text-neutral-600 dark:text-neutral-300">
                {chapter
                  ? `${chapter.subjectName} · ${chapter.concepts.length} concept(s) · ${chapter.questions.length} board-aligned question(s) ready offline.`
                  : 'Upload a textbook PDF or import sample chapters to begin.'}
              </p>

              <div className="mt-4 flex flex-wrap gap-2.5">
                {chapter && (
                  <button
                    type="button"
                    onClick={() => handleSelectChapter(chapter.chapterId, 'learn')}
                    className="rounded-lg bg-[#1B6B46] px-4 py-2.5 text-xs font-semibold text-white hover:bg-[#155537]"
                  >
                    Resume Guided Lesson
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => {
                    setSection('preparation');
                    setPrepSubTab('daily10');
                  }}
                  className="rounded-lg border border-neutral-200 px-4 py-2.5 text-xs font-semibold text-neutral-800 hover:bg-neutral-50 dark:border-neutral-700 dark:text-neutral-100"
                >
                  Daily 10-MCQ Revision
                </button>
                <button
                  type="button"
                  onClick={() => setSection('books')}
                  className="rounded-lg border border-neutral-200 px-4 py-2.5 text-xs font-semibold text-neutral-800 hover:bg-neutral-50 dark:border-neutral-700 dark:text-neutral-100"
                >
                  Open PDF Library
                </button>
              </div>
            </div>

            {/* Today's Study Plan & Recommended Lessons */}
            <div className="rounded-xl border border-neutral-200 bg-white p-6 dark:border-neutral-800 dark:bg-neutral-900">
              <h3 className="text-sm font-bold text-neutral-900 dark:text-neutral-100">
                Recommended Chapters ({trackChapters.length} Loaded)
              </h3>
              <div className="mt-3 divide-y divide-neutral-200 dark:divide-neutral-800">
                {trackChapters.slice(0, 6).map((ch) => (
                  <div
                    key={ch.chapterId}
                    className="flex flex-wrap items-center justify-between gap-3 py-3 first:pt-1 last:pb-1"
                  >
                    <div>
                      <div className="text-[11px] text-neutral-500 dark:text-neutral-400">
                        Grade {ch.grade} · {ch.subjectName} · Ch {ch.chapterNumber}
                      </div>
                      <div className="text-sm font-semibold text-neutral-900 dark:text-neutral-100">
                        {ch.title}
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => handleSelectChapter(ch.chapterId, 'learn')}
                        className="rounded-lg border border-neutral-200 px-3 py-1.5 text-xs font-semibold text-[#1B6B46] hover:bg-neutral-50 dark:border-neutral-700 dark:text-[#6CD19B]"
                      >
                        Learn
                      </button>
                      <button
                        type="button"
                        onClick={() => handleSelectChapter(ch.chapterId, 'practice')}
                        className="rounded-lg border border-neutral-200 px-3 py-1.5 text-xs font-semibold text-neutral-700 hover:bg-neutral-50 dark:border-neutral-700 dark:text-neutral-200"
                      >
                        Practise ({ch.questions.length})
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Right Column: Today's Study Plan, Weak Areas (from real attempts) & Upcoming Exam */}
          <aside className="space-y-5">
            <div className="rounded-xl border border-neutral-200 bg-white p-5 dark:border-neutral-800 dark:bg-neutral-900">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-bold text-neutral-900 dark:text-neutral-100">
                  Today&apos;s Study Goal
                </h3>
                <span className="font-mono-tabular text-xs font-bold text-[#1B6B46] dark:text-[#6CD19B]">
                  {dailyPct}%
                </span>
              </div>
              <MotionProgressTrack percent={dailyPct} className="mt-2 h-2 w-full overflow-hidden rounded-full bg-neutral-100 dark:bg-neutral-800" />
              <p className="mt-2 text-xs text-neutral-600 dark:text-neutral-300">
                <span className="font-mono-tabular font-semibold">
                  {dailyGoal.todayQuestionsCompleted}/{dailyGoal.dailyQuestionTarget}
                </span>{' '}
                questions solved today ·{' '}
                <span className="font-mono-tabular">{dailyGoal.graceFreezesRemaining}</span>{' '}
                load-shedding grace freezes left.
              </p>
            </div>

            <div className="rounded-xl border border-neutral-200 bg-white p-5 dark:border-neutral-800 dark:bg-neutral-900">
              <h3 className="text-sm font-bold text-neutral-900 dark:text-neutral-100">
                Weak Areas (From Real Practice)
              </h3>
              {weakAreas.length === 0 ? (
                <p className="mt-2 text-xs text-neutral-500 dark:text-neutral-400">
                  No weak topics flagged yet — solve practice questions and incorrect items will
                  appear here automatically for targeted revision.
                </p>
              ) : (
                <div className="mt-3 space-y-2.5">
                  {weakAreas.map((w) => (
                    <div
                      key={w.chapterId}
                      className="flex items-center justify-between gap-2 text-xs"
                    >
                      <div>
                        <div className="font-semibold text-neutral-900 dark:text-neutral-100">
                          {w.subjectName}
                        </div>
                        <div className="font-mono-tabular text-neutral-500">
                          {w.wrong}/{w.total} missed
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => handleSelectChapter(w.chapterId, 'practice')}
                        className="rounded-lg border border-neutral-200 px-2.5 py-1 text-xs font-semibold text-[#1B6B46] dark:border-neutral-700 dark:text-[#6CD19B]"
                      >
                        Drill
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="rounded-xl border border-neutral-200 bg-white p-5 dark:border-neutral-800 dark:bg-neutral-900">
              <h3 className="text-sm font-bold text-neutral-900 dark:text-neutral-100">
                Available Mock &amp; Chapter Exams ({availableExams.length})
              </h3>
              {availableExams[0] && (
                <div className="mt-2 space-y-2 text-xs">
                  <div className="font-semibold text-neutral-800 dark:text-neutral-200">
                    {availableExams[0].title}
                  </div>
                  <div className="font-mono-tabular text-neutral-500">
                    {availableExams[0].durationMinutes} min · {availableExams[0].totalMarks} marks
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setSection('exams');
                      startExamAttempt(availableExams[0]);
                    }}
                    className="rounded-lg bg-[#1B6B46] px-3 py-1.5 text-xs font-semibold text-white"
                  >
                    Start Timed Paper
                  </button>
                </div>
              )}
            </div>
          </aside>
        </div>
      )}

      {/* SECTION 2: LEARN (Hierarchy Explorer + Guided 5-Step + Full 12-Part Concept + Motion/Graphs/Flashcards) */}
      {section === 'learn' && (
        <div className="space-y-5">
          {/* Curriculum Hierarchy Browser */}
          <div className="space-y-3 rounded-xl border border-neutral-200 bg-white p-4 dark:border-neutral-800 dark:bg-neutral-900">
            <div className="grid gap-2.5 sm:grid-cols-2 lg:grid-cols-[1fr_130px_160px_180px]">
              <div className="relative">
                <Search className="pointer-events-none absolute top-1/2 left-3 h-3.5 w-3.5 -translate-y-1/2 text-neutral-400" />
                <input
                  value={catalogSearch}
                  onChange={(e) => {
                    setCatalogSearch(e.target.value);
                    setCatalogPage(1);
                  }}
                  placeholder={`Search ${trackChapters.length} chapters, topics, or learning outcomes...`}
                  className="min-h-10 w-full rounded-lg border border-neutral-200 bg-neutral-50 pr-3 pl-9 text-xs dark:border-neutral-700 dark:bg-neutral-950"
                />
              </div>

              <select
                aria-label="Filter Grade"
                value={catalogGrade}
                onChange={(e) => {
                  setCatalogGrade(e.target.value);
                  setCatalogPage(1);
                }}
                className="min-h-10 rounded-lg border border-neutral-200 bg-white px-2.5 text-xs font-medium dark:border-neutral-700 dark:bg-neutral-800"
              >
                <option value="ALL">Grades 9–12</option>
                <option value="9">Grade 9 (SSC I)</option>
                <option value="10">Grade 10 (SSC II)</option>
                <option value="11">Grade 11 (HSSC I)</option>
                <option value="12">Grade 12 (HSSC II)</option>
              </select>

              <select
                aria-label="Filter Academic Group"
                value={catalogGroup}
                onChange={(e) => {
                  setCatalogGroup(e.target.value);
                  setCatalogPage(1);
                }}
                className="min-h-10 rounded-lg border border-neutral-200 bg-white px-2.5 text-xs font-medium dark:border-neutral-700 dark:bg-neutral-800"
              >
                <option value="ALL">All Groups</option>
                {dynamicCatalogGroups.map((grp) => (
                  <option key={grp} value={grp}>
                    {grp.replaceAll('_', ' ')}
                  </option>
                ))}
              </select>

              <select
                aria-label="Filter Subject"
                value={catalogSubject}
                onChange={(e) => {
                  setCatalogSubject(e.target.value);
                  setCatalogPage(1);
                }}
                className="min-h-10 rounded-lg border border-neutral-200 bg-white px-2.5 text-xs font-medium dark:border-neutral-700 dark:bg-neutral-800"
              >
                <option value="ALL">All Subjects ({dynamicCatalogSubjects.length})</option>
                {dynamicCatalogSubjects.map((sub) => (
                  <option key={sub} value={sub}>
                    {sub}
                  </option>
                ))}
              </select>
            </div>

            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex flex-wrap items-center gap-2">
                <select
                  aria-label="Select Chapter"
                  value={chapter?.chapterId ?? ''}
                  onChange={(e) => handleSelectChapter(e.target.value)}
                  className="min-h-9 rounded-lg border border-neutral-200 bg-white px-3 text-xs font-semibold dark:border-neutral-700 dark:bg-neutral-800"
                >
                  {pagedCatalogChapters.map((ch) => (
                    <option key={ch.chapterId} value={ch.chapterId}>
                      Grade {ch.grade} · {ch.subjectName} — Ch {ch.chapterNumber}: {ch.title}
                    </option>
                  ))}
                </select>

                {concepts.length > 1 && (
                  <select
                    aria-label="Select Concept"
                    value={safeConceptIdx}
                    onChange={(e) => {
                      setSelectedConceptIdx(Number(e.target.value));
                      setMicroStep(0);
                      setMicroChoice(null);
                      setFlashcardIdx(0);
                      setFlashcardFlipped(false);
                    }}
                    className="min-h-9 rounded-lg border border-neutral-200 bg-white px-3 text-xs font-medium dark:border-neutral-700 dark:bg-neutral-800"
                  >
                    {concepts.map((c, idx) => (
                      <option key={c.id} value={idx}>
                        Concept {idx + 1}: {c.title}
                      </option>
                    ))}
                  </select>
                )}

                {totalCatalogPages > 1 && (
                  <div className="flex items-center gap-1 text-xs">
                    <button
                      type="button"
                      disabled={safeCatalogPage <= 1}
                      onClick={() => setCatalogPage((p) => Math.max(1, p - 1))}
                      className="rounded border border-neutral-200 px-2 py-1 disabled:opacity-40 dark:border-neutral-700"
                    >
                      Prev
                    </button>
                    <span className="font-mono-tabular px-1 text-neutral-500">
                      {safeCatalogPage}/{totalCatalogPages}
                    </span>
                    <button
                      type="button"
                      disabled={safeCatalogPage >= totalCatalogPages}
                      onClick={() => setCatalogPage((p) => Math.min(totalCatalogPages, p + 1))}
                      className="rounded border border-neutral-200 px-2 py-1 disabled:opacity-40 dark:border-neutral-700"
                    >
                      Next
                    </button>
                  </div>
                )}
              </div>

              {chapter && (
                <button
                  type="button"
                  onClick={() => toggleChapterBookmark(chapter.chapterId)}
                  className={`inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-semibold ${
                    prefs.bookmarkedChapterIds.includes(chapter.chapterId)
                      ? 'border-[#1B6B46] bg-[#D6F0E1]/40 text-[#1B6B46] dark:border-[#6CD19B] dark:text-[#6CD19B]'
                      : 'border-neutral-200 text-neutral-700 dark:border-neutral-700 dark:text-neutral-200'
                  }`}
                >
                  <Bookmark className="h-3.5 w-3.5" />
                  {prefs.bookmarkedChapterIds.includes(chapter.chapterId)
                    ? 'Saved Chapter'
                    : 'Bookmark Chapter'}
                </button>
              )}
            </div>

            {/* 5-Step Guided Study Loop */}
            <div className="grid grid-cols-5 gap-1.5 rounded-lg border border-neutral-200 bg-neutral-50 p-1.5 text-[11px] dark:border-neutral-800 dark:bg-neutral-950">
              {(
                [
                  {
                    step: '1. Understand',
                    active: guidedMode && safeMicroStep < 2,
                    onClick: () => {
                      setGuidedMode(true);
                      setMicroStep(0);
                    },
                  },
                  {
                    step: '2. Recall',
                    active: !guidedMode || safeMicroStep >= 2,
                    onClick: () => setGuidedMode(false),
                  },
                  {
                    step: '3. Practise',
                    active: false,
                    onClick: () => setSection('practice'),
                  },
                  {
                    step: '4. Apply',
                    active: false,
                    onClick: () => {
                      setSection('preparation');
                      setPrepSubTab('pastpapers');
                    },
                  },
                  {
                    step: '5. Test',
                    active: false,
                    onClick: () => setSection('exams'),
                  },
                ] as const
              ).map((item) => (
                <button
                  key={item.step}
                  type="button"
                  onClick={item.onClick}
                  className={`rounded-md px-2 py-1.5 text-center font-semibold transition ${
                    item.active
                      ? 'bg-[#1B6B46] text-white'
                      : 'text-neutral-600 hover:bg-white dark:text-neutral-300 dark:hover:bg-neutral-800'
                  }`}
                >
                  {item.step}
                </button>
              ))}
            </div>
          </div>

          {chapter && concept ? (
            <div className="rounded-xl border border-neutral-200 bg-white p-6 dark:border-neutral-800 dark:bg-neutral-900">
              {(chapter.chapterIntro || (chapter.prerequisites && chapter.prerequisites.length > 0)) && (
                <div className="mb-4 space-y-1.5 rounded-lg border border-neutral-200 bg-neutral-50 p-3.5 text-xs dark:border-neutral-800 dark:bg-neutral-950">
                  {chapter.chapterIntro && (
                    <p className="leading-relaxed text-neutral-700 dark:text-neutral-300">
                      <strong>Chapter Overview:</strong> <MathText text={chapter.chapterIntro} />
                    </p>
                  )}
                  {chapter.prerequisites && chapter.prerequisites.length > 0 && (
                    <p className="text-neutral-600 dark:text-neutral-400">
                      <strong>Prerequisites:</strong> {chapter.prerequisites.join(' · ')}
                    </p>
                  )}
                </div>
              )}
              <div className="flex flex-wrap items-start justify-between gap-4 border-b border-neutral-200 pb-4 dark:border-neutral-800">
                <div>
                  <p className="text-xs text-neutral-500 dark:text-neutral-400">
                    Grade {chapter.grade} · {chapter.subjectName} · {prefs.board} · Ch{' '}
                    {chapter.chapterNumber}
                    {chapter.publicationStatus !== 'published' ? ` · ${chapter.publicationStatus}` : ''}
                  </p>
                  <h2 className="font-display mt-1 text-xl font-bold text-neutral-900 dark:text-neutral-100">
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
                            ? [`Formula: ${concept.formulas[0].expression}`]
                            : []),
                        ],
                      })
                    }
                    className="inline-flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-lg border border-neutral-200 px-3 py-1.5 text-xs font-semibold text-[#1B6B46] dark:border-neutral-700 dark:text-[#6CD19B]"
                  >
                    <MessageCircle className="h-3.5 w-3.5" />
                    Share Card
                  </button>

                  {concept.microCards.length > 0 && (
                    <div className="flex items-center gap-1 rounded-lg bg-neutral-100 p-1 dark:bg-neutral-800">
                      <button
                        type="button"
                        onClick={() => setGuidedMode(true)}
                        className={`rounded-md px-3 py-1 text-xs font-semibold ${
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
                        className={`rounded-md px-3 py-1 text-xs font-semibold ${
                          !guidedMode
                            ? 'bg-white text-[#1B6B46] shadow-sm dark:bg-neutral-900 dark:text-[#6CD19B]'
                            : 'text-neutral-600 dark:text-neutral-300'
                        }`}
                      >
                        Full Textbook &amp; Flashcards
                      </button>
                    </div>
                  )}
                </div>
              </div>

              {guidedMode && activeMicroCard ? (
                <div className="mt-5 space-y-5">
                  <div className="space-y-2">
                    <div className="flex justify-between text-xs text-neutral-500">
                      <span>
                        Step {safeMicroStep + 1} of {microCards.length}
                      </span>
                      <span className="font-mono-tabular">
                        {Math.round(((safeMicroStep + 1) / microCards.length) * 100)}%
                      </span>
                    </div>
                    <MotionProgressTrack
                      percent={((safeMicroStep + 1) / microCards.length) * 100}
                    />
                  </div>

                  <div className="space-y-4">
                    <h3 className="text-base font-semibold text-[#1B6B46] dark:text-[#6CD19B]">
                      {activeMicroCard.stageTitle}
                    </h3>
                    <div className="text-base leading-relaxed text-neutral-800 dark:text-neutral-200">
                      <MathText text={activeMicroCard.body} />
                    </div>

                    {activeMicroCard.quickCheckQuestion && (
                      <div className="space-y-3 border-t border-neutral-200 pt-4 dark:border-neutral-800">
                        <p className="text-sm font-semibold text-neutral-900 dark:text-neutral-100">
                          <MathText text={activeMicroCard.quickCheckQuestion} />
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
                              <MathText text={opt} />
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
                                Correct!
                              </>
                            ) : (
                              <>
                                <XCircle className="h-4 w-4" />
                                Correct answer: {activeMicroCard.quickCheckAnswer}
                              </>
                            )}
                          </p>
                        )}
                      </div>
                    )}
                  </div>

                  {/* Interactive Motion Graphic & Graph shown inline in Guided Mode too */}
                  {concept.motionGraphics && concept.motionGraphics.length > 0 && (
                    <MotionGraphicPlayer spec={concept.motionGraphics[0]} />
                  )}
                  {concept.graphs && concept.graphs.length > 0 && (
                    <MathGraphView spec={concept.graphs[0]} />
                  )}

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
                        className="rounded-lg bg-[#1B6B46] px-4 py-2 text-xs font-semibold text-white"
                      >
                        Next Step
                      </button>
                    ) : (
                      <button
                        type="button"
                        onClick={() => {
                          markConceptCompleted(concept.id);
                          bumpDailyGoalProgress(0, 1);
                          setSection('practice');
                        }}
                        className="rounded-lg bg-[#1B6B46] px-4 py-2 text-xs font-semibold text-white"
                      >
                        Complete Concept &amp; Practise
                      </button>
                    )}
                  </div>
                </div>
              ) : (
                <div className="mt-5 space-y-6">
                  {concept.learningObjectives && concept.learningObjectives.length > 0 && (
                    <div className="rounded-lg border border-neutral-200 bg-neutral-50 p-4 text-xs dark:border-neutral-800 dark:bg-neutral-950">
                      <div className="font-bold text-neutral-900 dark:text-neutral-100">
                        Learning Objectives (SLO Alignment)
                      </div>
                      <ul className="mt-1.5 list-disc space-y-1 pl-4 text-neutral-700 dark:text-neutral-300">
                        {concept.learningObjectives.map((obj, idx) => (
                          <li key={idx}>
                            <MathText text={obj} />
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}

                  <div className="space-y-3 text-base leading-relaxed text-neutral-800 dark:text-neutral-200">
                    <MathText text={concept.simpleExplanation} />
                    {concept.detailedExplanation && (
                      <p className="text-sm leading-relaxed text-neutral-600 dark:text-neutral-300">
                        <MathText text={concept.detailedExplanation} />
                      </p>
                    )}
                  </div>

                  {concept.motionGraphics?.map((mg) => (
                    <MotionGraphicPlayer key={mg.id} spec={mg} />
                  ))}

                  {concept.graphs?.map((graph) => (
                    <MathGraphView key={graph.id} spec={graph} />
                  ))}

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
                              <MathText text={f.expression} />
                            </div>
                            <div className="mt-1 text-xs text-neutral-600 dark:text-neutral-300">
                              <MathText text={f.description} />
                              {f.unit ? ` · Unit: ${f.unit}` : ''}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Interactive Flashcards */}
                  {activeFlashcard && (
                    <div className="space-y-2 border-t border-neutral-200 pt-4 dark:border-neutral-800">
                      <div className="flex items-center justify-between text-xs">
                        <span className="font-bold text-neutral-900 dark:text-neutral-100">
                          Recall Flashcards ({safeFlashcardIdx + 1}/{flashcards.length})
                        </span>
                        <div className="flex items-center gap-1.5">
                          <button
                            type="button"
                            disabled={safeFlashcardIdx <= 0}
                            onClick={() => {
                              setFlashcardIdx((i) => Math.max(0, i - 1));
                              setFlashcardFlipped(false);
                            }}
                            className="rounded border border-neutral-200 px-2 py-1 disabled:opacity-40 dark:border-neutral-700"
                          >
                            Prev
                          </button>
                          <button
                            type="button"
                            disabled={safeFlashcardIdx >= flashcards.length - 1}
                            onClick={() => {
                              setFlashcardIdx((i) => Math.min(flashcards.length - 1, i + 1));
                              setFlashcardFlipped(false);
                            }}
                            className="rounded border border-neutral-200 px-2 py-1 disabled:opacity-40 dark:border-neutral-700"
                          >
                            Next
                          </button>
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => setFlashcardFlipped((f) => !f)}
                        className="w-full rounded-xl border border-neutral-200 bg-neutral-50 p-5 text-left transition hover:bg-neutral-100 dark:border-neutral-700 dark:bg-neutral-800"
                      >
                        <div className="text-[11px] font-semibold text-[#1B6B46] dark:text-[#6CD19B]">
                          {flashcardFlipped ? 'Answer (Tap to Flip)' : 'Prompt (Tap to Reveal)'}
                        </div>
                        <div className="mt-1.5 text-sm font-semibold text-neutral-900 dark:text-neutral-100">
                          <MathText
                            text={flashcardFlipped ? activeFlashcard.back : activeFlashcard.front}
                          />
                        </div>
                      </button>
                    </div>
                  )}

                  {concept.workedExamplePrompt && (
                    <div className="space-y-2 border-t border-neutral-200 pt-4 dark:border-neutral-800">
                      <h3 className="text-sm font-semibold text-neutral-900 dark:text-neutral-100">
                        Worked Textbook Solution
                      </h3>
                      <p className="text-sm font-medium text-neutral-800 dark:text-neutral-200">
                        <MathText text={concept.workedExamplePrompt} />
                      </p>
                      <ol className="list-decimal space-y-1 pl-5 text-xs text-neutral-700 dark:text-neutral-300">
                        {concept.workedExampleSteps.map((step, i) => (
                          <li key={i}>
                            <MathText text={step} />
                          </li>
                        ))}
                      </ol>
                      {concept.workedExampleAnswer && (
                        <div className="text-xs font-bold text-[#1B6B46] dark:text-[#6CD19B]">
                          Final Answer: <MathText text={concept.workedExampleAnswer} />
                        </div>
                      )}
                    </div>
                  )}

                  {concept.commonMistake && (
                    <div className="rounded-lg border border-amber-500/30 bg-[#FEF4E6] p-3 text-xs text-[#6B4E16] dark:bg-[#3B2810] dark:text-[#E6A756]">
                      <div>
                        <strong>Common Board Mistake:</strong> {concept.commonMistake}
                      </div>
                      {concept.commonMistakeCorrection && (
                        <div className="mt-1">
                          <strong>Fix:</strong> {concept.commonMistakeCorrection}
                        </div>
                      )}
                    </div>
                  )}

                  {concept.glossaryHints.length > 0 && (
                    <div className="space-y-2 border-t border-neutral-200 pt-4 dark:border-neutral-800">
                      <h3 className="text-sm font-semibold text-neutral-900 dark:text-neutral-100">
                        1-Tap Urdu Meaning Support
                      </h3>
                      <div className="flex flex-wrap gap-2">
                        {concept.glossaryHints.map((g, idx) => (
                          <button
                            key={g.term}
                            type="button"
                            onClick={() =>
                              setActiveUrduIdx((cur) => (cur === idx ? null : idx))
                            }
                            className={`inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-medium ${
                              activeUrduIdx === idx
                                ? 'border-[#1B6B46] bg-[#D6F0E1]/40 text-[#1B6B46] dark:border-[#6CD19B] dark:text-[#6CD19B]'
                                : 'border-neutral-200 dark:border-neutral-700'
                            }`}
                          >
                            <Volume2 className="h-3.5 w-3.5" />
                            {g.term}
                          </button>
                        ))}
                      </div>
                      {activeUrduIdx !== null && concept.glossaryHints[activeUrduIdx] && (
                        <div className="rounded-lg bg-neutral-50 p-3 text-xs dark:bg-neutral-800">
                          <div dir="rtl" className="text-base font-bold">
                            {concept.glossaryHints[activeUrduIdx].urduMeaning}
                          </div>
                          <div className="mt-1 text-neutral-600 dark:text-neutral-300">
                            {concept.glossaryHints[activeUrduIdx].simpleHint}
                          </div>
                        </div>
                      )}
                    </div>
                  )}

                  {concept.videoLinks.length > 0 && (
                    <div className="space-y-2 border-t border-neutral-200 pt-4 dark:border-neutral-800">
                      <h3 className="text-sm font-semibold text-neutral-900 dark:text-neutral-100">
                        Curated Explanation Videos
                      </h3>
                      <div className="grid gap-2 sm:grid-cols-2">
                        {concept.videoLinks.map((v) => (
                          <a
                            key={v.youtubeUrl}
                            href={v.youtubeUrl}
                            target="_blank"
                            rel="noreferrer"
                            className="flex items-center justify-between rounded-lg border border-neutral-200 p-3 text-xs hover:bg-neutral-50 dark:border-neutral-700 dark:hover:bg-neutral-800"
                          >
                            <div className="flex items-center gap-2">
                              <PlayCircle className="h-4 w-4 text-[#1B6B46] dark:text-[#6CD19B]" />
                              <div>
                                <div className="font-semibold">{v.title}</div>
                                <div className="text-neutral-500">
                                  {v.channelName} · {v.durationLabel}
                                </div>
                              </div>
                            </div>
                            <ExternalLink className="h-3.5 w-3.5 text-neutral-400" />
                          </a>
                        ))}
                      </div>
                    </div>
                  )}

                  <div className="flex items-center justify-between border-t border-neutral-200 pt-4 text-xs dark:border-neutral-800">
                    <span className="text-neutral-500">
                      Source: {concept.sourceBook} ({concept.sourcePage})
                    </span>
                    <button
                      type="button"
                      onClick={() => {
                        markConceptCompleted(concept.id);
                        bumpDailyGoalProgress(0, 1);
                        setSection('practice');
                      }}
                      className="rounded-lg bg-[#1B6B46] px-4 py-2 font-semibold text-white"
                    >
                      Mark Studied &amp; Practise
                    </button>
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className="rounded-xl border border-neutral-200 bg-white p-8 text-center text-xs text-neutral-500 dark:border-neutral-800 dark:bg-neutral-900">
              No chapters match the current filter. Reset filters above or upload a book.
            </div>
          )}
        </div>
      )}

      {/* SECTION 3: PRACTICE (All 8 Formats) */}
      {section === 'practice' && (
        <div className="space-y-5 rounded-xl border border-neutral-200 bg-white p-6 dark:border-neutral-800 dark:bg-neutral-900">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-neutral-200 pb-4 dark:border-neutral-800">
            <div>
              <p className="text-xs text-neutral-500 dark:text-neutral-400">
                Grade {chapter?.grade ?? prefs.targetGrade} · {chapter?.subjectName ?? 'All Subjects'}
              </p>
              <h2 className="text-lg font-bold text-neutral-900 dark:text-neutral-100">
                Interactive Practice (8 KPK Question Formats)
              </h2>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <select
                aria-label="Practice Chapter"
                value={chapter?.chapterId ?? ''}
                onChange={(e) => handleSelectChapter(e.target.value)}
                className="min-h-9 rounded-lg border border-neutral-200 bg-white px-2.5 text-xs font-medium dark:border-neutral-700 dark:bg-neutral-800"
              >
                {trackChapters.map((ch) => (
                  <option key={ch.chapterId} value={ch.chapterId}>
                    G{ch.grade} Ch {ch.chapterNumber}: {ch.title} ({ch.questions.length})
                  </option>
                ))}
              </select>

              <select
                aria-label="Filter Question Format"
                value={practiceTypeFilter}
                onChange={(e) => setPracticeTypeFilter(e.target.value)}
                className="min-h-9 rounded-lg border border-neutral-200 bg-white px-2.5 text-xs font-medium dark:border-neutral-700 dark:bg-neutral-800"
              >
                <option value="ALL">All Formats</option>
                <option value="mcq">MCQ</option>
                <option value="multi_select">Multi-Select</option>
                <option value="true_false">True / False</option>
                <option value="fill_in">Fill-in-the-Blank</option>
                <option value="matching">Matching</option>
                <option value="numerical">6-Step Numerical</option>
                <option value="short_answer">Short Answer</option>
                <option value="long_answer">Long Answer</option>
              </select>
            </div>
          </div>

          {chapter && !practiceSessionDone ? (
            <StudentPracticeRunner
              chapter={chapter}
              questions={practiceQuestions}
              board={prefs.board}
              onAttemptRecorded={(q, ok) => {
                bumpDailyGoalProgress(1, 0);
                onRecordAttempt({
                  id: `att_prac_${Date.now()}`,
                  programmeId: q.programmeId,
                  questionId: q.id,
                  chapterId: chapter.chapterId,
                  subjectName: chapter.subjectName,
                  conceptTitle: concept?.title ?? chapter.title,
                  isCorrect: ok,
                  difficulty: q.difficulty,
                  timestamp: new Date().toISOString(),
                });
              }}
              onCompleteSession={() => setPracticeSessionDone(true)}
              onShareCard={setShareCard}
            />
          ) : (
            <div className="space-y-3 py-6 text-center">
              <CheckCircle2 className="mx-auto h-7 w-7 text-[#1E7E4E] dark:text-[#6CD19B]" />
              <div className="text-base font-bold text-neutral-900 dark:text-neutral-100">
                Practice Set Complete!
              </div>
              <p className="text-xs text-neutral-600 dark:text-neutral-300">
                All attempts are saved locally to update your Weak Areas and Exam Readiness metrics.
              </p>
              <button
                type="button"
                onClick={() => setPracticeSessionDone(false)}
                className="rounded-lg bg-[#1B6B46] px-4 py-2 text-xs font-semibold text-white"
              >
                Practise Again
              </button>
            </div>
          )}
        </div>
      )}

      {/* SECTION 4: PREPARATION (Readiness Indicator + Daily 10-MCQ + Past Papers + Checklist) */}
      {section === 'preparation' && (
        <div className="space-y-6">
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-neutral-200 bg-white p-4 dark:border-neutral-800 dark:bg-neutral-900">
            <div className="flex items-center gap-1 rounded-lg bg-neutral-100 p-1 dark:bg-neutral-800">
              {(
                [
                  ['overview', 'Exam Readiness & Checklist'],
                  ['daily10', 'Daily 10-MCQ Revision'],
                  ['pastpapers', 'Solved Past Papers'],
                ] as const
              ).map(([id, label]) => (
                <button
                  key={id}
                  type="button"
                  onClick={() => setPrepSubTab(id)}
                  className={`rounded-md px-3 py-1.5 text-xs font-semibold ${
                    prepSubTab === id
                      ? 'bg-white text-[#1B6B46] shadow-sm dark:bg-neutral-900 dark:text-[#6CD19B]'
                      : 'text-neutral-600 dark:text-neutral-300'
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>

            <span className="text-xs text-neutral-500">
              Isolated Track:{' '}
              <strong>
                {prefs.programmeTrack === 'ssc_hssc'
                  ? `KPK BISE (${prefs.board})`
                  : prefs.programmeTrack.toUpperCase()}
              </strong>
            </span>
          </div>

          {prepSubTab === 'overview' && (
            <div className="grid gap-6 lg:grid-cols-2">
              {/* Honest Evidence-Based Readiness Indicator */}
              <div className="rounded-xl border border-neutral-200 bg-white p-6 dark:border-neutral-800 dark:bg-neutral-900">
                <h3 className="text-sm font-bold text-neutral-900 dark:text-neutral-100">
                  Evidence-Based Preparation Summary
                </h3>
                <p className="mt-1 text-xs text-neutral-500 dark:text-neutral-400">
                  Calculated strictly from your recorded study coverage, practice accuracy, and
                  completed exams—never guessed scores.
                </p>

                <div className="mt-4 grid grid-cols-2 gap-4 text-xs">
                  <div className="border-t border-neutral-200 pt-3 dark:border-neutral-800">
                    <div className="text-neutral-500">Concept Coverage</div>
                    <div className="font-mono-tabular mt-1 text-xl font-bold text-neutral-900 dark:text-neutral-100">
                      {readinessMetrics.coveragePct}%
                    </div>
                    <div className="font-mono-tabular text-[11px] text-neutral-500">
                      {readinessMetrics.studiedConceptsCount}/{readinessMetrics.totalTrackConcepts}{' '}
                      concepts studied
                    </div>
                  </div>
                  <div className="border-t border-neutral-200 pt-3 dark:border-neutral-800">
                    <div className="text-neutral-500">Practice Accuracy</div>
                    <div className="font-mono-tabular mt-1 text-xl font-bold text-[#1B6B46] dark:text-[#6CD19B]">
                      {readinessMetrics.accuracyPct}%
                    </div>
                    <div className="font-mono-tabular text-[11px] text-neutral-500">
                      {readinessMetrics.attemptsCount} total attempt(s)
                    </div>
                  </div>
                  <div className="border-t border-neutral-200 pt-3 dark:border-neutral-800">
                    <div className="text-neutral-500">Published Chapters</div>
                    <div className="font-mono-tabular mt-1 text-xl font-bold text-neutral-900 dark:text-neutral-100">
                      {readinessMetrics.publishedCount}/{readinessMetrics.totalChapters}
                    </div>
                    <div className="text-[11px] text-neutral-500">Verified in active track</div>
                  </div>
                  <div className="border-t border-neutral-200 pt-3 dark:border-neutral-800">
                    <div className="text-neutral-500">Completed Exams</div>
                    <div className="font-mono-tabular mt-1 text-xl font-bold text-neutral-900 dark:text-neutral-100">
                      {readinessMetrics.completedExamsCount}
                    </div>
                    <div className="text-[11px] text-neutral-500">Timed or untimed papers</div>
                  </div>
                </div>
              </div>

              {/* Board Exam Checklist */}
              <div className="rounded-xl border border-neutral-200 bg-white p-6 dark:border-neutral-800 dark:bg-neutral-900">
                <h3 className="text-sm font-bold text-neutral-900 dark:text-neutral-100">
                  {prefs.board} Exam Preparation Checklist
                </h3>
                <div className="mt-3 space-y-2.5 text-xs">
                  {BOARD_PREP_CHECKLIST.map((item) => {
                    const checked = Boolean(prefs.prepChecklist[item]);
                    return (
                      <label key={item} className="flex cursor-pointer items-start gap-2.5">
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={(e) =>
                            setPrefs((prev) => ({
                              ...prev,
                              prepChecklist: {
                                ...prev.prepChecklist,
                                [item]: e.target.checked,
                              },
                            }))
                          }
                          className="mt-0.5 accent-[#1B6B46]"
                        />
                        <span
                          className={
                            checked
                              ? 'text-neutral-400 line-through'
                              : 'text-neutral-800 dark:text-neutral-200'
                          }
                        >
                          {item}
                        </span>
                      </label>
                    );
                  })}
                </div>
              </div>
            </div>
          )}

          {prepSubTab === 'daily10' && (
            <div className="rounded-xl border border-neutral-200 bg-white p-6 dark:border-neutral-800 dark:bg-neutral-900">
              {challengeFinished ? (
                <div className="space-y-4 py-3">
                  <div className="flex items-center gap-2 text-base font-bold text-[#1B6B46] dark:text-[#6CD19B]">
                    <ShieldCheck className="h-5 w-5" />
                    Daily 10-MCQ Complete
                  </div>
                  <div className="font-mono-tabular text-3xl font-bold">
                    {challengeScore} / {challengeQuestions.length} Correct
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={() =>
                        setShareCard({
                          kicker: isAdmissionTrack
                            ? `${prefs.programmeTrack.toUpperCase()} Challenge`
                            : `KPK BISE (${prefs.board}) Daily 10`,
                          title: `Today's Score (${dailyGoal.todayDateIso})`,
                          highlightMetric: `${challengeScore} / ${challengeQuestions.length}`,
                          lines: [`Current Streak: ${dailyGoal.currentStreakDays} day(s)`],
                        })
                      }
                      className="inline-flex items-center gap-1.5 rounded-lg bg-[#1B6B46] px-4 py-2 text-xs font-semibold text-white"
                    >
                      <MessageCircle className="h-3.5 w-3.5" />
                      Share Score
                    </button>
                    <button
                      type="button"
                      onClick={resetDailyChallenge}
                      className="inline-flex items-center gap-1.5 rounded-lg border border-neutral-200 px-4 py-2 text-xs font-semibold dark:border-neutral-700"
                    >
                      <RotateCcw className="h-3.5 w-3.5" />
                      Retake
                    </button>
                  </div>
                </div>
              ) : activeChallengeQ ? (
                <div className="space-y-4">
                  <div className="flex justify-between text-xs text-neutral-500">
                    <span>
                      Question {challengeIdx + 1} of {challengeQuestions.length} · Grade{' '}
                      {activeChallengeQ.grade}
                    </span>
                    <span className="font-mono-tabular font-semibold text-[#1B6B46] dark:text-[#6CD19B]">
                      Score: {challengeScore}
                    </span>
                  </div>
                  <h3 className="text-base font-semibold text-neutral-900 dark:text-neutral-100">
                    <MathText text={activeChallengeQ.statement} />
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
                        <MathText text={opt} />
                      </label>
                    ))}
                  </div>
                  {!challengeSubmitted ? (
                    <button
                      type="button"
                      disabled={!challengeSelected}
                      onClick={() => {
                        const ok = challengeSelected === activeChallengeQ.correctAnswer;
                        setChallengeSubmitted(true);
                        if (ok) setChallengeScore((s) => s + 1);
                        bumpDailyGoalProgress(1, 0);
                        onRecordAttempt({
                          id: `att_daily_${Date.now()}`,
                          programmeId: prefs.programmeTrack,
                          questionId: activeChallengeQ.id,
                          chapterId: activeChallengeQ.chapterId,
                          subjectName: isAdmissionTrack
                            ? `${prefs.programmeTrack.toUpperCase()} Daily 10`
                            : 'KPK Board Daily 10',
                          conceptTitle: 'Daily Revision',
                          isCorrect: ok,
                          difficulty: activeChallengeQ.difficulty,
                          timestamp: new Date().toISOString(),
                        });
                      }}
                      className="rounded-lg bg-[#1B6B46] px-4 py-2 text-xs font-semibold text-white disabled:opacity-50"
                    >
                      Check Answer
                    </button>
                  ) : (
                    <div className="space-y-2 border-t border-neutral-200 pt-3 text-xs dark:border-neutral-800">
                      <div className="font-bold">
                        {challengeSelected === activeChallengeQ.correctAnswer
                          ? 'Correct!'
                          : `Correct Answer: ${activeChallengeQ.correctAnswer}`}
                      </div>
                      <p className="text-neutral-600 dark:text-neutral-300">
                        {activeChallengeQ.explanation}
                      </p>
                      <button
                        type="button"
                        onClick={() => {
                          if (challengeIdx + 1 < challengeQuestions.length) {
                            setChallengeIdx((i) => i + 1);
                            setChallengeSelected('');
                            setChallengeSubmitted(false);
                          } else {
                            setChallengeFinished(true);
                          }
                        }}
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

          {prepSubTab === 'pastpapers' && (
            <div className="space-y-4 rounded-xl border border-neutral-200 bg-white p-6 dark:border-neutral-800 dark:bg-neutral-900">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h3 className="text-sm font-bold text-neutral-900 dark:text-neutral-100">
                  Solved Past Papers &amp; KPK Board Archive ({filteredPastPapers.length})
                </h3>
                <label className="flex cursor-pointer items-center gap-1.5 text-xs">
                  <input
                    type="checkbox"
                    checked={ppVerifiedOnly}
                    onChange={(e) => setPpVerifiedOnly(e.target.checked)}
                    className="accent-[#1B6B46]"
                  />
                  Official BISE Board Papers Only
                </label>
              </div>

              <div className="grid gap-2.5 sm:grid-cols-2 lg:grid-cols-4">
                <select
                  value={ppBoardFilter}
                  onChange={(e) => setPpBoardFilter(e.target.value)}
                  className="rounded-lg border border-neutral-200 bg-neutral-50 px-2.5 py-2 text-xs dark:border-neutral-700 dark:bg-neutral-800"
                >
                  <option value="ALL">All 8 KPK Boards</option>
                  {KPK_BOARDS.map((b) => (
                    <option key={b} value={b}>
                      {b}
                    </option>
                  ))}
                </select>
                <select
                  value={ppGradeFilter}
                  onChange={(e) => setPpGradeFilter(e.target.value)}
                  className="rounded-lg border border-neutral-200 bg-neutral-50 px-2.5 py-2 text-xs dark:border-neutral-700 dark:bg-neutral-800"
                >
                  <option value="ALL">All Grades</option>
                  {[9, 10, 11, 12].map((g) => (
                    <option key={g} value={String(g)}>
                      Grade {g}
                    </option>
                  ))}
                </select>
                <select
                  value={ppSubjectFilter}
                  onChange={(e) => setPpSubjectFilter(e.target.value)}
                  className="rounded-lg border border-neutral-200 bg-neutral-50 px-2.5 py-2 text-xs dark:border-neutral-700 dark:bg-neutral-800"
                >
                  <option value="ALL">All Subjects</option>
                  {availablePpSubjects.map((s) => (
                    <option key={s} value={s}>
                      {s}
                    </option>
                  ))}
                </select>
                <select
                  value={ppTypeFilter}
                  onChange={(e) => setPpTypeFilter(e.target.value)}
                  className="rounded-lg border border-neutral-200 bg-neutral-50 px-2.5 py-2 text-xs dark:border-neutral-700 dark:bg-neutral-800"
                >
                  <option value="ALL">All Formats</option>
                  <option value="mcq">MCQs</option>
                  <option value="numerical">6-Step Numericals</option>
                  <option value="short_answer">Short Answer</option>
                  <option value="long_answer">Long Answer</option>
                </select>
              </div>

              <div className="divide-y divide-neutral-200 dark:divide-neutral-800">
                {filteredPastPapers.slice(0, 30).map(({ question, subjectName, chapterNumber, chapterTitle }) => {
                  const isOpen = expandedPaperId === question.id;
                  return (
                    <div key={question.id} className="py-3.5">
                      <div className="flex flex-wrap items-start justify-between gap-2">
                        <div>
                          <div className="text-[11px] text-neutral-500">
                            Grade {question.grade} · {subjectName} · Ch {chapterNumber}:{' '}
                            {chapterTitle} · {question.sourceBoardId ?? 'Practice Standard'}
                            {question.sourceYear ? ` (${question.sourceYear})` : ''}
                          </div>
                          <div className="mt-0.5 text-sm font-semibold text-neutral-900 dark:text-neutral-100">
                            <MathText text={question.statement} />
                          </div>
                        </div>
                        <button
                          type="button"
                          onClick={() => setExpandedPaperId(isOpen ? null : question.id)}
                          className="rounded-lg border border-neutral-200 px-3 py-1 text-xs font-semibold dark:border-neutral-700"
                        >
                          {isOpen ? 'Hide Solution' : 'View Solution'}
                        </button>
                      </div>
                      {isOpen && (
                        <div className="mt-2.5 space-y-1.5 rounded-lg bg-neutral-50 p-3 text-xs dark:bg-neutral-800">
                          <div>
                            <strong>Answer:</strong> <MathText text={question.correctAnswer} />
                          </div>
                          <p>
                            <MathText text={question.explanation} />
                          </p>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      )}

      {/* SECTION 5: EXAMS (Section A/B/C Timer + localStorage Auto-Save + Grading) */}
      {section === 'exams' && (
        <div className="rounded-xl border border-neutral-200 bg-white p-6 dark:border-neutral-800 dark:bg-neutral-900">
          {!examStarted ? (
            <div className="space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-3 border-b border-neutral-200 pb-4 dark:border-neutral-800">
                <div>
                  <h2 className="text-lg font-bold text-neutral-900 dark:text-neutral-100">
                    KPK BISE Board Pattern &amp; Chapter Exams ({availableExams.length})
                  </h2>
                  <p className="text-xs text-neutral-500 dark:text-neutral-400">
                    Progress saves automatically on your device so load-shedding never erases answers.
                  </p>
                </div>
                <label className="flex cursor-pointer items-center gap-2 text-xs font-medium">
                  <input
                    type="checkbox"
                    checked={examTimed}
                    onChange={(e) => setExamTimed(e.target.checked)}
                    className="accent-[#1B6B46]"
                  />
                  Enable Countdown Timer
                </label>
              </div>

              <div className="divide-y divide-neutral-200 dark:divide-neutral-800">
                {availableExams.map((ex) => (
                  <div key={ex.id} className="flex flex-wrap items-center justify-between gap-3 py-3.5">
                    <div>
                      <div className="text-sm font-bold text-neutral-900 dark:text-neutral-100">
                        {ex.title}
                      </div>
                      <div className="font-mono-tabular text-xs text-neutral-500">
                        {ex.durationMinutes} min · {ex.totalMarks} marks · {ex.sections.length}{' '}
                        sections
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => startExamAttempt(ex)}
                      className="rounded-lg bg-[#1B6B46] px-4 py-2 text-xs font-semibold text-white hover:bg-[#155537]"
                    >
                      Start Paper
                    </button>
                  </div>
                ))}
              </div>
            </div>
          ) : activeExam ? (
            <div className="space-y-5">
              <div className="flex flex-wrap items-center justify-between gap-3 border-b border-neutral-200 pb-4 dark:border-neutral-800">
                <div>
                  <h2 className="text-base font-bold text-neutral-900 dark:text-neutral-100">
                    {activeExam.title}
                  </h2>
                  <div className="font-mono-tabular text-xs text-neutral-500">
                    {activeExam.totalMarks} Total Marks · {prefs.board} Marking Pattern
                  </div>
                </div>
                {examTimed && (
                  <div className="font-mono-tabular inline-flex items-center gap-1.5 rounded-lg border border-neutral-200 px-3 py-1.5 text-sm font-bold text-[#1B6B46] dark:border-neutral-700 dark:text-[#6CD19B]">
                    <Clock className="h-4 w-4" />
                    {String(Math.floor(examSecondsLeft / 60)).padStart(2, '0')}:
                    {String(examSecondsLeft % 60).padStart(2, '0')}
                  </div>
                )}
              </div>

              {examFinished && (
                <div className="space-y-3 rounded-lg border border-[#1B6B46]/30 bg-[#D6F0E1]/40 p-4 text-xs dark:bg-[#174F33]/40">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="font-bold text-[#1B6B46] dark:text-[#6CD19B]">
                      {examScoringLoading
                        ? 'Calculating Authoritative Exam Score...'
                        : examScoreResult
                          ? `Exam Score: ${examScoreResult.scoreObtained}/${examScoreResult.totalMarks} (${examScoreResult.percentage}%)`
                          : 'Exam Graded — Review Keys & Marking Schemes Below'}
                    </div>
                    {examScoreResult?.idempotentReplay && (
                      <span className="text-[11px] text-neutral-500">Synced (idempotent)</span>
                    )}
                  </div>

                  {examScoringError && (
                    <div className="flex flex-wrap items-center justify-between gap-2 rounded border border-[#B4690E]/40 bg-[#FEF4E6] px-3 py-2 text-[#6B4E16] dark:bg-[#3B2810] dark:text-[#E6A756]">
                      <span>{examScoringError}</span>
                      <button
                        type="button"
                        onClick={() => void finishExamAttempt()}
                        className="rounded bg-[#1B6B46] px-2.5 py-1 text-[11px] font-semibold text-white"
                      >
                        Retry Score Sync
                      </button>
                    </div>
                  )}

                  {examScoreResult && examScoreResult.sectionBreakdown.length > 0 && (
                    <div className="grid gap-2 sm:grid-cols-3">
                      {examScoreResult.sectionBreakdown.map((sec) => (
                        <div
                          key={sec.label}
                          className="rounded border border-neutral-200 bg-white p-2.5 dark:border-neutral-800 dark:bg-neutral-900"
                        >
                          <div className="truncate font-semibold">{sec.label}</div>
                          <div className="font-mono-tabular mt-0.5 text-sm font-bold text-[#1B6B46] dark:text-[#6CD19B]">
                            {sec.obtained}/{sec.possible} marks
                          </div>
                        </div>
                      ))}
                    </div>
                  )}

                  {examScoreResult && examScoreResult.weakTopics.length > 0 && (
                    <div className="space-y-1.5 border-t border-[#1B6B46]/20 pt-2">
                      <div className="font-bold text-neutral-900 dark:text-neutral-100">
                        Weak Concept Diagnosis — Recommended Revision
                      </div>
                      <div className="space-y-1.5">
                        {examScoreResult.weakTopics.map((wt) => (
                          <div
                            key={wt.conceptId}
                            className="flex flex-wrap items-center justify-between gap-2 rounded bg-white px-3 py-2 dark:bg-neutral-900"
                          >
                            <span>
                              <strong>{wt.conceptTitle}</strong> · {wt.missedCount}/{wt.totalCount}{' '}
                              missed ({wt.accuracyPercent}% accuracy)
                            </span>
                            <button
                              type="button"
                              onClick={() => {
                                if (activeExam.chapterId) {
                                  handleSelectChapter(activeExam.chapterId, 'practice');
                                } else {
                                  setSection('practice');
                                }
                              }}
                              className="rounded border border-[#1B6B46] px-2.5 py-1 text-[11px] font-semibold text-[#1B6B46] dark:border-[#6CD19B] dark:text-[#6CD19B]"
                            >
                              Practise Concept
                            </button>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {activeExam.sections.map((sec) => (
                <div key={sec.label} className="space-y-3 border-t border-neutral-200 pt-4 first:border-t-0 dark:border-neutral-800">
                  <h3 className="text-sm font-bold text-[#1B6B46] dark:text-[#6CD19B]">
                    {sec.label}
                  </h3>
                  {sec.questionIds.map((qid, idx) => {
                    const q = examQuestionLookup.get(qid);
                    if (!q) return null;
                    return (
                      <div key={qid} className="space-y-2 rounded-lg border border-neutral-200 p-3 text-xs dark:border-neutral-800">
                        <div className="flex justify-between gap-2 font-semibold">
                          <span>
                            Q{idx + 1}. <MathText text={q.statement} />
                          </span>
                          <span className="font-mono-tabular shrink-0 text-neutral-500">
                            {sec.marksEach}m
                          </span>
                        </div>
                        {q.options.length > 0 && (
                          <div className="grid gap-1.5 sm:grid-cols-2">
                            {q.options.map((opt) => (
                              <label
                                key={opt}
                                className="flex cursor-pointer items-center gap-2 rounded border border-neutral-200 px-2.5 py-1.5 dark:border-neutral-700"
                              >
                                <input
                                  type="radio"
                                  name={`exam_${qid}`}
                                  disabled={examFinished}
                                  checked={examAnswers[qid] === opt}
                                  onChange={() =>
                                    setExamAnswers((prev) => ({ ...prev, [qid]: opt }))
                                  }
                                  className="accent-[#1B6B46]"
                                />
                                <MathText text={opt} />
                              </label>
                            ))}
                          </div>
                        )}
                        {examFinished && (
                          <div className="rounded bg-neutral-50 p-2.5 dark:bg-neutral-800">
                            <div className="font-semibold text-[#1B6B46] dark:text-[#6CD19B]">
                              Official Key: <MathText text={q.correctAnswer} />
                            </div>
                            <p className="mt-1 text-neutral-600 dark:text-neutral-300">
                              <MathText text={q.explanation} />
                            </p>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              ))}

              <div className="flex flex-wrap items-center gap-2 border-t border-neutral-200 pt-4 dark:border-neutral-800">
                {!examFinished ? (
                  <button
                    type="button"
                    disabled={examScoringLoading}
                    onClick={() => void finishExamAttempt()}
                    className="rounded-lg bg-[#1B6B46] px-4 py-2 text-xs font-semibold text-white disabled:opacity-60"
                  >
                    {examScoringLoading ? 'Scoring...' : 'Submit Exam Paper'}
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={() => startExamAttempt(activeExam)}
                    className="rounded-lg bg-[#1B6B46] px-4 py-2 text-xs font-semibold text-white"
                  >
                    Retake Paper
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => {
                    setExamStarted(false);
                    localStorage.removeItem(STORAGE_ACTIVE_EXAM_KEY);
                  }}
                  className="rounded-lg border border-neutral-200 px-3 py-2 text-xs font-semibold dark:border-neutral-700"
                >
                  Back to Exams List
                </button>
              </div>
            </div>
          ) : null}
        </div>
      )}

      {/* SECTION 6: BOOKS (Uploaded PDF Library & Reader) */}
      {section === 'books' && <PdfBookLibrary programmeFilter={prefs.programmeTrack} />}

      {/* SECTION 7: PROFILE & PROGRESS (Zero PII, Local Only) */}
      {section === 'profile' && (
        <div className="grid gap-6 lg:grid-cols-2">
          <div className="space-y-4 rounded-xl border border-neutral-200 bg-white p-6 text-xs dark:border-neutral-800 dark:bg-neutral-900">
            <div className="flex items-center gap-2">
              <GraduationCap className="h-4 w-4 text-[#1B6B46] dark:text-[#6CD19B]" />
              <h3 className="text-sm font-bold text-neutral-900 dark:text-neutral-100">
                Local Study Preferences (Zero Account · Zero PII)
              </h3>
            </div>
            <p className="text-neutral-500 dark:text-neutral-400">
              Your board preference, bookmarks, streak, and exam drafts stay stored privately on your
              device without requiring login or personal data.
            </p>

            <div>
              <label className="mb-1 block font-semibold">Preferred KPK BISE Board</label>
              <select
                value={prefs.board}
                onChange={(e) => setPrefs((p) => ({ ...p, board: e.target.value }))}
                className="w-full rounded-lg border border-neutral-200 bg-white px-3 py-2 dark:border-neutral-700 dark:bg-neutral-800"
              >
                {KPK_BOARDS.map((b) => (
                  <option key={b} value={b}>
                    {b}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="mb-1 block font-semibold">Target Class</label>
              <select
                value={prefs.targetGrade}
                onChange={(e) =>
                  setPrefs((p) => ({
                    ...p,
                    targetGrade: Number(e.target.value) as 9 | 10 | 11 | 12,
                  }))
                }
                className="w-full rounded-lg border border-neutral-200 bg-white px-3 py-2 dark:border-neutral-700 dark:bg-neutral-800"
              >
                <option value={9}>Grade 9 (SSC Part I)</option>
                <option value={10}>Grade 10 (SSC Part II)</option>
                <option value={11}>Grade 11 (HSSC Part I)</option>
                <option value={12}>Grade 12 (HSSC Part II)</option>
              </select>
            </div>

            <div>
              <div className="mb-1 flex justify-between font-semibold">
                <span>Daily Question Target</span>
                <span className="font-mono-tabular">{dailyGoal.dailyQuestionTarget} Qs / day</span>
              </div>
              <input
                type="range"
                min={5}
                max={30}
                step={5}
                value={dailyGoal.dailyQuestionTarget}
                onChange={(e) =>
                  setDailyGoal((prev) => ({
                    ...prev,
                    dailyQuestionTarget: Number(e.target.value),
                  }))
                }
                className="w-full accent-[#1B6B46]"
              />
            </div>

            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => {
                  setOnboardingStep(0);
                  setShowOnboardingBanner(true);
                  setSection('home');
                }}
                className="rounded-lg border border-[#1B6B46] px-3 py-2 font-semibold text-[#1B6B46] dark:border-[#6CD19B] dark:text-[#6CD19B]"
              >
                Re-run Setup Wizard
              </button>
              {onClearAttempts && (
                <button
                  type="button"
                  onClick={onClearAttempts}
                  className="rounded-lg border border-[#B9382C]/40 px-3 py-2 font-semibold text-[#B9382C] dark:text-[#F28B82]"
                >
                  Reset Practice History
                </button>
              )}
            </div>
          </div>

          <div className="space-y-4 rounded-xl border border-neutral-200 bg-white p-6 text-xs dark:border-neutral-800 dark:bg-neutral-900">
            <h3 className="text-sm font-bold text-neutral-900 dark:text-neutral-100">
              Saved Chapters ({prefs.bookmarkedChapterIds.length}) &amp; Recent Activity
            </h3>
            {prefs.bookmarkedChapterIds.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {prefs.bookmarkedChapterIds.map((id) => {
                  const found = chapters.find((c) => c.chapterId === id);
                  if (!found) return null;
                  return (
                    <button
                      key={id}
                      type="button"
                      onClick={() => handleSelectChapter(id, 'learn')}
                      className="rounded-lg border border-neutral-200 px-3 py-1.5 font-semibold text-[#1B6B46] dark:border-neutral-700 dark:text-[#6CD19B]"
                    >
                      G{found.grade} · {found.title}
                    </button>
                  );
                })}
              </div>
            )}

            <div className="divide-y divide-neutral-200 dark:divide-neutral-800">
              {trackAttempts.length === 0 ? (
                <p className="py-4 text-neutral-500">
                  No practice attempts recorded in this track yet.
                </p>
              ) : (
                trackAttempts.slice(0, 8).map((att) => (
                  <div key={att.id} className="flex items-center justify-between py-2">
                    <div>
                      <div className="font-semibold text-neutral-900 dark:text-neutral-100">
                        {att.subjectName} — {att.conceptTitle}
                      </div>
                      <div className="font-mono-tabular text-[11px] text-neutral-500">
                        {new Date(att.timestamp).toLocaleString()}
                      </div>
                    </div>
                    <span
                      className={`font-semibold ${
                        att.isCorrect
                          ? 'text-[#1E7E4E] dark:text-[#6CD19B]'
                          : 'text-[#B9382C] dark:text-[#F28B82]'
                      }`}
                    >
                      {att.isCorrect ? 'Correct' : 'Review'}
                    </span>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}
      </MotionScreenSwap>

      <WhatsAppShareModal card={shareCard} onClose={() => setShareCard(null)} />
    </div>
  );
}
