import { useEffect, useState, type ChangeEvent } from 'react';
import {
  AlertTriangle,
  Bot,
  CheckCircle2,
  Eye,
  EyeOff,
  FileText,
  FileUp,
  Loader2,
  RefreshCw,
  Sparkles,
  Trash2,
  Upload,
} from 'lucide-react';
import { SAMPLE_TEST_GENERATOR_PACKS } from '../data/cmsSeed';
import type {
  AcademicGroupId,
  BookDocument,
  CmsChapter,
  ProductionJob,
  ProductionScope,
  ProgrammeId,
} from '../types/cms';

interface BookUploaderProps {
  existingChapterIds: string[];
  onImportChapters: (chapters: CmsChapter[]) => void;
  onOpenAiGenerator?: () => void;
  onOpenAgentBridge?: () => void;
  onOpenOpsControl?: () => void;
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

export function BookUploader({
  existingChapterIds,
  onImportChapters,
  onOpenAiGenerator,
  onOpenAgentBridge,
  onOpenOpsControl,
}: BookUploaderProps) {
  const [programmeId, setProgrammeId] = useState<ProgrammeId>('ssc_hssc');
  const [grade, setGrade] = useState<9 | 10 | 11 | 12>(9);
  const [groupId, setGroupId] = useState<AcademicGroupId>('ssc_science');
  const [subjectName, setSubjectName] = useState('Physics (English Medium)');
  const [chapterNumber, setChapterNumber] = useState(3);
  const [chapterTitle, setChapterTitle] = useState('Dynamics');
  const [bookTitle, setBookTitle] = useState('KPECTB Physics Grade 9');
  const [sourceBook, setSourceBook] = useState('KPECTB Textbook (English Medium)');
  const [scope, setScope] = useState<ProductionScope>('full_chapter_pack');
  const [permissionChecked, setPermissionChecked] = useState(true);
  const [isStudentVisible, setIsStudentVisible] = useState(true);
  const [autoQueueJob, setAutoQueueJob] = useState(true);
  const [trustedAutoApproveStructure, setTrustedAutoApproveStructure] = useState(false);
  const [createNewVersion, setCreateNewVersion] = useState(false);

  const [rawText, setRawText] = useState(
    `# Newton's First Law of Motion
A body continues its state of rest or uniform motion in a straight line unless acted upon by an external net force.
Formula: $F = ma$

Q: Which property of a body resists any change in its state of rest or motion?
Options: Inertia | Momentum | Impulse | Torque
Answer: Inertia
Explanation: Inertia is directly proportional to mass and resists change in velocity.`,
  );

  const [statusMessage, setStatusMessage] = useState<string>('');
  const [pdfError, setPdfError] = useState<string>('');
  const [pdfBusy, setPdfBusy] = useState<boolean>(false);
  const [selectedPdfName, setSelectedPdfName] = useState<string>('');

  const [books, setBooks] = useState<BookDocument[]>([]);
  const [loadingBooks, setLoadingBooks] = useState(true);
  const [busyBookId, setBusyBookId] = useState('');

  const loadBooks = async () => {
    try {
      const res = await fetch('/api/cms/books');
      if (!res.ok) return;
      const data = (await res.json()) as { books?: BookDocument[] };
      if (Array.isArray(data.books)) {
        setBooks(data.books);
      }
    } catch {
      // Ignore offline error
    } finally {
      setLoadingBooks(false);
    }
  };

  useEffect(() => {
    void loadBooks();
  }, []);

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

  const handlePdfUploadToVault = async (e: ChangeEvent<HTMLInputElement>) => {
    const input = e.target;
    const file = input.files?.[0];
    if (!file) return;
    setPdfError('');
    setStatusMessage('');

    if (file.size > 20 * 1024 * 1024) {
      setPdfError('PDF exceeds 20 MB limit. Split large textbooks before uploading.');
      input.value = '';
      return;
    }

    setSelectedPdfName(file.name);
    setPdfBusy(true);

    try {
      const pdfBase64 = await readFileAsBase64(file);
      const resolvedTitle =
        bookTitle.trim() || file.name.replace(/\.pdf$/i, '').replace(/[_-]+/g, ' ');

      const res = await fetch('/api/cms/books/upload', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: resolvedTitle,
          programmeId,
          grade,
          groupId,
          subjectName,
          curriculum: 'KPK BISE (KPECTB English Medium)',
          sourceBook,
          chapterNumber,
          chapterTitle: chapterTitle.trim() || `${resolvedTitle} — Ch ${chapterNumber}`,
          scope,
          permissionVerified: permissionChecked,
          isStudentVisible,
          autoQueueJob,
          trustedAutoApproveStructure,
          createNewVersion,
          supplementText: rawText.trim() || undefined,
          filename: file.name,
          pdfBase64,
        }),
      });

