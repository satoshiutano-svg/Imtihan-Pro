import { useState, type ChangeEvent } from 'react';
import { CheckCircle2, FileUp, Sparkles, Upload } from 'lucide-react';
import { SAMPLE_TEST_GENERATOR_PACKS } from '../data/cmsSeed';
import type { AcademicGroupId, CmsChapter } from '../types/cms';

interface BookUploaderProps {
  existingChapterIds: string[];
  onImportChapters: (chapters: CmsChapter[]) => void;
  onOpenAiGenerator?: () => void;
}

export function BookUploader({
  existingChapterIds,
  onImportChapters,
  onOpenAiGenerator,
}: BookUploaderProps) {
  const [grade, setGrade] = useState<9 | 10 | 11 | 12>(9);
  const [groupId, setGroupId] = useState<AcademicGroupId>('ssc_science');
  const [subjectName, setSubjectName] = useState('Physics (English Medium)');
  const [chapterNumber, setChapterNumber] = useState(3);
  const [chapterTitle, setChapterTitle] = useState('Dynamics');
  const [sourceBook, setSourceBook] = useState('KPECTB Textbook (English Medium)');
  const [permissionChecked, setPermissionChecked] = useState(true);
  const [rawText, setRawText] = useState(
    `# Newton's First Law of Motion
A body continues its state of rest or uniform motion in a straight line unless acted upon by an external net force.
Formula: F = ma

Q: Which property of a body resists any change in its state of rest or motion?
Options: Inertia | Momentum | Impulse | Torque
Answer: Inertia
Explanation: Inertia is directly proportional to mass and resists change in velocity.`,
  );
  const [statusMessage, setStatusMessage] = useState<string>('');

  const handleLoadSamplePacks = () => {
    const fresh = SAMPLE_TEST_GENERATOR_PACKS.filter(
      (p) => !existingChapterIds.includes(p.chapterId),
    );
    if (fresh.length === 0) {
      setStatusMessage(
        'All Grade 9–12 sample test packs are already loaded in your workspace.',
      );
      return;
    }
    onImportChapters(fresh);
    setStatusMessage(
      `Loaded ${fresh.length} sample testing chapters (Biology 9, Maths 11, Physics 12). Verify content before publishing.`,
    );
  };

  const handleJsonUpload = async (e: ChangeEvent<HTMLInputElement>) => {
    const input = e.target;
    const file = input.files?.[0];
    if (!file) return;
    try {
      const text = await file.text();
      const parsed = JSON.parse(text);
      const list: CmsChapter[] = Array.isArray(parsed) ? parsed : [parsed];
      const valid = list.filter((item) => item.chapterId && item.title);
      if (valid.length === 0) {
        setStatusMessage('JSON file did not match Roshan Study ChapterPack format.');
        return;
      }
      onImportChapters(valid);
      setStatusMessage(`Imported ${valid.length} chapter pack(s) from ${file.name}.`);
    } catch {
      setStatusMessage('Could not parse JSON file. Check formatting and retry.');
    } finally {
      input.value = '';
    }
  };

  const handleConvertTextToChapter = () => {
    if (!chapterTitle.trim() || !rawText.trim()) {
      setStatusMessage('Enter a chapter title and paste textbook text before converting.');
      return;
    }

    const lines = rawText.split('\n').map((l) => l.trim());
    let conceptTitle = chapterTitle.trim();
    const explanationLines: string[] = [];
    const formulas: { expression: string; description: string }[] = [];
    let qStatement = '';
    let qOptions: string[] = [];
    let qAnswer = '';
    let qExplanation = '';

    for (const line of lines) {
      if (line.startsWith('#')) {
        conceptTitle = line.replace(/^#+\s*/, '');
      } else if (line.toLowerCase().startsWith('formula:')) {
        formulas.push({
          expression: line.slice(8).trim(),
          description: 'Extracted from book text',
        });
      } else if (line.toLowerCase().startsWith('q:')) {
        qStatement = line.slice(2).trim();
      } else if (line.toLowerCase().startsWith('options:')) {
        qOptions = line
          .slice(8)
          .split('|')
          .map((o) => o.trim())
          .filter(Boolean);
      } else if (line.toLowerCase().startsWith('answer:')) {
        qAnswer = line.slice(7).trim();
      } else if (line.toLowerCase().startsWith('explanation:')) {
        qExplanation = line.slice(12).trim();
      } else if (line.length > 0 && !qStatement) {
        explanationLines.push(line);
      }
    }

    const sanitizedSubject =
      subjectName.toLowerCase().replace(/[^a-z0-9]/g, '').slice(0, 4) || 'subj';
    const subjectId = `${sanitizedSubject}_${grade}`;
    const safeChapterNumber = Math.max(1, Math.min(30, Math.round(chapterNumber) || 1));
    const chapterId = `custom_g${grade}_ch${safeChapterNumber}_${Date.now()}`;
    const conceptId = `c_${chapterId}_1`;

    const newChapter: CmsChapter = {
      chapterId,
      programmeId: 'ssc_hssc',
      grade,
      groupId,
      subjectId,
      subjectName,
      chapterNumber: safeChapterNumber,
      title: chapterTitle.trim(),
      learningOutcomes: [`Understand ${conceptTitle} and solve related questions.`],
      publicationStatus: 'draft',
      packVersion: 1,
      permissionVerified: permissionChecked,
      concepts: [
        {
          id: conceptId,
          chapterId,
          topicId: `${chapterId}_t1`,
          orderIndex: 1,
          title: conceptTitle,
          locale: 'en',
          textDirection: 'ltr',
          simpleExplanation:
            explanationLines.join(' ') || `Concept summary for ${conceptTitle}.`,
          definitions: [],
          importantPoints: [],
          formulas,
          diagramCaption: '',
          diagramSvg: '',
          workedExamplePrompt: '',
          workedExampleSteps: [],
          workedExampleAnswer: '',
          applications: [],
          commonMistake: '',
          commonMistakeCorrection: '',
          quickRevisionSummary: [conceptTitle],
          videoLinks: [],
          glossaryHints: [],
          microCards: [
            {
              stageTitle: '01. Core Concept',
              body: explanationLines.join(' ') || conceptTitle,
            },
          ],
          sourceBook,
          sourcePage: `Ch. ${chapterNumber}`,
          reviewStatus: 'draft',
          reviewedBy: '',
        },
      ],
      questions: qStatement
        ? [
            {
              id: `q_${chapterId}_1`,
              programmeId: 'ssc_hssc',
              grade,
              groupId,
              subjectId,
              chapterId,
              topicId: `${chapterId}_t1`,
              conceptId,
              questionType: qOptions.length >= 2 ? 'mcq' : 'short_answer',
              difficulty: 2,
              statement: qStatement,
              options: qOptions,
              hints: ['Review the concept summary above.'],
              markingPoints: [],
              correctAnswer: qAnswer || 'Verify answer',
              explanation: qExplanation || 'Added via Book Text Importer.',
              marks: 1,
              sourceType: 'practice_original',
              publicationStatus: 'draft',
              reviewedBy: '',
            },
          ]
        : [],
    };

    onImportChapters([newChapter]);
    setStatusMessage(
      `Created draft chapter "${newChapter.title}" (${newChapter.concepts.length} concept, ${newChapter.questions.length} question). Open Content Studio to review & publish.`,
    );
  };

  return (
    <div className="space-y-6">
      {/* Quick Testing Generator, JSON File Import & AI Question Generator */}
      <div className="grid gap-6 md:grid-cols-3">
        <div className="rounded-xl border border-neutral-200 bg-white p-6 dark:border-neutral-800 dark:bg-neutral-900">
          <h2 className="text-base font-bold text-neutral-900 dark:text-neutral-100">
            Generate Sample Content for Testing
          </h2>
          <p className="mt-1 text-xs leading-relaxed text-neutral-600 dark:text-neutral-300">
            Instantly add Grade 9 Biology, Grade 11 Mathematics, and Grade 12 Physics test chapters to test every grade right away.
          </p>
          <button
            type="button"
            onClick={handleLoadSamplePacks}
            className="mt-4 inline-flex items-center gap-2 rounded-lg bg-[#1B6B46] px-4 py-2.5 text-xs font-semibold text-white hover:bg-[#155537]"
          >
            <Sparkles className="h-4 w-4" />
            Load Sample Test Packs
          </button>
        </div>

        <div className="rounded-xl border border-neutral-200 bg-white p-6 dark:border-neutral-800 dark:bg-neutral-900">
          <h2 className="text-base font-bold text-neutral-900 dark:text-neutral-100">
            AI Smart Question Generator
          </h2>
          <p className="mt-1 text-xs leading-relaxed text-neutral-600 dark:text-neutral-300">
            Paste any KPECTB textbook extract to generate KPK BISE MCQs, 6-step numericals, hints, and marking schemes into cloud packs at $0 student AI cost.
          </p>
          <button
            type="button"
            onClick={onOpenAiGenerator}
            className="mt-4 inline-flex items-center gap-2 rounded-lg border border-[#1B6B46] px-4 py-2.5 text-xs font-semibold text-[#1B6B46] hover:bg-[#D6F0E1]/40 dark:border-[#6CD19B] dark:text-[#6CD19B] dark:hover:bg-[#174F33]/40"
          >
            <Sparkles className="h-4 w-4" />
            Open Smart Generator
          </button>
        </div>

        <div className="rounded-xl border border-neutral-200 bg-white p-6 dark:border-neutral-800 dark:bg-neutral-900">
          <h2 className="text-base font-bold text-neutral-900 dark:text-neutral-100">
            Upload Chapter Pack JSON
          </h2>
          <p className="mt-1 text-xs leading-relaxed text-neutral-600 dark:text-neutral-300">
            Import previously exported `.json` chapter packs or bulk arrays prepared by subject teachers.
          </p>
          <label className="mt-4 inline-flex cursor-pointer items-center gap-2 rounded-lg border border-neutral-200 bg-neutral-50 px-4 py-2.5 text-xs font-semibold text-neutral-800 hover:bg-neutral-100 dark:border-neutral-700 dark:bg-neutral-800 dark:text-neutral-100">
            <FileUp className="h-4 w-4 text-[#1B6B46] dark:text-[#6CD19B]" />
            Choose JSON File
            <input
              type="file"
              accept=".json,application/json"
              onChange={handleJsonUpload}
              className="hidden"
            />
          </label>
        </div>
      </div>

      {/* Non-Developer Friendly Paste-Textbook-Text Importer */}
      <div className="rounded-xl border border-neutral-200 bg-white p-6 dark:border-neutral-800 dark:bg-neutral-900">
        <h2 className="text-base font-bold text-neutral-900 dark:text-neutral-100">
          Easy Book Text Importer (No Coding Needed)
        </h2>
        <p className="mt-1 text-xs text-neutral-500 dark:text-neutral-400">
          Paste textbook notes and optional Q&A lines (`# Heading`, `Formula:`, `Q:`, `Options: A | B | C`, `Answer:`, `Explanation:`). Creates a structured chapter draft automatically.
        </p>

        <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <div>
            <label className="mb-1 block text-xs font-medium">Grade</label>
            <select
              value={grade}
              onChange={(e) => {
                const g = Number(e.target.value) as 9 | 10 | 11 | 12;
                setGrade(g);
                setGroupId(g <= 10 ? 'ssc_science' : 'hssc_pre_engineering');
              }}
              className="w-full rounded-lg border border-neutral-200 bg-white px-3 py-2 text-xs dark:border-neutral-700 dark:bg-neutral-800"
            >
              <option value={9}>Grade 9 (SSC I)</option>
              <option value={10}>Grade 10 (SSC II)</option>
              <option value={11}>Grade 11 (HSSC I)</option>
              <option value={12}>Grade 12 (HSSC II)</option>
            </select>
          </div>

          <div>
            <label className="mb-1 block text-xs font-medium">Subject (English Medium)</label>
            <input
              value={subjectName}
              onChange={(e) => setSubjectName(e.target.value)}
              className="w-full rounded-lg border border-neutral-200 bg-white px-3 py-2 text-xs dark:border-neutral-700 dark:bg-neutral-800"
            />
          </div>

          <div>
            <label className="mb-1 block text-xs font-medium">Chapter #</label>
            <input
              type="number"
              min={1}
              max={30}
              value={chapterNumber}
              onChange={(e) =>
                setChapterNumber(
                  Math.max(1, Math.min(30, Math.round(Number(e.target.value)) || 1)),
                )
              }
              className="w-full rounded-lg border border-neutral-200 bg-white px-3 py-2 text-xs dark:border-neutral-700 dark:bg-neutral-800"
            />
          </div>

          <div>
            <label className="mb-1 block text-xs font-medium">Chapter Title</label>
            <input
              value={chapterTitle}
              onChange={(e) => setChapterTitle(e.target.value)}
              className="w-full rounded-lg border border-neutral-200 bg-white px-3 py-2 text-xs dark:border-neutral-700 dark:bg-neutral-800"
            />
          </div>
        </div>

        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          <div>
            <label className="mb-1 block text-xs font-medium">Source Book & Edition</label>
            <input
              value={sourceBook}
              onChange={(e) => setSourceBook(e.target.value)}
              className="w-full rounded-lg border border-neutral-200 bg-white px-3 py-2 text-xs dark:border-neutral-700 dark:bg-neutral-800"
            />
          </div>
          <label className="mt-5 flex items-center gap-2 text-xs text-neutral-700 dark:text-neutral-300">
            <input
              type="checkbox"
              checked={permissionChecked}
              onChange={(e) => setPermissionChecked(e.target.checked)}
              className="accent-[#1B6B46]"
            />
            Text-only summary or copyright permission verified
          </label>
        </div>

        <textarea
          rows={8}
          value={rawText}
          onChange={(e) => setRawText(e.target.value)}
          className="font-mono-tabular mt-3 w-full rounded-lg border border-neutral-200 bg-neutral-50 p-3 text-xs leading-relaxed dark:border-neutral-700 dark:bg-neutral-950"
        />

        <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
          <button
            type="button"
            onClick={handleConvertTextToChapter}
            className="inline-flex items-center gap-2 rounded-lg bg-[#1B6B46] px-4 py-2.5 text-xs font-semibold text-white hover:bg-[#155537]"
          >
            <Upload className="h-4 w-4" />
            Convert Text to Structured Chapter Draft
          </button>

          {statusMessage && (
            <div className="flex items-center gap-1.5 text-xs font-medium text-[#1E7E4E] dark:text-[#6CD19B]">
              <CheckCircle2 className="h-4 w-4" />
              {statusMessage}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
