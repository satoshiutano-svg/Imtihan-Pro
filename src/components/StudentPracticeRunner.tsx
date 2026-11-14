import { useEffect, useState } from 'react';
import {
  CheckCircle2,
  Lightbulb,
  MessageCircle,
  RotateCcw,
  XCircle,
} from 'lucide-react';
import type { CmsChapter, CmsQuestion } from '../types/cms';
import { isAnswerMatch } from '../utils/answerMatch';
import { MathText } from './MathText';
import { MotionCollapse, MotionQuizFeedback } from './MotionSystem';
import type { ShareCardPayload } from './WhatsAppShareModal';

interface StudentPracticeRunnerProps {
  chapter: CmsChapter;
  questions: CmsQuestion[];
  board: string;
  initialQuestionIndex?: number;
  onAttemptRecorded: (question: CmsQuestion, isCorrect: boolean) => void;
  onCompleteSession: () => void;
  onShareCard: (card: ShareCardPayload) => void;
}

export function StudentPracticeRunner({
  chapter,
  questions,
  board,
  initialQuestionIndex = 0,
  onAttemptRecorded,
  onCompleteSession,
  onShareCard,
}: StudentPracticeRunnerProps) {
  const [qIndex, setQIndex] = useState(initialQuestionIndex);
  const [hintsShown, setHintsShown] = useState(0);
  const [selectedOption, setSelectedOption] = useState('');
  const [multiSelected, setMultiSelected] = useState<string[]>([]);
  const [typedAnswer, setTypedAnswer] = useState('');
  const [matchingLeftActive, setMatchingLeftActive] = useState<string | null>(null);
  const [matchingSelections, setMatchingSelections] = useState<Record<string, string>>({});
  const [checkedPoints, setCheckedPoints] = useState<number[]>([]);
  const [numericalRevealStep, setNumericalRevealStep] = useState(0);
  const [practiceError, setPracticeError] = useState('');
  const [submitted, setSubmitted] = useState(false);
  const [isCorrect, setIsCorrect] = useState(false);

  const resetInputs = (nextIdx = 0) => {
    setQIndex(nextIdx);
    setHintsShown(0);
    setSelectedOption('');
    setMultiSelected([]);
    setTypedAnswer('');
    setMatchingLeftActive(null);
    setMatchingSelections({});
    setCheckedPoints([]);
    setNumericalRevealStep(0);
    setPracticeError('');
    setSubmitted(false);
    setIsCorrect(false);
  };

  useEffect(() => {
    resetInputs(0);
  }, [chapter.chapterId, questions.length]);

  const currentQ = questions[qIndex];
  if (!currentQ) {
    return (
      <div className="py-8 text-center text-xs text-neutral-500 dark:text-neutral-400">
        No practice questions added to this chapter yet. Switch to Content &amp; Inbox or launch an
        autonomous agent job to generate questions.
      </div>
    );
  }

  const isSubjective =
    currentQ.questionType === 'short_answer' ||
    currentQ.questionType === 'long_answer' ||
    currentQ.questionType === 'conceptual' ||
    currentQ.questionType === 'diagram_based';

  const handleSubmit = () => {
    setPracticeError('');
    let ok = false;

    if (isSubjective) {
      const effectivePoints =
        currentQ.markingPoints.length > 0
          ? currentQ.markingPoints
          : ['My written answer matches the key points in the model answer above.'];
      const needed = Math.max(1, Math.ceil(effectivePoints.length / 2));
      ok = checkedPoints.length >= needed;
    } else if (currentQ.questionType === 'multi_select') {
      if (multiSelected.length === 0) {
        setPracticeError('Select one or more answer options before submitting.');
        return;
      }
      const expected =
        currentQ.multiSelectAnswers && currentQ.multiSelectAnswers.length > 0
          ? currentQ.multiSelectAnswers.join('||')
          : currentQ.correctAnswer;
      ok = isAnswerMatch(multiSelected.join('||'), expected, 'multi_select');
    } else if (currentQ.questionType === 'matching') {
      const pairs = currentQ.matchingPairs ?? [];
      if (pairs.length > 0) {
        const pickedCount = Object.keys(matchingSelections).length;
        if (pickedCount < pairs.length) {
          setPracticeError(`Match all ${pairs.length} item(s) before submitting.`);
          return;
        }
        ok = pairs.every(
          (pair) =>
            (matchingSelections[pair.left] ?? '').trim().toLowerCase() ===
            pair.right.trim().toLowerCase(),
        );
      } else {
        if (!typedAnswer.trim()) {
          setPracticeError('Enter your matching pairs before submitting.');
          return;
        }
        ok = isAnswerMatch(typedAnswer, currentQ.correctAnswer, 'matching');
      }
    } else if (currentQ.questionType === 'true_false') {
      if (!selectedOption) {
        setPracticeError('Choose True or False before submitting.');
        return;
      }
      ok = isAnswerMatch(selectedOption, currentQ.correctAnswer, 'true_false');
    } else {
      const raw = currentQ.options.length > 0 ? selectedOption : typedAnswer;
      if (!raw.trim()) {
        setPracticeError(
          currentQ.options.length > 0
            ? 'Please select an option before submitting.'
            : 'Please enter your answer before submitting.',
        );
        return;
      }
      ok = isAnswerMatch(raw, currentQ.correctAnswer, currentQ.questionType);
    }

    setSubmitted(true);
    setIsCorrect(ok);
    onAttemptRecorded(currentQ, ok);
  };

  const toggleMultiOption = (opt: string) => {
    setMultiSelected((prev) =>
      prev.includes(opt) ? prev.filter((item) => item !== opt) : [...prev, opt],
    );
  };

  const rightMatchingOptions =
    currentQ.matchingPairs && currentQ.matchingPairs.length > 0
      ? [...currentQ.matchingPairs]
          .map((p) => p.right)
          .sort((a, b) => a.localeCompare(b))
      : [];

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-neutral-200 pb-3 dark:border-neutral-800">
        <div className="text-xs text-neutral-500 dark:text-neutral-400">
          Question <span className="font-mono-tabular font-semibold">{qIndex + 1}</span> of{' '}
          <span className="font-mono-tabular">{questions.length}</span> ·{' '}
          {currentQ.questionType.replaceAll('_', ' ')} · Level {currentQ.difficulty} ·{' '}
          <span className="font-mono-tabular">{currentQ.marks}</span>{' '}
          {currentQ.marks === 1 ? 'mark' : 'marks'}
          {currentQ.sourceBoardId ? ` · ${currentQ.sourceBoardId}` : ''}
          {currentQ.sourceYear ? ` (${currentQ.sourceYear})` : ''}
        </div>

        <button
          type="button"
          onClick={() =>
            onShareCard({
              kicker: `${board} · Grade ${chapter.grade} ${chapter.subjectName}`,
              title: currentQ.statement,
              highlightMetric: `Answer: ${currentQ.correctAnswer}`,
              lines: currentQ.numericalSteps
                ? [
                    `Given: ${currentQ.numericalSteps.given.join(', ')}`,
                    `Formula: ${currentQ.numericalSteps.formula}`,
                    `Answer: ${currentQ.numericalSteps.answerWithUnit}`,
                  ]
                : [currentQ.explanation],
            })
          }
          className="inline-flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-lg border border-neutral-200 px-3 py-1 text-xs font-semibold text-[#1B6B46] dark:border-neutral-700 dark:text-[#6CD19B]"
        >
          <MessageCircle className="h-3.5 w-3.5" />
          Share Question
        </button>
      </div>

      {/* Statement */}
      <div className="text-base font-semibold leading-relaxed text-neutral-900 dark:text-neutral-100">
        <MathText text={currentQ.statement} />
      </div>

      {/* Format 1: Single-choice MCQ or Recall */}
      {(currentQ.questionType === 'mcq' ||
        currentQ.questionType === 'recall' ||
        currentQ.questionType === 'application') &&
        currentQ.options.length > 0 && (
          <div className="space-y-2">
            {currentQ.options.map((opt) => (
              <label
                key={opt}
                className={`flex cursor-pointer items-center gap-3 rounded-lg border px-4 py-3 text-sm transition ${
                  selectedOption === opt
                    ? 'border-[#1B6B46] bg-[#D6F0E1]/35 dark:border-[#6CD19B] dark:bg-[#174F33]/40'
                    : 'border-neutral-200 hover:bg-neutral-50 dark:border-neutral-700 dark:hover:bg-neutral-800'
                }`}
              >
                <input
                  type="radio"
                  name="practice_mcq"
                  disabled={submitted}
                  checked={selectedOption === opt}
                  onChange={() => setSelectedOption(opt)}
                  className="accent-[#1B6B46]"
                />
                <MathText text={opt} />
              </label>
            ))}
          </div>
        )}

      {/* Format 2: Multi-Select */}
      {currentQ.questionType === 'multi_select' && (
        <div className="space-y-2">
          <div className="text-xs font-semibold text-neutral-500 dark:text-neutral-400">
            Select all options that apply:
          </div>
          {currentQ.options.map((opt) => {
            const checked = multiSelected.includes(opt);
            return (
              <label
                key={opt}
                className={`flex cursor-pointer items-center gap-3 rounded-lg border px-4 py-3 text-sm transition ${
                  checked
                    ? 'border-[#1B6B46] bg-[#D6F0E1]/35 dark:border-[#6CD19B] dark:bg-[#174F33]/40'
                    : 'border-neutral-200 hover:bg-neutral-50 dark:border-neutral-700 dark:hover:bg-neutral-800'
                }`}
              >
                <input
                  type="checkbox"
                  disabled={submitted}
                  checked={checked}
                  onChange={() => toggleMultiOption(opt)}
                  className="accent-[#1B6B46]"
                />
                <MathText text={opt} />
              </label>
            );
          })}
        </div>
      )}

      {/* Format 3: True / False */}
      {currentQ.questionType === 'true_false' && (
        <div className="grid grid-cols-2 gap-3">
          {['True', 'False'].map((choice) => (
            <button
              key={choice}
              type="button"
              disabled={submitted}
              onClick={() => setSelectedOption(choice)}
              className={`rounded-lg border px-4 py-3 text-sm font-semibold transition ${
                selectedOption === choice
                  ? 'border-[#1B6B46] bg-[#D6F0E1]/40 text-[#1B6B46] dark:border-[#6CD19B] dark:bg-[#174F33]/50 dark:text-[#6CD19B]'
                  : 'border-neutral-200 hover:bg-neutral-50 dark:border-neutral-700 dark:hover:bg-neutral-800'
              }`}
            >
              {choice}
            </button>
          ))}
        </div>
      )}

      {/* Format 4: Interactive Matching */}
      {currentQ.questionType === 'matching' && (
        <div className="space-y-3">
          {currentQ.matchingPairs && currentQ.matchingPairs.length > 0 ? (
            <>
              <div className="text-xs text-neutral-500 dark:text-neutral-400">
                Tap a prompt on the left, then choose its matching value on the right.
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="space-y-2">
                  {currentQ.matchingPairs.map((pair) => (
                    <button
                      key={pair.left}
                      type="button"
                      disabled={submitted}
                      onClick={() => setMatchingLeftActive(pair.left)}
                      className={`flex w-full items-center justify-between rounded-lg border px-3 py-2.5 text-left text-xs font-semibold ${
                        matchingLeftActive === pair.left
                          ? 'border-[#1B6B46] bg-[#D6F0E1]/40 dark:border-[#6CD19B] dark:bg-[#174F33]/50'
                          : 'border-neutral-200 dark:border-neutral-700'
                      }`}
                    >
                      <MathText text={pair.left} />
                      {matchingSelections[pair.left] && (
                        <span className="font-normal text-[#1B6B46] dark:text-[#6CD19B]">
                          → {matchingSelections[pair.left]}
                        </span>
                      )}
                    </button>
                  ))}
                </div>
                <div className="space-y-2">
                  {rightMatchingOptions.map((rightOpt) => (
                    <button
                      key={rightOpt}
                      type="button"
                      disabled={submitted || !matchingLeftActive}
                      onClick={() => {
                        if (!matchingLeftActive) return;
                        setMatchingSelections((prev) => ({
                          ...prev,
                          [matchingLeftActive]: rightOpt,
                        }));
                        setMatchingLeftActive(null);
                      }}
                      className="w-full rounded-lg border border-neutral-200 bg-neutral-50 px-3 py-2.5 text-left text-xs font-medium hover:bg-neutral-100 disabled:opacity-60 dark:border-neutral-700 dark:bg-neutral-800"
                    >
                      <MathText text={rightOpt} />
                    </button>
                  ))}
                </div>
              </div>
            </>
          ) : (
            <input
              disabled={submitted}
              value={typedAnswer}
              onChange={(e) => setTypedAnswer(e.target.value)}
              placeholder="Enter matching pairs (e.g. A->1, B->2)"
              className="w-full rounded-lg border border-neutral-200 bg-white px-4 py-2.5 text-sm dark:border-neutral-700 dark:bg-neutral-800"
            />
          )}
        </div>
      )}

      {/* Format 5 & 6: Numerical (with 6-Step KPK Guided Reveal) or Fill-in */}
      {(currentQ.questionType === 'numerical' ||
        currentQ.questionType === 'fill_in' ||
        (!isSubjective &&
          currentQ.options.length === 0 &&
          currentQ.questionType !== 'true_false' &&
          currentQ.questionType !== 'multi_select' &&
          currentQ.questionType !== 'matching')) && (
        <div className="space-y-3">
          <input
            disabled={submitted}
            value={typedAnswer}
            onChange={(e) => setTypedAnswer(e.target.value)}
            placeholder={
              currentQ.questionType === 'numerical'
                ? 'Enter final numerical value with SI unit (e.g. 20 m/s)'
                : 'Type the missing term or value...'
            }
            className="font-mono-tabular w-full rounded-lg border border-neutral-200 bg-white px-4 py-2.5 text-sm dark:border-neutral-700 dark:bg-neutral-800"
          />

          {currentQ.questionType === 'numerical' && currentQ.numericalSteps && !submitted && (
            <div className="rounded-lg border border-neutral-200 bg-neutral-50 p-3 text-xs dark:border-neutral-800 dark:bg-neutral-950">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="font-semibold text-neutral-800 dark:text-neutral-200">
                  KPK Board 6-Step Numerical Helper
                </span>
                <button
                  type="button"
                  onClick={() => setNumericalRevealStep((s) => Math.min(4, s + 1))}
                  className="font-semibold text-[#1B6B46] hover:underline dark:text-[#6CD19B]"
                >
                  {numericalRevealStep < 4 ? 'Reveal Next Step' : '4 Guidance Steps Shown'}
                </button>
              </div>
              {numericalRevealStep >= 1 && (
                <div className="mt-2">
                  <strong>1. Given:</strong> {currentQ.numericalSteps.given.join(', ')}
                </div>
              )}
              {numericalRevealStep >= 2 && (
                <div>
                  <strong>2. Required:</strong> {currentQ.numericalSteps.required}
                </div>
              )}
              {numericalRevealStep >= 3 && (
                <div>
                  <strong>3. Formula:</strong> <MathText text={currentQ.numericalSteps.formula} />
                </div>
              )}
              {numericalRevealStep >= 4 && (
                <div>
                  <strong>4. Substitution:</strong>{' '}
                  <MathText text={currentQ.numericalSteps.substitution} />
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Format 7 & 8: Short / Long Answer / Conceptual Self-Mark Rubric */}
      {isSubjective && (
        <div className="space-y-3 rounded-lg border border-neutral-200 bg-neutral-50 p-4 text-xs dark:border-neutral-800 dark:bg-neutral-950">
          <div className="font-semibold text-neutral-900 dark:text-neutral-100">
            Write your answer on paper first, then tick the KPK Board Marking Points you covered:
          </div>
          {(currentQ.markingPoints.length > 0
            ? currentQ.markingPoints
            : ['My written answer matches the key concept, formula, and unit shown below.']
          ).map((pt, idx) => (
            <label key={idx} className="flex cursor-pointer items-start gap-2">
              <input
                type="checkbox"
                disabled={submitted}
                checked={checkedPoints.includes(idx)}
                onChange={() =>
                  setCheckedPoints((prev) =>
                    prev.includes(idx) ? prev.filter((i) => i !== idx) : [...prev, idx],
                  )
                }
                className="mt-0.5 accent-[#1B6B46]"
              />
              <span>
                <MathText text={pt} />
              </span>
            </label>
          ))}
        </div>
      )}

      {/* Progressive Hints */}
      {currentQ.hints.length > 0 && !submitted && (
        <div className="space-y-2">
          <MotionCollapse open={hintsShown > 0}>
            <div className="space-y-1 rounded-lg bg-[#FEF4E6] p-3 text-xs text-[#6B4E16] dark:bg-[#3B2810] dark:text-[#E6A756]">
              {currentQ.hints.slice(0, hintsShown).map((h, idx) => (
                <div key={idx}>
                  <strong>Hint {idx + 1}:</strong> <MathText text={h} />
                </div>
              ))}
            </div>
          </MotionCollapse>
          {hintsShown < currentQ.hints.length && (
            <button
              type="button"
              onClick={() => setHintsShown((c) => c + 1)}
              className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#B4690E] hover:underline dark:text-[#E6A756]"
            >
              <Lightbulb className="h-3.5 w-3.5" />
              Show Hint ({hintsShown}/{currentQ.hints.length})
            </button>
          )}
        </div>
      )}

      {practiceError && (
        <div className="rounded-lg border border-[#B9382C]/40 bg-[#FCECEA] px-3 py-2 text-xs font-medium text-[#B9382C] dark:bg-[#3A1B18] dark:text-[#F28B82]">
          {practiceError}
        </div>
      )}

      {/* Action / Result Footer */}
      {!submitted ? (
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={handleSubmit}
            className="rounded-lg bg-[#1B6B46] px-5 py-2.5 text-xs font-semibold text-white transition active:scale-[0.98] hover:bg-[#155537]"
          >
            Check Answer
          </button>
          <button
            type="button"
            onClick={() => resetInputs(qIndex)}
            className="inline-flex items-center gap-1 rounded-lg border border-neutral-200 px-3 py-2.5 text-xs font-semibold text-neutral-700 dark:border-neutral-700 dark:text-neutral-200"
          >
            <RotateCcw className="h-3.5 w-3.5" />
            Clear
          </button>
        </div>
      ) : (
        <MotionQuizFeedback
          state={isCorrect ? 'correct' : 'incorrect'}
          className="space-y-3 border-t border-neutral-200 pt-4 text-xs dark:border-neutral-800"
        >
          <div
            className={`flex items-center gap-2 text-sm font-bold ${
              isCorrect
                ? 'text-[#1E7E4E] dark:text-[#6CD19B]'
                : 'text-[#B9382C] dark:text-[#F28B82]'
            }`}
          >
            {isCorrect ? (
              <>
                <CheckCircle2 className="h-4 w-4" />
                Correct — well done!
              </>
            ) : (
              <>
                <XCircle className="h-4 w-4" />
                Review Answer — Official Key: <MathText text={currentQ.correctAnswer} />
              </>
            )}
          </div>

          {!isCorrect &&
            selectedOption &&
            currentQ.optionMisconceptions?.[selectedOption] && (
              <p className="rounded-lg bg-[#FCECEA] p-2.5 text-[#B9382C] dark:bg-[#3A1B18] dark:text-[#F28B82]">
                <strong>Why that option is tempting:</strong>{' '}
                {currentQ.optionMisconceptions[selectedOption]}
              </p>
            )}

          <p className="leading-relaxed text-neutral-700 dark:text-neutral-300">
            <MathText text={currentQ.explanation} />
          </p>

          {currentQ.numericalSteps && (
            <div className="space-y-1 rounded-lg border border-neutral-200 bg-neutral-50 p-3 dark:border-neutral-800 dark:bg-neutral-950">
              <div className="font-bold text-[#1B6B46] dark:text-[#6CD19B]">
                Complete 6-Step KPK Board Method
              </div>
              <div>
                <strong>1. Given:</strong> {currentQ.numericalSteps.given.join(', ')}
              </div>
              <div>
                <strong>2. Required:</strong> {currentQ.numericalSteps.required}
              </div>
              <div>
                <strong>3. Formula:</strong> <MathText text={currentQ.numericalSteps.formula} />
              </div>
              <div>
                <strong>4. Substitution:</strong>{' '}
                <MathText text={currentQ.numericalSteps.substitution} />
              </div>
              <div>
                <strong>5. Calculation:</strong>{' '}
                <MathText text={currentQ.numericalSteps.calculation} />
              </div>
              <div className="font-bold">
                <strong>6. Result:</strong>{' '}
                <MathText text={currentQ.numericalSteps.answerWithUnit} />
              </div>
            </div>
          )}

          <button
            type="button"
            onClick={() => {
              if (qIndex + 1 < questions.length) {
                resetInputs(qIndex + 1);
              } else {
                onCompleteSession();
              }
            }}
            className="rounded-lg bg-[#1B6B46] px-4 py-2 text-xs font-semibold text-white hover:bg-[#155537]"
          >
            {qIndex + 1 < questions.length ? 'Next Question' : 'Finish Practice Set'}
          </button>
        </MotionQuizFeedback>
      )}
    </div>
  );
}
