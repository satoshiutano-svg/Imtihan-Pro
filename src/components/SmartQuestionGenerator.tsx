import { useState } from 'react';
import {
  AlertTriangle,
  Check,
  CheckCircle2,
  Loader2,
  Sparkles,
  Trash2,
} from 'lucide-react';
import type { CmsChapter, CmsQuestion, NumericalSteps } from '../types/cms';

interface GeneratedDraftItem {
  localId: string;
  selected: boolean;
  questionType: 'mcq' | 'numerical' | 'short_answer' | 'long_answer';
  difficulty: 1 | 2 | 3 | 4 | 5 | 6 | 7;
  statement: string;
  options: string[];
  optionMisconceptions: Record<string, string>;
  hints: string[];
  numericalSteps?: NumericalSteps;
  markingPoints: string[];
  correctAnswer: string;
  explanation: string;
  marks: number;
  sourcePageRef: string;
}

interface SmartQuestionGeneratorProps {
  chapter: CmsChapter;
  onAddQuestionsToChapter: (chapterId: string, questions: CmsQuestion[]) => void;
}

const SAMPLE_EXTRACTS: { label: string; text: string }[] = [
  {
    label: 'Physics G9 Extract',
    text: `Equations of Uniformly Accelerated Motion (KPECTB Physics Grade 9):
For a body moving along a straight line with initial velocity vi, final velocity vf, uniform acceleration a, time t, and distance S:
1st Equation: vf = vi + a*t
2nd Equation: S = vi*t + 1/2 a*t^2
3rd Equation: 2*a*S = vf^2 - vi^2
Note: Acceleration due to gravity near Earth is g = 9.8 m/s^2 (or 10 m/s^2 for quick board approximations). When a body starts from rest, vi = 0 m/s. When a body comes to rest after applying brakes, vf = 0 m/s and acceleration is negative (retardation).`,
  },
  {
    label: 'Chemistry G10 Extract',
    text: `Law of Mass Action & Equilibrium Constant Kc (KPECTB Chemistry Grade 10):
At a given temperature, the rate of a chemical reaction is directly proportional to the product of active masses (molar concentrations in mol/dm^3) of the reacting substances raised to their stoichiometric coefficients.
For a reversible reaction aA + bB <-> cC + dD in a closed vessel:
Kc = ([C]^c * [D]^d) / ([A]^a * [B]^b).
If moles of reactants equal moles of products (such as H2 + I2 <-> 2HI), Kc has NO units. If moles differ (such as N2 + 3H2 <-> 2NH3), Kc has units of dm^6/mol^2.`,
  },
];

