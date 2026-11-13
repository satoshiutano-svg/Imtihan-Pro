import { useMemo, useState } from 'react';
import { BarChart3, Calculator, Trash2 } from 'lucide-react';
import type { CmsChapter, SandboxAttemptRecord } from '../types/cms';

interface AnalyticsViewProps {
  chapters: CmsChapter[];
  attempts: SandboxAttemptRecord[];
  onClearAttempts: () => void;
}

export function AnalyticsView({
  chapters,
  attempts,
  onClearAttempts,
}: AnalyticsViewProps) {
  // Interactive 10k DAU & Cloudflare Free-Tier Planner state
  const [dau, setDau] = useState<number>(10000);
  const [sessionsPerDay, setSessionsPerDay] = useState<number>(2);
  const [ecpmUsd, setEcpmUsd] = useState<number>(0.45);

  const stats = useMemo(() => {
    const published = chapters.filter((c) => c.publicationStatus === 'published').length;
    const totalConcepts = chapters.reduce((acc, c) => acc + c.concepts.length, 0);
    const allQuestions = chapters.flatMap((c) => c.questions);
    const officialQs = allQuestions.filter((q) => q.sourceType !== 'practice_original').length;
    const aiDrafts = allQuestions.filter((q) => q.origin === 'ai_generated_draft').length;
    const aiReviewed = allQuestions.filter((q) => q.origin === 'ai_reviewed').length;

    const boardAttempts = attempts.filter((a) => (a.programmeId ?? 'ssc_hssc') === 'ssc_hssc');
    const mdcatAttempts = attempts.filter((a) => a.programmeId === 'mdcat');
    const correctBoardAttempts = boardAttempts.filter((a) => a.isCorrect).length;
    const accuracyPct =
      boardAttempts.length === 0
        ? null
        : Math.round((correctBoardAttempts / boardAttempts.length) * 100);

    const byGrade = ([9, 10, 11, 12] as const).map((g) => {
      const gradeChapters = chapters.filter((c) => c.grade === g);
      return {
        grade: g,
        chapters: gradeChapters.length,
        concepts: gradeChapters.reduce((a, c) => a + c.concepts.length, 0),
        questions: gradeChapters.reduce((a, c) => a + c.questions.length, 0),
      };
    });

    return {
      published,
      totalConcepts,
      totalQuestions: allQuestions.length,
      officialQs,
      aiDrafts,
      aiReviewed,
      boardAttemptsCount: boardAttempts.length,
      mdcatAttemptsCount: mdcatAttempts.length,
      accuracyPct,
      byGrade,
    };
  }, [chapters, attempts]);

  // Transparent planning calculations (2 impressions per online session assumption, 50% online rate)
  const safeDau = Number.isFinite(dau) ? Math.max(0, dau) : 10000;
  const safeSessions = Number.isFinite(sessionsPerDay) ? Math.max(1, sessionsPerDay) : 2;
  const safeEcpm = Number.isFinite(ecpmUsd) ? Math.max(0, ecpmUsd) : 0.45;
  const onlineShare = 0.5;
  const impressionsPerSession = 2.5;
  const dailyImpressions = Math.round(safeDau * onlineShare * safeSessions * impressionsPerSession);
  const estDailyUsd = (dailyImpressions / 1000) * safeEcpm;
  const estMonthlyUsd = estDailyUsd * 30;
  // Cloudflare Free Tier: 100k D1 writes/day; local-first keeps daily D1 writes near 0
  const estDailyD1WritesLocalFirst = Math.round(safeDau * 0.05); // e.g. optional daily summary sync only

  return (
    <div className="space-y-6">
      {/* Real Content & Sandbox KPIs */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-xl border border-neutral-200 bg-white p-5 dark:border-neutral-800 dark:bg-neutral-900">
          <div className="text-xs text-neutral-500 dark:text-neutral-400">Chapters Ready</div>
          <div className="font-mono-tabular mt-1 text-2xl font-bold text-neutral-900 dark:text-neutral-100">
            {stats.published} / {chapters.length}
          </div>
          <div className="mt-1 text-xs text-neutral-500 dark:text-neutral-400">
            Published vs total drafts
          </div>
        </div>

        <div className="rounded-xl border border-neutral-200 bg-white p-5 dark:border-neutral-800 dark:bg-neutral-900">
          <div className="text-xs text-neutral-500 dark:text-neutral-400">Ready-Made Cloud Qs</div>
          <div className="font-mono-tabular mt-1 text-2xl font-bold text-neutral-900 dark:text-neutral-100">
            {stats.totalConcepts} · {stats.totalQuestions}
          </div>
          <div className="mt-1 text-xs text-neutral-500 dark:text-neutral-400">
            {stats.officialQs} model/past · {stats.aiReviewed} AI-approved · {stats.aiDrafts} AI drafts
          </div>
        </div>

        <div className="rounded-xl border border-neutral-200 bg-white p-5 dark:border-neutral-800 dark:bg-neutral-900">
          <div className="text-xs text-neutral-500 dark:text-neutral-400">Student Preview Attempts</div>
          <div className="font-mono-tabular mt-1 text-2xl font-bold text-neutral-900 dark:text-neutral-100">
            {stats.boardAttemptsCount} · {stats.mdcatAttemptsCount}
          </div>
          <div className="mt-1 text-xs text-neutral-500 dark:text-neutral-400">
            SSC/HSSC board · Isolated MDCAT
          </div>
        </div>

        <div className="rounded-xl border border-neutral-200 bg-white p-5 dark:border-neutral-800 dark:bg-neutral-900">
          <div className="text-xs text-neutral-500 dark:text-neutral-400">Verified Board Accuracy</div>
          <div className="font-mono-tabular mt-1 text-2xl font-bold text-[#1B6B46] dark:text-[#6CD19B]">
            {stats.accuracyPct === null ? '—' : `${stats.accuracyPct}%`}
          </div>
          <div className="mt-1 text-xs text-neutral-500 dark:text-neutral-400">
            $0/student AI runtime cost (ready-made packs)
          </div>
        </div>
      </div>

      {/* Coverage by Grade + Sandbox Log */}
      <div className="grid gap-6 lg:grid-cols-2">
        <div className="rounded-xl border border-neutral-200 bg-white p-6 dark:border-neutral-800 dark:bg-neutral-900">
          <h3 className="flex items-center gap-2 text-sm font-bold text-neutral-900 dark:text-neutral-100">
            <BarChart3 className="h-4 w-4 text-[#1B6B46] dark:text-[#6CD19B]" />
            Grades 9–12 English-Medium Coverage
          </h3>
          <table className="mt-4 w-full border-collapse text-left text-xs">
            <thead>
              <tr className="border-b border-neutral-200 text-neutral-500 dark:border-neutral-800">
                <th className="py-2">Grade</th>
                <th className="py-2 text-right">Chapters</th>
                <th className="py-2 text-right">Concepts</th>
                <th className="py-2 text-right">Questions</th>
              </tr>
            </thead>
            <tbody>
              {stats.byGrade.map((row) => (
                <tr
                  key={row.grade}
                  className="border-b border-neutral-100 dark:border-neutral-800/70"
                >
                  <td className="py-2.5 font-medium">Grade {row.grade}</td>
                  <td className="font-mono-tabular py-2.5 text-right">{row.chapters}</td>
                  <td className="font-mono-tabular py-2.5 text-right">{row.concepts}</td>
                  <td className="font-mono-tabular py-2.5 text-right">{row.questions}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="rounded-xl border border-neutral-200 bg-white p-6 dark:border-neutral-800 dark:bg-neutral-900">
          <div className="flex items-center justify-between gap-2">
            <h3 className="text-sm font-bold text-neutral-900 dark:text-neutral-100">
              Recent Student Preview Attempts
            </h3>
            {attempts.length > 0 && (
              <button
                type="button"
                onClick={onClearAttempts}
                className="inline-flex items-center gap-1 text-xs text-neutral-500 hover:text-[#B9382C]"
              >
                <Trash2 className="h-3.5 w-3.5" />
                Reset Log
              </button>
            )}
          </div>
          {attempts.length === 0 ? (
            <p className="mt-4 text-xs text-neutral-500 dark:text-neutral-400">
              No practice attempts recorded yet. Open Student Preview → Practice to test real attempt logging and accuracy tracking.
            </p>
          ) : (
            <div className="mt-3 max-h-52 space-y-2 overflow-y-auto text-xs">
              {attempts.slice(0, 12).map((a) => (
                <div
                  key={a.id}
                  className="flex items-center justify-between border-b border-neutral-100 pb-2 dark:border-neutral-800"
                >
                  <div>
                    <div className="font-medium text-neutral-900 dark:text-neutral-100">
                      {a.conceptTitle}
                    </div>
                    <div className="text-neutral-500 dark:text-neutral-400">
                      {a.subjectName} · Level {a.difficulty}
                    </div>
                  </div>
                  <span
                    className={`font-semibold ${
                      a.isCorrect
                        ? 'text-[#1E7E4E] dark:text-[#6CD19B]'
                        : 'text-[#B9382C] dark:text-[#F28B82]'
                    }`}
                  >
                    {a.isCorrect ? 'Correct' : 'Needs Revision'}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Transparent 10k DAU Ad-Revenue & Cloudflare Free-Tier Planner */}
      <div className="rounded-xl border border-neutral-200 bg-white p-6 dark:border-neutral-800 dark:bg-neutral-900">
        <h3 className="flex items-center gap-2 text-sm font-bold text-neutral-900 dark:text-neutral-100">
          <Calculator className="h-4 w-4 text-[#1B6B46] dark:text-[#6CD19B]" />
          10k DAU AdMob Revenue & Cloudflare Free-Tier Planner (Estimator)
        </h3>
        <p className="mt-1 text-xs text-neutral-500 dark:text-neutral-400">
          Adjust assumptions below to model Pakistani education eCPM and verify server costs stay $0/month. Estimates assume 50% of daily users study while connected to internet.
        </p>

        <div className="mt-4 grid gap-4 md:grid-cols-3">
          <div>
            <label className="flex justify-between text-xs font-medium">
              <span>Daily Active Students</span>
              <span className="font-mono-tabular">{dau.toLocaleString()}</span>
            </label>
            <input
              type="range"
              min={1000}
              max={50000}
              step={1000}
              value={safeDau}
              onChange={(e) => {
                const next = Number(e.target.value);
                if (Number.isFinite(next)) setDau(next);
              }}
              className="mt-2 w-full accent-[#1B6B46]"
            />
          </div>

          <div>
            <label className="flex justify-between text-xs font-medium">
              <span>Sessions / Student / Day</span>
              <span className="font-mono-tabular">{safeSessions}</span>
            </label>
            <input
              type="range"
              min={1}
              max={5}
              step={1}
              value={safeSessions}
              onChange={(e) => {
                const next = Number(e.target.value);
                if (Number.isFinite(next)) setSessionsPerDay(next);
              }}
              className="mt-2 w-full accent-[#1B6B46]"
            />
          </div>

          <div>
            <label className="flex justify-between text-xs font-medium">
              <span>Blended Pakistan eCPM (USD)</span>
              <span className="font-mono-tabular">${safeEcpm.toFixed(2)}</span>
            </label>
            <input
              type="range"
              min={0.15}
              max={1.5}
              step={0.05}
              value={safeEcpm}
              onChange={(e) => {
                const next = Number(e.target.value);
                if (Number.isFinite(next)) setEcpmUsd(next);
              }}
              className="mt-2 w-full accent-[#1B6B46]"
            />
          </div>
        </div>

        <div className="mt-5 grid gap-4 border-t border-neutral-200 pt-4 sm:grid-cols-3 dark:border-neutral-800">
          <div>
            <div className="text-xs text-neutral-500 dark:text-neutral-400">
              Est. Monthly AdMob Gross
            </div>
            <div className="font-mono-tabular text-xl font-bold text-[#1B6B46] dark:text-[#6CD19B]">
              ${estMonthlyUsd.toFixed(0)} / mo
            </div>
            <div className="text-xs text-neutral-500">
              ~{dailyImpressions.toLocaleString()} impressions/day
            </div>
          </div>

          <div>
            <div className="text-xs text-neutral-500 dark:text-neutral-400">
              Cloudflare R2 Bandwidth Bill
            </div>
            <div className="font-mono-tabular text-xl font-bold text-neutral-900 dark:text-neutral-100">
              $0 / mo
            </div>
            <div className="text-xs text-neutral-500">
              R2 has zero egress fees for pack downloads
            </div>
          </div>

          <div>
            <div className="text-xs text-neutral-500 dark:text-neutral-400">
              D1 Daily Write Budget Used
            </div>
            <div className="font-mono-tabular text-xl font-bold text-neutral-900 dark:text-neutral-100">
              {estDailyD1WritesLocalFirst.toLocaleString()} / 100,000
            </div>
            <div className="text-xs text-neutral-500">
              Local-first storage protects free-tier quota
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
