import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import type { BookPageText } from '../src/types/cms.ts';

const VAULT_ROOT = path.resolve(process.cwd(), '.roshan_storage', 'books');

export interface ParsedPdfSummary {
  valid: boolean;
  error?: string;
  sha256: string;
  fileSizeBytes: number;
  pageCount: number;
  pdfTitle?: string;
  author?: string;
  extractedText: string;
  pageTexts: BookPageText[];
  extractionQuality: 'text_extracted' | 'needs_ocr_or_agent';
}

function ensureVaultDir(): void {
  fs.mkdirSync(VAULT_ROOT, { recursive: true });
}

function sanitizePdfSegment(raw: string): string {
  return raw
    .replace(/\\([()\\nrt])/g, (_m, ch) => {
      if (ch === 'n') return '\n';
      if (ch === 'r') return ' ';
      if (ch === 't') return ' ';
      return ch;
    })
    .replace(/[^\x20-\x7E\n]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function extractTextOperators(content: string): string {
  const chunks: string[] = [];
  // Match literal strings (...) followed by Tj or inside [...] TJ arrays
  const tjMatches = content.match(/\((?:\\.|[^\\()])*\)\s*Tj/g) ?? [];
  for (const m of tjMatches) {
    const inner = m.slice(1, m.lastIndexOf(')'));
    const clean = sanitizePdfSegment(inner);
    if (clean) chunks.push(clean);
  }

  const tjArrayMatches = content.match(/\[(?:[^\]]*)\]\s*TJ/g) ?? [];
  for (const arr of tjArrayMatches) {
    const parts = arr.match(/\((?:\\.|[^\\()])*\)/g) ?? [];
    const line = parts
      .map((p) => sanitizePdfSegment(p.slice(1, -1)))
      .filter(Boolean)
      .join('');
    if (line.trim()) chunks.push(line.trim());
  }

  return chunks.join(' ').replace(/\s+/g, ' ').trim();
}

function decodePdfInfoValue(rawPdf: string, key: string): string | undefined {
  const pattern = new RegExp(`/${key}\\s*\\(([^)]{1,200})\\)`, 'i');
  const match = rawPdf.match(pattern);
  if (!match) return undefined;
  const cleaned = sanitizePdfSegment(match[1]);
  return cleaned || undefined;
}

export function parsePdfBuffer(buffer: Buffer): ParsedPdfSummary {
  const sha256 = crypto.createHash('sha256').update(buffer).digest('hex');
  const fileSizeBytes = buffer.byteLength;

  if (fileSizeBytes < 16) {
    return {
      valid: false,
      error: 'Uploaded file is empty or too small to be a valid PDF.',
      sha256,
      fileSizeBytes,
      pageCount: 0,
      extractedText: '',
      pageTexts: [],
      extractionQuality: 'needs_ocr_or_agent',
    };
  }

  const header = buffer.subarray(0, 8).toString('latin1');
  if (!header.startsWith('%PDF-')) {
    return {
      valid: false,
      error: 'Invalid PDF file signature: missing %PDF- header.',
      sha256,
      fileSizeBytes,
      pageCount: 0,
      extractedText: '',
      pageTexts: [],
      extractionQuality: 'needs_ocr_or_agent',
    };
  }

  const rawLatin1 = buffer.toString('latin1');
  const pdfTitle = decodePdfInfoValue(rawLatin1, 'Title');
  const author = decodePdfInfoValue(rawLatin1, 'Author');

  // Count /Type /Page objects (excluding /Pages)
  const pageMatches = rawLatin1.match(/\/Type\s*\/Page\b(?!s)/g);
  const estimatedPageCount = pageMatches ? pageMatches.length : 1;

  // Attempt pure-Node text extraction from uncompressed and FlateDecode PDF streams
  const extractedSegments: string[] = [];
  let searchIdx = 0;

  while (searchIdx < buffer.length && extractedSegments.length < 400) {
    const streamTokenIdx = buffer.indexOf('stream', searchIdx, 'latin1');
    if (streamTokenIdx < 0) break;

    let dataStart = streamTokenIdx + 6;
    if (buffer[dataStart] === 0x0d && buffer[dataStart + 1] === 0x0a) {
      dataStart += 2;
    } else if (buffer[dataStart] === 0x0a || buffer[dataStart] === 0x0d) {
      dataStart += 1;
    }

    const endStreamIdx = buffer.indexOf('endstream', dataStart, 'latin1');
    if (endStreamIdx < 0) break;

    const dictWindow = buffer.subarray(Math.max(0, streamTokenIdx - 280), streamTokenIdx).toString('latin1');
    const rawSlice = buffer.subarray(dataStart, endStreamIdx);

    let decodedContent = '';
    if (/FlateDecode/i.test(dictWindow)) {
      try {
        decodedContent = zlib.inflateSync(rawSlice).toString('latin1');
      } catch {
        try {
          decodedContent = zlib.inflateRawSync(rawSlice).toString('latin1');
        } catch {
          decodedContent = '';
        }
      }
    } else if (!/\/Subtype\s*\/Image/i.test(dictWindow)) {
      decodedContent = rawSlice.toString('latin1');
    }

    if (decodedContent && (decodedContent.includes('Tj') || decodedContent.includes('TJ'))) {
      const segmentText = extractTextOperators(decodedContent);
      if (segmentText.length > 2) {
        extractedSegments.push(segmentText);
      }
    }

    searchIdx = endStreamIdx + 9;
  }

  // Fallback scan on uncompressed inline text operators in raw PDF body
  if (extractedSegments.length === 0) {
    const inlineText = extractTextOperators(rawLatin1);
    if (inlineText.length > 8) {
      extractedSegments.push(inlineText);
    }
  }

  const pageTexts: BookPageText[] = [];
  const pageCount = Math.max(1, estimatedPageCount);

  if (extractedSegments.length > 0) {
    if (extractedSegments.length >= pageCount) {
      const perPage = Math.ceil(extractedSegments.length / pageCount);
      for (let p = 0; p < pageCount; p++) {
        const text = extractedSegments
          .slice(p * perPage, (p + 1) * perPage)
          .join('\n')
          .trim();
        if (text) {
          pageTexts.push({ page: p + 1, text });
        }
      }
    } else {
      extractedSegments.forEach((seg, idx) => {
        pageTexts.push({ page: idx + 1, text: seg });
      });
    }
  }

  const combinedText = pageTexts.map((p) => `[Page ${p.page}]\n${p.text}`).join('\n\n').trim();
  const extractionQuality: 'text_extracted' | 'needs_ocr_or_agent' =
    combinedText.length >= 24 ? 'text_extracted' : 'needs_ocr_or_agent';

  return {
    valid: true,
    sha256,
    fileSizeBytes,
    pageCount,
    pdfTitle,
    author,
    extractedText: combinedText,
    pageTexts,
    extractionQuality,
  };
}

export function saveBookPdfToVault(bookId: string, version: number, buffer: Buffer): string {
  ensureVaultDir();
  const safeId = bookId.replace(/[^a-zA-Z0-9_-]/g, '_');
  const filename = `${safeId}_v${Math.max(1, Math.round(version))}.pdf`;
  const targetPath = path.join(VAULT_ROOT, filename);
  fs.writeFileSync(targetPath, buffer);
  return filename;
}

export function readStoredBookBuffer(bookId: string, version: number): Buffer | null {
  ensureVaultDir();
  const safeId = bookId.replace(/[^a-zA-Z0-9_-]/g, '_');
  const filename = `${safeId}_v${Math.max(1, Math.round(version))}.pdf`;
  const targetPath = path.resolve(VAULT_ROOT, filename);
  if (!targetPath.startsWith(VAULT_ROOT)) {
    return null;
  }
  if (!fs.existsSync(targetPath)) {
    return null;
  }
  return fs.readFileSync(targetPath);
}

export function deleteStoredBookPdf(bookId: string): void {
  ensureVaultDir();
  const safeId = bookId.replace(/[^a-zA-Z0-9_-]/g, '_');
  for (const file of fs.readdirSync(VAULT_ROOT)) {
    if (file.startsWith(`${safeId}_v`) && file.endsWith('.pdf')) {
      try {
        fs.unlinkSync(path.join(VAULT_ROOT, file));
      } catch {
        // Ignore cleanup errors
      }
    }
  }
}
