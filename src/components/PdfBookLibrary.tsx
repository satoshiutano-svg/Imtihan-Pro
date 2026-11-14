import { useEffect, useMemo, useState } from 'react';
import {
  Bookmark,
  BookOpen,
  ChevronLeft,
  ChevronRight,
  ExternalLink,
  FileText,
  Maximize2,
  Minimize2,
  Search,
  ZoomIn,
  ZoomOut,
} from 'lucide-react';
import type { BookPageText, ProgrammeId } from '../types/cms';

export interface PublicBookSummary {
  id: string;
  title: string;
  programmeId: ProgrammeId;
  grade: 9 | 10 | 11 | 12;
  groupId: string;
  subjectId: string;
  subjectName: string;
  curriculum: string;
  sourceBook: string;
  version: number;
  pageCount: number;
  filename: string;
  extractionQuality: 'text_extracted' | 'needs_ocr_or_agent';
  extractedText?: string;
  pageTexts: BookPageText[];
  pdfUrl: string;
  updatedAt: string;
}

interface BookReadingProgress {
  lastPage: number;
  bookmarks: number[];
  lastReadAt: string;
}

interface PdfBookLibraryProps {
  programmeFilter: ProgrammeId;
}

const STORAGE_BOOK_PROGRESS_KEY = 'roshan_study_book_progress_v1';

function loadBookProgressMap(): Record<string, BookReadingProgress> {
  try {
    const raw = localStorage.getItem(STORAGE_BOOK_PROGRESS_KEY);
    if (!raw) return {};
    return JSON.parse(raw) as Record<string, BookReadingProgress>;
  } catch {
    return {};
  }
}