export function SmartQuestionGenerator({
  chapter,
  onAddQuestionsToChapter,
}: SmartQuestionGeneratorProps) {
  const [extractText, setExtractText] = useState(SAMPLE_EXTRACTS[0].text);
  const [mcqCount, setMcqCount] = useState<number>(2);
  const [numericalCount, setNumericalCount] = useState<number>(1);
  const [writtenCount, setWrittenCount] = useState<number>(1);
  const [difficultyMin, setDifficultyMin] = useState<number>(2);
  const [difficultyMax, setDifficultyMax] = useState<number>(6);
  const [reviewerName, setReviewerName] = useState<string>('');

  const [isGenerating, setIsGenerating] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string>('');
  const [summaryNote, setSummaryNote] = useState<string>('');
  const [drafts, setDrafts] = useState<GeneratedDraftItem[]>([]);
  const [savedBanner, setSavedBanner] = useState<string>('');

  const handleGenerate = async () => {
    setErrorMessage('');
    setSavedBanner('');

    if (extractText.trim().length < 40) {
      setErrorMessage(
        'Please paste at least 40 characters from the KPECTB textbook before generating questions.',
      );
      return;
    }
    if (mcqCount + numericalCount + writtenCount < 1) {
      setErrorMessage('Select at least 1 question across MCQ, 6-Step Numerical, or Marking Scheme.');
      return;
    }

    setIsGenerating(true);
    try {
      const response = await fetch('/api/admin/generate-questions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          grade: chapter.grade,
          subjectName: chapter.subjectName,
          chapterTitle: chapter.title,
          extractText,
          mcqCount,
          numericalCount,
          writtenCount,
          difficultyMin,
          difficultyMax: Math.max(difficultyMin, difficultyMax),
        }),
      });

      const payload = (await response.json()) as {
        message?: string;
        summaryNote?: string;
        questions?: Omit<GeneratedDraftItem, 'localId' | 'selected'>[];
      };

      if (!response.ok) {
        setErrorMessage(
          payload.message || 'Question generation failed. Your textbook extract has been preserved.',
        );
        return;
      }

      const incoming = (payload.questions ?? []).map((item, idx) => ({
        ...item,
        localId: `gen_${Date.now()}_${idx}`,
        selected: true,
      }));

      setSummaryNote(payload.summaryNote ?? '');
      setDrafts(incoming);
    } catch {
      setErrorMessage(
        'Network error calling Smart Question Generator. Check that the server is running and retry.',
      );
    } finally {
      setIsGenerating(false);
    }
  };

  const updateDraft = (
    localId: string,
    updater: (item: GeneratedDraftItem) => GeneratedDraftItem,
  ) => {
    setDrafts((prev) => prev.map((d) => (d.localId === localId ? updater(d) : d)));
  };

  const handleSaveSelectedToChapter = () => {
    const selected = drafts.filter((d) => d.selected && d.statement.trim() && d.correctAnswer.trim());
    if (selected.length === 0) return;

    const cleanReviewer = reviewerName.trim();
    const mapped: CmsQuestion[] = selected.map((d, idx) => ({
      id: `q_ai_${chapter.chapterId}_${Date.now()}_${idx}`,
      programmeId: 'ssc_hssc',
      grade: chapter.grade,
      groupId: chapter.groupId,
      subjectId: chapter.subjectId,
      chapterId: chapter.chapterId,
      topicId: `${chapter.chapterId}_t1`,
      conceptId: chapter.concepts[0]?.id ?? '',
      questionType: d.questionType,
      difficulty: d.difficulty,
      statement: d.statement.trim(),
      options: d.questionType === 'mcq' ? d.options.filter(Boolean) : [],
      optionMisconceptions: d.optionMisconceptions,
      hints: d.hints.filter(Boolean),
      numericalSteps: d.numericalSteps,
      markingPoints: d.markingPoints.filter(Boolean),
      correctAnswer: d.correctAnswer.trim(),
      explanation: d.explanation.trim(),
      marks: d.marks,
      sourceType: 'practice_original',
      sourcePageRef: d.sourcePageRef || `Ch. ${chapter.chapterNumber}`,
      origin: cleanReviewer ? 'ai_reviewed' : 'ai_generated_draft',
      publicationStatus: cleanReviewer ? 'approved' : 'in_review',
      reviewedBy: cleanReviewer,
    }));

    onAddQuestionsToChapter(chapter.chapterId, mapped);
    setSavedBanner(
      `Added ${mapped.length} ready-made question(s) to "${chapter.title}" (${cleanReviewer ? 'reviewer signed off' : 'tagged AI Draft for review'}). Students study offline at $0 AI cost.`,
    );
    setDrafts((prev) => prev.filter((d) => !d.selected));
  };

  const selectedCount = drafts.filter((d) => d.selected).length;

  return (
    <div className="space-y-5">
      <div className="rounded-xl border border-neutral-200 bg-white p-5 dark:border-neutral-800 dark:bg-neutral-900">
        <div className="flex flex-wrap items-start justify-between gap-4 border-b border-neutral-200 pb-4 dark:border-neutral-800">
          <div>
            <p className="text-xs text-neutral-500 dark:text-neutral-400">
              KPK BISE {chapter.grade <= 10 ? `SSC Grade ${chapter.grade}` : `HSSC Grade ${chapter.grade}`} · {chapter.subjectName} · Server-Side Ready-Made Cloud Pack Authoring
            </p>
            <h3 className="font-display mt-0.5 text-base font-bold text-neutral-900 dark:text-neutral-100">
              Smart Question Generator
            </h3>
          </div>

          <div className="flex flex-wrap gap-2">
            {SAMPLE_EXTRACTS.map((sample) => (
              <button
                key={sample.label}
                type="button"
                onClick={() => setExtractText(sample.text)}
                className="shrink-0 whitespace-nowrap rounded-lg border border-neutral-200 px-3 py-1.5 text-xs font-medium text-neutral-700 hover:bg-neutral-50 dark:border-neutral-700 dark:text-neutral-200 dark:hover:bg-neutral-800"
              >
                {sample.label}
              </button>
            ))}
          </div>
        </div>

        <div className="mt-4 space-y-4">
          <div>
            <div className="mb-1.5 flex items-center justify-between text-xs">
              <label htmlFor="ai-extract-input" className="font-semibold text-neutral-800 dark:text-neutral-200">
                Textbook Extract (KPECTB English Medium)
              </label>
              <span className="font-mono-tabular text-neutral-500 dark:text-neutral-400">
                {extractText.trim().length} / 15,000 chars
              </span>
            </div>
            <textarea
              id="ai-extract-input"
              rows={6}
              value={extractText}
              onChange={(e) => setExtractText(e.target.value)}
              placeholder="Paste a topic, definitions, formulas, or worked example from your Grade 9–12 textbook..."
              className="w-full rounded-lg border border-neutral-200 bg-neutral-50 p-3 text-xs leading-relaxed text-neutral-900 focus:border-[#1B6B46] focus:outline-none dark:border-neutral-700 dark:bg-neutral-950 dark:text-neutral-100"
            />
          </div>

          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
            <div>
              <label className="mb-1 block text-xs font-medium text-neutral-700 dark:text-neutral-300">
                MCQs (with Misconceptions)
              </label>
              <input
                type="number"
                min={0}
                max={8}
                value={mcqCount}
                onChange={(e) => setMcqCount(Math.max(0, Math.min(8, Number(e.target.value))))}
                className="font-mono-tabular w-full rounded-lg border border-neutral-200 bg-white px-3 py-2 text-xs dark:border-neutral-700 dark:bg-neutral-800"
              />
            </div>

            <div>
              <label className="mb-1 block text-xs font-medium text-neutral-700 dark:text-neutral-300">
                6-Step Numericals
              </label>
              <input
                type="number"
                min={0}
                max={5}
                value={numericalCount}
                onChange={(e) => setNumericalCount(Math.max(0, Math.min(5, Number(e.target.value))))}
                className="font-mono-tabular w-full rounded-lg border border-neutral-200 bg-white px-3 py-2 text-xs dark:border-neutral-700 dark:bg-neutral-800"
              />
            </div>

            <div>
              <label className="mb-1 block text-xs font-medium text-neutral-700 dark:text-neutral-300">
                Marking-Scheme Qs
              </label>
              <input
                type="number"
                min={0}
                max={5}
                value={writtenCount}
                onChange={(e) => setWrittenCount(Math.max(0, Math.min(5, Number(e.target.value))))}
                className="font-mono-tabular w-full rounded-lg border border-neutral-200 bg-white px-3 py-2 text-xs dark:border-neutral-700 dark:bg-neutral-800"
              />
            </div>

            <div>
              <label className="mb-1 block text-xs font-medium text-neutral-700 dark:text-neutral-300">
                Min Level (1–7)
              </label>
              <select
                value={difficultyMin}
                onChange={(e) => setDifficultyMin(Number(e.target.value))}
                className="w-full rounded-lg border border-neutral-200 bg-white px-2.5 py-2 text-xs dark:border-neutral-700 dark:bg-neutral-800"
              >
                {[1, 2, 3, 4, 5, 6, 7].map((lvl) => (
                  <option key={lvl} value={lvl}>
                    Level {lvl}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="mb-1 block text-xs font-medium text-neutral-700 dark:text-neutral-300">
                Max Level (1–7)
              </label>
              <select
                value={Math.max(difficultyMin, difficultyMax)}
                onChange={(e) => setDifficultyMax(Number(e.target.value))}
                className="w-full rounded-lg border border-neutral-200 bg-white px-2.5 py-2 text-xs dark:border-neutral-700 dark:bg-neutral-800"
              >
                {[1, 2, 3, 4, 5, 6, 7]
                  .filter((lvl) => lvl >= difficultyMin)
                  .map((lvl) => (
                    <option key={lvl} value={lvl}>
                      Level {lvl}
                    </option>
                  ))}
              </select>
            </div>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
            <p className="text-xs text-neutral-500 dark:text-neutral-400">
              Generates once into cloud drafts · Students read offline at $0 AI cost · KPK BISE SSC/HSSC pattern only
            </p>

            <button
              type="button"
              disabled={isGenerating}
              onClick={handleGenerate}
              className="inline-flex shrink-0 items-center gap-2 whitespace-nowrap rounded-lg bg-[#1B6B46] px-4 py-2 text-xs font-semibold text-white hover:bg-[#155537] disabled:opacity-60"
            >
              {isGenerating ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Generating KPK BISE Drafts...
                </>
              ) : (
                <>
                  <Sparkles className="h-4 w-4" />
                  Generate Draft Questions
                </>
              )}
            </button>
          </div>

          {errorMessage && (
            <div className="flex items-start gap-2 rounded-lg border border-[#B9382C]/40 bg-[#B9382C]/10 p-3 text-xs text-[#B9382C] dark:text-[#F28B82]">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
              <span>{errorMessage}</span>
            </div>
          )}

          {savedBanner && (
            <div className="flex items-start gap-2 rounded-lg bg-[#1E7E4E]/10 p-3 text-xs font-medium text-[#1E7E4E] dark:text-[#6CD19B]">
              <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" />
              <span>{savedBanner}</span>
            </div>
          )}
        </div>
      </div>

      {/* Review & Edit Generated Drafts */}
      {drafts.length > 0 && (
        <div className="space-y-4 rounded-xl border border-neutral-200 bg-white p-5 dark:border-neutral-800 dark:bg-neutral-900">
          <div className="flex flex-wrap items-center justify-between gap-4 border-b border-neutral-200 pb-4 dark:border-neutral-800">
            <div>
              <h4 className="font-display text-sm font-bold text-neutral-900 dark:text-neutral-100">
                Generated Draft Review ({drafts.length})
              </h4>
              {summaryNote && (
                <p className="mt-0.5 text-xs text-neutral-500 dark:text-neutral-400">
                  {summaryNote}
                </p>
              )}
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <input
                value={reviewerName}
                onChange={(e) => setReviewerName(e.target.value)}
                placeholder="Reviewer sign-off (optional)"
                className="rounded-lg border border-neutral-200 bg-white px-3 py-1.5 text-xs dark:border-neutral-700 dark:bg-neutral-800"
              />
              <button
                type="button"
                disabled={selectedCount === 0}
                onClick={handleSaveSelectedToChapter}
                className="inline-flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-lg bg-[#1B6B46] px-4 py-2 text-xs font-semibold text-white hover:bg-[#155537] disabled:opacity-50"
              >
                <Check className="h-3.5 w-3.5" />
                Save {selectedCount} to Chapter Pack
              </button>
            </div>
          </div>

          <div className="divide-y divide-neutral-200 dark:divide-neutral-800">
            {drafts.map((item, index) => (
              <div key={item.localId} className="space-y-3 py-4 first:pt-1 last:pb-1">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <label className="flex cursor-pointer items-center gap-2 text-xs font-semibold text-neutral-800 dark:text-neutral-200">
                    <input
                      type="checkbox"
                      checked={item.selected}
                      onChange={(e) =>
                        updateDraft(item.localId, (d) => ({ ...d, selected: e.target.checked }))
                      }
                      className="accent-[#1B6B46]"
                    />
                    <span>
                      Draft {index + 1} · {item.questionType.replace('_', ' ')} · Level {item.difficulty} ·{' '}
                      <span className="font-mono-tabular">{item.marks} marks</span> · Review Required
                    </span>
                  </label>

                  <button
                    type="button"
                    onClick={() =>
                      setDrafts((prev) => prev.filter((d) => d.localId !== item.localId))
                    }
                    className="inline-flex items-center gap-1 text-xs text-neutral-500 hover:text-[#B9382C]"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                    Discard
                  </button>
                </div>

                <textarea
                  rows={2}
                  value={item.statement}
                  onChange={(e) =>
                    updateDraft(item.localId, (d) => ({ ...d, statement: e.target.value }))
                  }
                  className="w-full rounded-lg border border-neutral-200 bg-neutral-50 px-3 py-2 text-xs font-medium text-neutral-900 dark:border-neutral-700 dark:bg-neutral-950 dark:text-neutral-100"
                />

                {item.questionType === 'mcq' && (
                  <div className="grid gap-2 sm:grid-cols-2">
                    {item.options.map((opt, optIdx) => (
                      <div key={optIdx} className="flex items-center gap-2 text-xs">
                        <input
                          type="radio"
                          name={`correct_${item.localId}`}
                          checked={item.correctAnswer === opt}
                          onChange={() =>
                            updateDraft(item.localId, (d) => ({ ...d, correctAnswer: opt }))
                          }
                          className="accent-[#1B6B46]"
                        />
                        <input
                          value={opt}
                          onChange={(e) => {
                            const val = e.target.value;
                            updateDraft(item.localId, (d) => {
                              const nextOpts = [...d.options];
                              const wasCorrect = d.correctAnswer === d.options[optIdx];
                              nextOpts[optIdx] = val;
                              return {
                                ...d,
                                options: nextOpts,
                                correctAnswer: wasCorrect ? val : d.correctAnswer,
                              };
                            });
                          }}
                          className="w-full rounded border border-neutral-200 bg-white px-2.5 py-1.5 text-xs dark:border-neutral-700 dark:bg-neutral-800"
                        />
                      </div>
                    ))}
                  </div>
                )}

                {item.numericalSteps && (
                  <div className="grid gap-2 text-xs sm:grid-cols-2">
                    <input
                      value={item.numericalSteps.given.join(', ')}
                      onChange={(e) =>
                        updateDraft(item.localId, (d) => ({
                          ...d,
                          numericalSteps: d.numericalSteps
                            ? {
                                ...d.numericalSteps,
                                given: e.target.value.split(',').map((s) => s.trim()),
                              }
                            : undefined,
                        }))
                      }
                      placeholder="Given"
                      className="rounded border border-neutral-200 bg-white px-2.5 py-1.5 dark:border-neutral-700 dark:bg-neutral-800"
                    />
                    <input
                      value={item.numericalSteps.required}
                      onChange={(e) =>
                        updateDraft(item.localId, (d) => ({
                          ...d,
                          numericalSteps: d.numericalSteps
                            ? { ...d.numericalSteps, required: e.target.value }
                            : undefined,
                        }))
                      }
                      placeholder="Required"
                      className="rounded border border-neutral-200 bg-white px-2.5 py-1.5 dark:border-neutral-700 dark:bg-neutral-800"
                    />
                    <input
                      value={item.numericalSteps.formula}
                      onChange={(e) =>
                        updateDraft(item.localId, (d) => ({
                          ...d,
                          numericalSteps: d.numericalSteps
                            ? { ...d.numericalSteps, formula: e.target.value }
                            : undefined,
                        }))
                      }
                      placeholder="Formula"
                      className="font-mono-tabular rounded border border-neutral-200 bg-white px-2.5 py-1.5 dark:border-neutral-700 dark:bg-neutral-800"
                    />
                    <input
                      value={item.numericalSteps.substitution}
                      onChange={(e) =>
                        updateDraft(item.localId, (d) => ({
                          ...d,
                          numericalSteps: d.numericalSteps
                            ? { ...d.numericalSteps, substitution: e.target.value }
                            : undefined,
                        }))
                      }
                      placeholder="Substitution"
                      className="font-mono-tabular rounded border border-neutral-200 bg-white px-2.5 py-1.5 dark:border-neutral-700 dark:bg-neutral-800"
                    />
                    <input
                      value={item.numericalSteps.calculation}
                      onChange={(e) =>
                        updateDraft(item.localId, (d) => ({
                          ...d,
                          numericalSteps: d.numericalSteps
                            ? { ...d.numericalSteps, calculation: e.target.value }
                            : undefined,
                        }))
                      }
                      placeholder="Calculation"
                      className="font-mono-tabular rounded border border-neutral-200 bg-white px-2.5 py-1.5 dark:border-neutral-700 dark:bg-neutral-800"
                    />
                    <input
                      value={item.numericalSteps.answerWithUnit}
                      onChange={(e) =>
                        updateDraft(item.localId, (d) => ({
                          ...d,
                          correctAnswer: e.target.value,
                          numericalSteps: d.numericalSteps
                            ? { ...d.numericalSteps, answerWithUnit: e.target.value }
                            : undefined,
                        }))
                      }
                      placeholder="Answer with unit"
                      className="font-mono-tabular rounded border border-neutral-200 bg-white px-2.5 py-1.5 font-semibold dark:border-neutral-700 dark:bg-neutral-800"
                    />
                  </div>
                )}

                {item.markingPoints.length > 0 && (
                  <div className="space-y-1 text-xs text-neutral-700 dark:text-neutral-300">
                    <div className="font-semibold">KPK Board Marking Scheme:</div>
                    <ul className="list-disc space-y-0.5 pl-4">
                      {item.markingPoints.map((pt, i) => (
                        <li key={i}>{pt}</li>
                      ))}
                    </ul>
                  </div>
                )}

                {item.hints.length > 0 && (
                  <div className="text-xs text-neutral-500 dark:text-neutral-400">
                    Hints: {item.hints.join(' · ')}
                  </div>
                )}

                <div className="text-xs text-neutral-600 dark:text-neutral-300">
                  <strong>Explanation:</strong> {item.explanation}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