      const data = (await res.json()) as {
        duplicateDetected?: boolean;
        message?: string;
        book?: BookDocument;
        queuedJob?: ProductionJob | null;
      };

      if (!res.ok || !data.book) {
        setPdfError(data.message || 'Could not upload PDF into Book Vault.');
        return;
      }

      if (data.duplicateDetected) {
        setStatusMessage(
          data.message ||
            `Duplicate PDF SHA-256 detected — reused cached book "${data.book.title}" at $0 cost.`,
        );
      } else {
        setStatusMessage(
          `Stored "${data.book.title}" v${data.book.version} (${data.book.pageCount} page(s), SHA ${data.book.sha256.slice(0, 10)}) in ${
            data.book.storageTarget === 'cloudflare_r2' ? 'Cloudflare R2 + Vault' : 'Disk Vault'
          }.${
            data.queuedJob
              ? ` Auto-queued $0 external agent job ${data.queuedJob.id} (${data.queuedJob.tasks.length} tasks).`
              : ''
          }`,
        );
      }
      await loadBooks();
    } catch {
      setPdfError('Network error uploading textbook PDF to vault. Please retry.');
    } finally {
      setPdfBusy(false);
      input.value = '';
    }
  };

  const handleToggleStudentVisible = async (book: BookDocument) => {
    setBusyBookId(book.id);
    try {
      const res = await fetch(`/api/cms/books/${encodeURIComponent(book.id)}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isStudentVisible: !book.isStudentVisible }),
      });
      if (res.ok) {
        await loadBooks();
      }
    } finally {
      setBusyBookId('');
    }
  };

  const handleReprocessAndQueue = async (book: BookDocument) => {
    setBusyBookId(book.id);
    setPdfError('');
    try {
      const res = await fetch(`/api/cms/books/${encodeURIComponent(book.id)}/reprocess`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          queueJob: true,
          chapterNumber,
          chapterTitle: `${book.title} — Ch ${chapterNumber}`,
        }),
      });
      const data = (await res.json()) as {
        queuedJob?: ProductionJob | null;
        message?: string;
      };
      if (!res.ok) {
        setPdfError(data.message || 'Could not reprocess PDF.');
        return;
      }
      setStatusMessage(
        `Reprocessed "${book.title}"${
          data.queuedJob ? ` and queued $0 production job ${data.queuedJob.id}` : ''
        }.`,
      );
      await loadBooks();
    } finally {
      setBusyBookId('');
    }
  };

  const handleDeleteBook = async (book: BookDocument) => {
    setBusyBookId(book.id);
    try {
      await fetch(`/api/cms/books/${encodeURIComponent(book.id)}`, {
        method: 'DELETE',
      });
      await loadBooks();
    } finally {
      setBusyBookId('');
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
      programmeId,
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
              programmeId,
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
      `Created draft chapter "${newChapter.title}" (${newChapter.concepts.length} concept, ${newChapter.questions.length} question).`,
    );
  };

  return (
    <div className="space-y-6">
      {/* Top Action Cards */}
      <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-xl border border-neutral-200 bg-white p-5 dark:border-neutral-800 dark:bg-neutral-900">
          <h2 className="text-sm font-bold text-neutral-900 dark:text-neutral-100">
            Upload Textbook PDF ($0 Vault)
          </h2>
          <p className="mt-1 text-xs leading-relaxed text-neutral-600 dark:text-neutral-300">
            Stores PDF permanently, validates `%PDF-` &amp; SHA-256, extracts text, makes it
            readable for students, and queues a $0 job for Freebuff/OpenCode.
          </p>
          <label className="mt-4 inline-flex cursor-pointer items-center gap-2 rounded-lg bg-[#1B6B46] px-3.5 py-2 text-xs font-semibold text-white hover:bg-[#155537]">
            {pdfBusy ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileText className="h-4 w-4" />}
            {pdfBusy ? 'Uploading PDF...' : 'Upload Book PDF'}
            <input
              type="file"
              accept=".pdf,application/pdf"
              disabled={pdfBusy}
              onChange={(e) => void handlePdfUploadToVault(e)}
              className="hidden"
            />
          </label>
          {selectedPdfName && !pdfError && (
            <p className="mt-2 truncate text-[11px] text-neutral-500">
              Selected: {selectedPdfName}
            </p>
          )}
        </div>

        <div className="rounded-xl border border-neutral-200 bg-white p-5 dark:border-neutral-800 dark:bg-neutral-900">
          <h2 className="text-sm font-bold text-neutral-900 dark:text-neutral-100">
            Freebuff / OpenCode Agents
          </h2>
          <p className="mt-1 text-xs leading-relaxed text-neutral-600 dark:text-neutral-300">
            External free agents pull uploaded PDFs from `/api/agent/books/:id/source`, write
            lessons &amp; numericals, and verify independently.
          </p>
          <div className="mt-4 flex flex-wrap gap-2">
            <button
              type="button"
              onClick={onOpenAgentBridge}
              className="inline-flex items-center gap-1.5 rounded-lg border border-[#1B6B46] px-3 py-2 text-xs font-semibold text-[#1B6B46] dark:border-[#6CD19B] dark:text-[#6CD19B]"
            >
              <Bot className="h-3.5 w-3.5" />
              Agent Bridge
            </button>
            {onOpenOpsControl && (
              <button
                type="button"
                onClick={onOpenOpsControl}
                className="rounded-lg border border-neutral-200 px-3 py-2 text-xs font-semibold dark:border-neutral-700"
              >
                Admin Control
              </button>
            )}
          </div>
        </div>

        <div className="rounded-xl border border-neutral-200 bg-white p-5 dark:border-neutral-800 dark:bg-neutral-900">
          <h2 className="text-sm font-bold text-neutral-900 dark:text-neutral-100">
            Sample Testing Packs
          </h2>
          <p className="mt-1 text-xs leading-relaxed text-neutral-600 dark:text-neutral-300">
            Load Grade 9 Biology, Grade 11 Mathematics, and Grade 12 Physics test chapters locally.
          </p>
          <div className="mt-4 flex flex-wrap gap-2">
            <button
              type="button"
              onClick={handleLoadSamplePacks}
              className="inline-flex items-center gap-1.5 rounded-lg border border-neutral-200 bg-neutral-50 px-3 py-2 text-xs font-semibold dark:border-neutral-700 dark:bg-neutral-800"
            >
              <Sparkles className="h-3.5 w-3.5 text-[#1B6B46] dark:text-[#6CD19B]" />
              Load Samples
            </button>
            {onOpenAiGenerator && (
              <button
                type="button"
                onClick={onOpenAiGenerator}
                className="rounded-lg border border-neutral-200 px-3 py-2 text-xs font-semibold text-[#1B6B46] dark:border-neutral-700 dark:text-[#6CD19B]"
              >
                Optional AI Gate
              </button>
            )}
          </div>
        </div>

        <div className="rounded-xl border border-neutral-200 bg-white p-5 dark:border-neutral-800 dark:bg-neutral-900">
          <h2 className="text-sm font-bold text-neutral-900 dark:text-neutral-100">
            Import Chapter JSON
          </h2>
          <p className="mt-1 text-xs leading-relaxed text-neutral-600 dark:text-neutral-300">
            Import `.json` chapter packs or bulk arrays exported by your agents.
          </p>
          <label className="mt-4 inline-flex cursor-pointer items-center gap-2 rounded-lg border border-neutral-200 bg-neutral-50 px-3.5 py-2 text-xs font-semibold dark:border-neutral-700 dark:bg-neutral-800">
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

      {pdfError && (
        <div className="flex items-center gap-2 rounded-xl border border-[#B9382C]/40 bg-[#FCECEA] px-4 py-3 text-xs font-medium text-[#B9382C] dark:bg-[#3A1B18] dark:text-[#F28B82]">
          <AlertTriangle className="h-4 w-4 shrink-0" />
          {pdfError}
        </div>
      )}

      {statusMessage && (
        <div className="flex items-center gap-2 rounded-xl bg-[#1E7E4E]/10 px-4 py-3 text-xs font-medium text-[#1E7E4E] dark:text-[#6CD19B]">
          <CheckCircle2 className="h-4 w-4 shrink-0" />
          {statusMessage}
        </div>
      )}

      {/* Book Vault Table */}
      <div className="rounded-xl border border-neutral-200 bg-white p-6 dark:border-neutral-800 dark:bg-neutral-900">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-neutral-200 pb-3 dark:border-neutral-800">
          <div>
            <h2 className="text-base font-bold text-neutral-900 dark:text-neutral-100">
              Uploaded Textbook &amp; PDF Vault ({books.length})
            </h2>
            <p className="text-xs text-neutral-500 dark:text-neutral-400">
              Stored with SHA-256 deduplication and extracted page text for Students &amp; External
              AI Agents.
            </p>
          </div>
          <button
            type="button"
            onClick={() => void loadBooks()}
            className="inline-flex items-center gap-1.5 rounded-lg border border-neutral-200 px-3 py-1.5 text-xs font-semibold dark:border-neutral-700"
          >
            <RefreshCw className="h-3.5 w-3.5" />
            Refresh Vault
          </button>
        </div>

        {loadingBooks ? (
          <p className="mt-4 text-xs text-neutral-500">Loading stored books...</p>
        ) : books.length === 0 ? (
          <p className="mt-4 text-xs text-neutral-500">
            No PDF books uploaded yet. Set the book details below and click <strong>Upload Book PDF</strong> above.
          </p>
        ) : (
          <div className="mt-3 divide-y divide-neutral-200 text-xs dark:divide-neutral-800">
            {books.map((book) => {
              const busy = busyBookId === book.id;
              return (
                <div
                  key={book.id}
                  className="flex flex-wrap items-center justify-between gap-3 py-3.5 first:pt-1 last:pb-1"
                >
                  <div>
                    <div className="font-bold text-neutral-900 dark:text-neutral-100">
                      {book.title} (v{book.version})
                    </div>
                    <div className="font-mono-tabular mt-0.5 text-[11px] text-neutral-500 dark:text-neutral-400">
                      Grade {book.grade} · {book.subjectName} · {book.pageCount} page(s) ·{' '}
                      {Math.max(1, Math.round(book.fileSizeBytes / 1024))} KB · SHA{' '}
                      {book.sha256.slice(0, 10)} ·{' '}
                      {book.storageTarget === 'cloudflare_r2' ? 'Cloudflare R2' : 'Disk Vault'} ·{' '}
                      {book.metadata.extractionQuality === 'text_extracted'
                        ? 'Text Extracted'
                        : 'Needs OCR/Agent'}
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center gap-2">
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => void handleToggleStudentVisible(book)}
                      className={`inline-flex items-center gap-1 rounded-lg border px-2.5 py-1.5 font-semibold ${
                        book.isStudentVisible
                          ? 'border-[#1B6B46] text-[#1B6B46] dark:border-[#6CD19B] dark:text-[#6CD19B]'
                          : 'border-neutral-200 text-neutral-600 dark:border-neutral-700 dark:text-neutral-300'
                      }`}
                    >
                      {book.isStudentVisible ? (
                        <>
                          <Eye className="h-3.5 w-3.5" /> Student Visible
                        </>
                      ) : (
                        <>
                          <EyeOff className="h-3.5 w-3.5" /> Hidden Draft
                        </>
                      )}
                    </button>

                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => void handleReprocessAndQueue(book)}
                      className="inline-flex items-center gap-1 rounded-lg border border-neutral-200 px-2.5 py-1.5 font-semibold hover:bg-neutral-50 dark:border-neutral-700 dark:hover:bg-neutral-800"
                    >
                      <RefreshCw className="h-3.5 w-3.5" />
                      Reprocess &amp; Queue $0 Job
                    </button>

                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => void handleDeleteBook(book)}
                      aria-label={`Delete ${book.title}`}
                      className="rounded-lg border border-neutral-200 p-1.5 text-[#B9382C] dark:border-neutral-700 dark:text-[#F28B82]"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Book Metadata & Easy Paste Importer */}
      <div className="rounded-xl border border-neutral-200 bg-white p-6 dark:border-neutral-800 dark:bg-neutral-900">
        <h2 className="text-base font-bold text-neutral-900 dark:text-neutral-100">
          Book Upload Settings &amp; Optional Text Supplement
        </h2>
        <p className="mt-1 text-xs text-neutral-500 dark:text-neutral-400">
          Configure these fields before clicking <strong>Upload Book PDF</strong> above, or convert
          pasted notes (`# Heading`, `Formula:`, `Q:`, `Options: A | B | C`, `Answer:`) directly.
        </p>

        <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-5 text-xs">
          <div>
            <label className="mb-1 block font-medium">Programme</label>
            <select
              value={programmeId}
              onChange={(e) => setProgrammeId(e.target.value as ProgrammeId)}
              className="w-full rounded-lg border border-neutral-200 bg-white px-2.5 py-2 dark:border-neutral-700 dark:bg-neutral-800"
            >
              <option value="ssc_hssc">KPK Board (SSC/HSSC)</option>
              <option value="mdcat">MDCAT Admission</option>
              <option value="etea_eng">ETEA Engineering</option>
              <option value="uni_entrance">University Entrance</option>
            </select>
          </div>

          <div>
            <label className="mb-1 block font-medium">Grade</label>
            <select
              value={grade}
              onChange={(e) => {
                const g = Number(e.target.value) as 9 | 10 | 11 | 12;
                setGrade(g);
                setGroupId(g <= 10 ? 'ssc_science' : 'hssc_pre_engineering');
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
            <label className="mb-1 block font-medium">Subject</label>
            <input
              value={subjectName}
              onChange={(e) => setSubjectName(e.target.value)}
              className="w-full rounded-lg border border-neutral-200 bg-white px-2.5 py-2 dark:border-neutral-700 dark:bg-neutral-800"
            />
          </div>

          <div>
            <label className="mb-1 block font-medium">Book Title</label>
            <input
              value={bookTitle}
              onChange={(e) => setBookTitle(e.target.value)}
              className="w-full rounded-lg border border-neutral-200 bg-white px-2.5 py-2 dark:border-neutral-700 dark:bg-neutral-800"
            />
          </div>

          <div>
            <label className="mb-1 block font-medium">Chapter # &amp; Title</label>
            <div className="flex gap-1.5">
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
                className="font-mono-tabular w-14 rounded-lg border border-neutral-200 bg-white px-2 py-2 dark:border-neutral-700 dark:bg-neutral-800"
              />
              <input
                value={chapterTitle}
                onChange={(e) => setChapterTitle(e.target.value)}
                className="min-w-0 flex-1 rounded-lg border border-neutral-200 bg-white px-2.5 py-2 dark:border-neutral-700 dark:bg-neutral-800"
              />
            </div>
          </div>
        </div>

        <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-4 text-xs">
          <div>
            <label className="mb-1 block font-medium">Auto-Queue Production Scope</label>
            <select
              value={scope}
              onChange={(e) => setScope(e.target.value as ProductionScope)}
              className="w-full rounded-lg border border-neutral-200 bg-white px-2.5 py-2 dark:border-neutral-700 dark:bg-neutral-800"
            >
              <option value="full_chapter_pack">Full Chapter Pack ($0 Queue)</option>
              <option value="concepts_and_notes">Concepts &amp; Notes Only</option>
              <option value="visuals_and_graphs">Visuals &amp; Graphs</option>
              <option value="question_bank">Question Bank &amp; Numericals</option>
              <option value="exams_and_quizzes">Exams &amp; Quizzes</option>
            </select>
          </div>

          <div>
            <label className="mb-1 block font-medium">Source Book Citation</label>
            <input
              value={sourceBook}
              onChange={(e) => setSourceBook(e.target.value)}
              className="w-full rounded-lg border border-neutral-200 bg-white px-2.5 py-2 dark:border-neutral-700 dark:bg-neutral-800"
            />
          </div>

          <label className="mt-5 flex items-center gap-2">
            <input
              type="checkbox"
              checked={isStudentVisible}
              onChange={(e) => setIsStudentVisible(e.target.checked)}
              className="accent-[#1B6B46]"
            />
            Visible in Student Book Library
          </label>

          <label className="mt-5 flex items-center gap-2">
            <input
              type="checkbox"
              checked={autoQueueJob}
              onChange={(e) => setAutoQueueJob(e.target.checked)}
              className="accent-[#1B6B46]"
            />
            Auto-queue $0 Agent Pipeline
          </label>
        </div>

        <div className="mt-2 flex flex-wrap gap-5 text-xs">
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={permissionChecked}
              onChange={(e) => setPermissionChecked(e.target.checked)}
              className="accent-[#1B6B46]"
            />
            Text-only summary / copyright permission verified
          </label>
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={createNewVersion}
              onChange={(e) => setCreateNewVersion(e.target.checked)}
              className="accent-[#1B6B46]"
            />
            Force new version if exact SHA-256 already exists
          </label>
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={trustedAutoApproveStructure}
              onChange={(e) => setTrustedAutoApproveStructure(e.target.checked)}
              className="accent-[#1B6B46]"
            />
            Trusted Book: Auto-approve Proposed Structure (skip Owner Structure Gate; final publish approval still required)
          </label>
        </div>

        <textarea
          rows={6}
          value={rawText}
          onChange={(e) => setRawText(e.target.value)}
          className="font-mono-tabular mt-3 w-full rounded-lg border border-neutral-200 bg-neutral-50 p-3 text-xs leading-relaxed dark:border-neutral-700 dark:bg-neutral-950"
        />

        <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
          <button
            type="button"
            onClick={handleConvertTextToChapter}
            className="inline-flex items-center gap-2 rounded-lg border border-[#1B6B46] px-4 py-2 text-xs font-semibold text-[#1B6B46] hover:bg-[#D6F0E1]/35 dark:border-[#6CD19B] dark:text-[#6CD19B]"
          >
            <Upload className="h-4 w-4" />
            Convert Text to Draft Chapter
          </button>
        </div>
      </div>
    </div>
  );
}