export function PdfBookLibrary({ programmeFilter }: PdfBookLibraryProps) {
  const [books, setBooks] = useState<PublicBookSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [gradeFilter, setGradeFilter] = useState<string>('ALL');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedBookId, setSelectedBookId] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [zoomPct, setZoomPct] = useState(100);
  const [viewMode, setViewMode] = useState<'pdf' | 'split' | 'text'>('split');
  const [fullscreen, setFullscreen] = useState(false);
  const [progressMap, setProgressMap] = useState<Record<string, BookReadingProgress>>(
    loadBookProgressMap,
  );

  useEffect(() => {
    let active = true;
    const fetchBooks = async () => {
      setLoading(true);
      setLoadError('');
      try {
        const res = await fetch(
          `/api/v1/books?programme=${encodeURIComponent(programmeFilter)}`,
        );
        if (!res.ok) throw new Error('Could not load published PDF books.');
        const data = (await res.json()) as { books?: PublicBookSummary[] };
        if (active && Array.isArray(data.books)) {
          setBooks(data.books);
          if (data.books[0]) {
            setSelectedBookId((prev) =>
              data.books!.some((b) => b.id === prev) ? prev : data.books![0].id,
            );
          }
        }
      } catch (err) {
        if (active) {
          setLoadError(
            err instanceof Error ? err.message : 'Book library unavailable offline.',
          );
        }
      } finally {
        if (active) setLoading(false);
      }
    };
    void fetchBooks();
    return () => {
      active = false;
    };
  }, [programmeFilter]);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_BOOK_PROGRESS_KEY, JSON.stringify(progressMap));
    } catch {
      // ignore storage quota errors
    }
  }, [progressMap]);

  const filteredBooks = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return books.filter((b) => {
      if (gradeFilter !== 'ALL' && b.grade !== Number(gradeFilter)) return false;
      if (!q) return true;
      const inMeta = `${b.title} ${b.subjectName} ${b.curriculum} ${b.sourceBook}`
        .toLowerCase()
        .includes(q);
      const inPages = b.pageTexts.some((pt) => pt.text.toLowerCase().includes(q));
      return inMeta || inPages;
    });
  }, [books, gradeFilter, searchQuery]);

  const selectedBook = useMemo(
    () =>
      filteredBooks.find((b) => b.id === selectedBookId) ??
      books.find((b) => b.id === selectedBookId) ??
      filteredBooks[0] ??
      null,
    [books, filteredBooks, selectedBookId],
  );

  useEffect(() => {
    if (!selectedBook) return;
    const saved = progressMap[selectedBook.id];
    const startPage = saved?.lastPage
      ? Math.max(1, Math.min(selectedBook.pageCount, saved.lastPage))
      : 1;
    setCurrentPage(startPage);
  }, [selectedBook?.id]);

  const savePageProgress = (book: PublicBookSummary, page: number) => {
    const safePage = Math.max(1, Math.min(Math.max(1, book.pageCount), page));
    setCurrentPage(safePage);
    setProgressMap((prev) => {
      const existing = prev[book.id] ?? {
        lastPage: 1,
        bookmarks: [],
        lastReadAt: new Date().toISOString(),
      };
      return {
        ...prev,
        [book.id]: {
          ...existing,
          lastPage: safePage,
          lastReadAt: new Date().toISOString(),
        },
      };
    });
  };

  const toggleBookmark = (book: PublicBookSummary, page: number) => {
    setProgressMap((prev) => {
      const existing = prev[book.id] ?? {
        lastPage: page,
        bookmarks: [],
        lastReadAt: new Date().toISOString(),
      };
      const exists = existing.bookmarks.includes(page);
      const bookmarks = exists
        ? existing.bookmarks.filter((p) => p !== page)
        : [...existing.bookmarks, page].sort((a, b) => a - b);
      return {
        ...prev,
        [book.id]: {
          ...existing,
          bookmarks,
          lastReadAt: new Date().toISOString(),
        },
      };
    });
  };

  const searchMatches = useMemo(() => {
    if (!selectedBook || !searchQuery.trim()) return [];
    const q = searchQuery.trim().toLowerCase();
    return selectedBook.pageTexts
      .filter((pt) => pt.text.toLowerCase().includes(q))
      .slice(0, 12);
  }, [selectedBook, searchQuery]);

  if (loading) {
    return (
      <div className="rounded-xl border border-neutral-200 bg-white p-8 text-center text-xs text-neutral-500 dark:border-neutral-800 dark:bg-neutral-900 dark:text-neutral-400">
        Loading uploaded KPK PDF library...
      </div>
    );
  }

  if (loadError) {
    return (
      <div className="rounded-xl border border-[#B9382C]/30 bg-[#FCECEA] p-6 text-xs text-[#B9382C] dark:bg-[#3A1B18] dark:text-[#F28B82]">
        {loadError}
      </div>
    );
  }

  if (books.length === 0) {
    return (
      <div className="rounded-xl border border-neutral-200 bg-white p-8 text-center dark:border-neutral-800 dark:bg-neutral-900">
        <BookOpen className="mx-auto mb-2 h-7 w-7 text-[#1B6B46] dark:text-[#6CD19B]" />
        <h3 className="text-sm font-bold text-neutral-900 dark:text-neutral-100">
          No Student-Visible PDF Books Published Yet
        </h3>
        <p className="mx-auto mt-1 max-w-md text-xs text-neutral-500 dark:text-neutral-400">
          Upload a textbook or study guide PDF in <strong>Books &amp; Uploader</strong> and keep
          Student Visible enabled so students can read, bookmark, and search pages here.
        </p>
      </div>
    );
  }

  const activeProgress = selectedBook ? progressMap[selectedBook.id] : undefined;
  const bookBookmarks = activeProgress?.bookmarks ?? [];
  const activePageText =
    selectedBook?.pageTexts.find((p) => p.page === currentPage)?.text ??
    selectedBook?.pageTexts[0]?.text ??
    selectedBook?.extractedText ??
    '';

  const readerContainerClass = fullscreen
    ? 'fixed inset-0 z-50 flex flex-col bg-[#F7FAF8] p-4 dark:bg-[#101412]'
    : 'space-y-4';

  return (
    <div className={readerContainerClass}>
      {/* Search & Filter Toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-neutral-200 bg-white p-4 dark:border-neutral-800 dark:bg-neutral-900">
        <div className="flex flex-1 flex-wrap items-center gap-2.5">
          <div className="relative min-w-52 flex-1">
            <Search className="pointer-events-none absolute top-1/2 left-3 h-3.5 w-3.5 -translate-y-1/2 text-neutral-400" />
            <input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search textbook titles, formulas, or extracted PDF pages..."
              className="min-h-9 w-full rounded-lg border border-neutral-200 bg-neutral-50 pr-3 pl-9 text-xs text-neutral-900 dark:border-neutral-700 dark:bg-neutral-950 dark:text-neutral-100"
            />
          </div>

          <select
            aria-label="Filter books by Grade"
            value={gradeFilter}
            onChange={(e) => setGradeFilter(e.target.value)}
            className="min-h-9 rounded-lg border border-neutral-200 bg-white px-3 text-xs font-medium dark:border-neutral-700 dark:bg-neutral-800"
          >
            <option value="ALL">All Grades (9–12)</option>
            <option value="9">Grade 9</option>
            <option value="10">Grade 10</option>
            <option value="11">Grade 11</option>
            <option value="12">Grade 12</option>
          </select>
        </div>

        <div className="flex items-center gap-1.5">
          <div className="flex items-center gap-1 rounded-lg bg-neutral-100 p-1 dark:bg-neutral-800">
            {(
              [
                ['split', 'PDF + Text'],
                ['pdf', 'PDF Only'],
                ['text', 'Study Text'],
              ] as const
            ).map(([id, label]) => (
              <button
                key={id}
                type="button"
                onClick={() => setViewMode(id)}
                className={`shrink-0 whitespace-nowrap rounded-md px-2.5 py-1 text-xs font-semibold ${
                  viewMode === id
                    ? 'bg-white text-[#1B6B46] shadow-sm dark:bg-neutral-900 dark:text-[#6CD19B]'
                    : 'text-neutral-600 dark:text-neutral-300'
                }`}
              >
                {label}
              </button>
            ))}
          </div>

          <button
            type="button"
            onClick={() => setFullscreen((f) => !f)}
            className="inline-flex min-h-9 shrink-0 items-center gap-1.5 whitespace-nowrap rounded-lg border border-neutral-200 px-3 text-xs font-semibold text-neutral-700 hover:bg-neutral-50 dark:border-neutral-700 dark:text-neutral-200"
          >
            {fullscreen ? <Minimize2 className="h-3.5 w-3.5" /> : <Maximize2 className="h-3.5 w-3.5" />}
            {fullscreen ? 'Exit Fullscreen' : 'Fullscreen'}
          </button>
        </div>
      </div>

      {/* Main Split: Book Shelf + Embedded Reader */}
      <div className={`grid gap-4 ${fullscreen ? 'min-h-0 flex-1 lg:grid-cols-[260px_1fr]' : 'lg:grid-cols-[270px_1fr]'}`}>
        {/* Book Shelf List */}
        <aside className="space-y-2 overflow-y-auto rounded-xl border border-neutral-200 bg-white p-3 dark:border-neutral-800 dark:bg-neutral-900">
          <div className="px-1 text-xs font-bold text-neutral-800 dark:text-neutral-200">
            Library ({filteredBooks.length})
          </div>
          {filteredBooks.map((book) => {
            const p = progressMap[book.id];
            const pct =
              book.pageCount > 0 && p
                ? Math.min(100, Math.round((p.lastPage / book.pageCount) * 100))
                : 0;
            return (
              <button
                key={book.id}
                type="button"
                onClick={() => setSelectedBookId(book.id)}
                className={`w-full rounded-lg border p-3 text-left text-xs transition ${
                  selectedBook?.id === book.id
                    ? 'border-[#1B6B46] bg-[#D6F0E1]/35 dark:border-[#6CD19B] dark:bg-[#174F33]/40'
                    : 'border-neutral-200 hover:bg-neutral-50 dark:border-neutral-800 dark:hover:bg-neutral-800'
                }`}
              >
                <div className="text-[11px] text-neutral-500 dark:text-neutral-400">
                  Grade {book.grade} · {book.subjectName} · v{book.version}
                </div>
                <div className="mt-0.5 font-semibold text-neutral-900 dark:text-neutral-100">
                  {book.title}
                </div>
                <div className="font-mono-tabular mt-1.5 flex items-center justify-between text-[11px] text-neutral-500">
                  <span>{book.pageCount} pages</span>
                  {p ? <span>Page {p.lastPage} ({pct}%)</span> : <span>New</span>}
                </div>
              </button>
            );
          })}
        </aside>

        {/* Active Book Viewer */}
        {selectedBook && (
          <div className="flex min-h-[540px] flex-col rounded-xl border border-neutral-200 bg-white p-4 dark:border-neutral-800 dark:bg-neutral-900">
            {/* Reader Controls Bar */}
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-neutral-200 pb-3 dark:border-neutral-800">
              <div>
                <div className="text-[11px] text-neutral-500 dark:text-neutral-400">
                  Grade {selectedBook.grade} · {selectedBook.subjectName} · {selectedBook.curriculum}
                </div>
                <h3 className="text-sm font-bold text-neutral-900 dark:text-neutral-100">
                  {selectedBook.title}
                </h3>
              </div>

              <div className="flex flex-wrap items-center gap-1.5 text-xs">
                <button
                  type="button"
                  disabled={currentPage <= 1}
                  onClick={() => savePageProgress(selectedBook, currentPage - 1)}
                  aria-label="Previous PDF page"
                  className="rounded-lg border border-neutral-200 p-1.5 disabled:opacity-40 dark:border-neutral-700"
                >
                  <ChevronLeft className="h-4 w-4" />
                </button>
                <div className="flex items-center gap-1">
                  <input
                    type="number"
                    min={1}
                    max={Math.max(1, selectedBook.pageCount)}
                    value={currentPage}
                    onChange={(e) => savePageProgress(selectedBook, Number(e.target.value) || 1)}
                    aria-label="Page number"
                    className="font-mono-tabular w-14 rounded-lg border border-neutral-200 bg-white px-2 py-1 text-center text-xs dark:border-neutral-700 dark:bg-neutral-800"
                  />
                  <span className="font-mono-tabular text-neutral-500">
                    / {selectedBook.pageCount}
                  </span>
                </div>
                <button
                  type="button"
                  disabled={currentPage >= selectedBook.pageCount}
                  onClick={() => savePageProgress(selectedBook, currentPage + 1)}
                  aria-label="Next PDF page"
                  className="rounded-lg border border-neutral-200 p-1.5 disabled:opacity-40 dark:border-neutral-700"
                >
                  <ChevronRight className="h-4 w-4" />
                </button>

                <button
                  type="button"
                  onClick={() => setZoomPct((z) => Math.max(75, z - 25))}
                  aria-label="Zoom out PDF"
                  className="rounded-lg border border-neutral-200 p-1.5 dark:border-neutral-700"
                >
                  <ZoomOut className="h-3.5 w-3.5" />
                </button>
                <span className="font-mono-tabular px-1 text-[11px] font-semibold">{zoomPct}%</span>
                <button
                  type="button"
                  onClick={() => setZoomPct((z) => Math.min(175, z + 25))}
                  aria-label="Zoom in PDF"
                  className="rounded-lg border border-neutral-200 p-1.5 dark:border-neutral-700"
                >
                  <ZoomIn className="h-3.5 w-3.5" />
                </button>

                <button
                  type="button"
                  onClick={() => toggleBookmark(selectedBook, currentPage)}
                  className={`inline-flex items-center gap-1 rounded-lg border px-2.5 py-1.5 text-xs font-semibold ${
                    bookBookmarks.includes(currentPage)
                      ? 'border-[#1B6B46] bg-[#D6F0E1]/40 text-[#1B6B46] dark:border-[#6CD19B] dark:text-[#6CD19B]'
                      : 'border-neutral-200 text-neutral-700 dark:border-neutral-700 dark:text-neutral-200'
                  }`}
                >
                  <Bookmark className="h-3.5 w-3.5" />
                  {bookBookmarks.includes(currentPage) ? 'Bookmarked' : 'Bookmark'}
                </button>

                <a
                  href={selectedBook.pdfUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1 rounded-lg border border-neutral-200 px-2.5 py-1.5 text-xs font-medium text-neutral-700 hover:bg-neutral-50 dark:border-neutral-700 dark:text-neutral-200"
                >
                  <ExternalLink className="h-3.5 w-3.5" />
                  PDF Tab
                </a>
              </div>
            </div>

            {/* Bookmarks & Search Hit Jump Strip */}
            {(bookBookmarks.length > 0 || searchMatches.length > 0) && (
              <div className="mt-2.5 flex flex-wrap items-center gap-2 border-b border-neutral-200 pb-2.5 text-[11px] dark:border-neutral-800">
                {bookBookmarks.length > 0 && (
                  <div className="flex flex-wrap items-center gap-1.5">
                    <span className="font-semibold text-neutral-500">Bookmarks:</span>
                    {bookBookmarks.map((p) => (
                      <button
                        key={p}
                        type="button"
                        onClick={() => savePageProgress(selectedBook, p)}
                        className="font-mono-tabular rounded border border-neutral-200 px-2 py-0.5 font-semibold text-[#1B6B46] hover:bg-neutral-50 dark:border-neutral-700 dark:text-[#6CD19B]"
                      >
                        p.{p}
                      </button>
                    ))}
                  </div>
                )}
                {searchMatches.length > 0 && (
                  <div className="flex flex-wrap items-center gap-1.5">
                    <span className="font-semibold text-neutral-500">Search Hits:</span>
                    {searchMatches.map((m) => (
                      <button
                        key={m.page}
                        type="button"
                        onClick={() => savePageProgress(selectedBook, m.page)}
                        className="font-mono-tabular rounded border border-[#1B6B46]/30 bg-[#D6F0E1]/30 px-2 py-0.5 font-semibold text-[#1B6B46] dark:text-[#6CD19B]"
                      >
                        p.{m.page}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Embedded Inline PDF + Side-by-Side Extracted Text */}
            <div
              className={`mt-3 grid flex-1 gap-4 ${
                viewMode === 'split' ? 'lg:grid-cols-[1.2fr_0.8fr]' : 'grid-cols-1'
              }`}
            >
              {viewMode !== 'text' && (
                <div className="min-h-[460px] overflow-hidden rounded-lg border border-neutral-200 bg-neutral-100 dark:border-neutral-800 dark:bg-neutral-950">
                  <object
                    key={`${selectedBook.id}_${currentPage}_${zoomPct}`}
                    data={`${selectedBook.pdfUrl}#page=${currentPage}&zoom=${zoomPct}`}
                    type="application/pdf"
                    className="h-full min-h-[460px] w-full"
                  >
                    <iframe
                      title={selectedBook.title}
                      src={`${selectedBook.pdfUrl}#page=${currentPage}`}
                      className="h-full min-h-[460px] w-full border-0"
                    />
                  </object>
                </div>
              )}

              {viewMode !== 'pdf' && (
                <div className="flex flex-col rounded-lg border border-neutral-200 bg-neutral-50 p-4 text-xs dark:border-neutral-800 dark:bg-neutral-950">
                  <div className="mb-2 flex items-center justify-between border-b border-neutral-200 pb-2 dark:border-neutral-800">
                    <span className="inline-flex items-center gap-1.5 font-bold text-neutral-900 dark:text-neutral-100">
                      <FileText className="h-3.5 w-3.5 text-[#1B6B46] dark:text-[#6CD19B]" />
                      Extracted Textbook Page {currentPage}
                    </span>
                    <span className="text-[11px] text-neutral-500">
                      {selectedBook.extractionQuality === 'text_extracted'
                        ? 'Searchable text ready'
                        : 'Scanned PDF — agent vision queued'}
                    </span>
                  </div>
                  <div className="flex-1 overflow-y-auto whitespace-pre-wrap leading-relaxed text-neutral-700 dark:text-neutral-300">
                    {activePageText || 'No embedded plain text found on this PDF page.'}
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
