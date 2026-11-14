import type { BookDocument, CmsChapter, ExamBlueprint } from '../src/types/cms.ts';

export interface CloudflareSyncConfig {
  configured: boolean;
  apiUrl: string;
}

export interface CloudflareSyncOutcome {
  target: 'cloudflare_d1_r2' | 'cloud_store';
  synced: boolean;
  r2Key?: string;
  checksumSha256?: string;
  syncedAt: string;
  error?: string;
}

export function getCloudflareSyncConfig(): CloudflareSyncConfig {
  const apiUrl = String(process.env.CLOUDFLARE_API_URL || '')
    .trim()
    .replace(/\/+$/, '');
  const token = String(process.env.CLOUDFLARE_ADMIN_TOKEN || '').trim();
  return {
    configured: Boolean(apiUrl && token),
    apiUrl,
  };
}

export async function syncPackToCloudflareIfConfigured(
  chapter: CmsChapter,
  reviewedBy: string,
  exams: ExamBlueprint[],
  localChecksumSha256: string,
): Promise<CloudflareSyncOutcome> {
  const now = new Date().toISOString();
  const apiUrl = String(process.env.CLOUDFLARE_API_URL || '')
    .trim()
    .replace(/\/+$/, '');
  const token = String(process.env.CLOUDFLARE_ADMIN_TOKEN || '').trim();

  if (!apiUrl || !token) {
    return {
      target: 'cloud_store',
      synced: true,
      checksumSha256: localChecksumSha256,
      syncedAt: now,
    };
  }

  try {
    const response = await fetch(`${apiUrl}/v1/admin/chapters/sync-pack`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        chapter,
        reviewedBy,
        exams,
      }),
    });

    const data = (await response.json().catch(() => ({}))) as {
      ok?: boolean;
      r2Key?: string;
      checksumSha256?: string;
      syncedAt?: string;
      error?: string;
    };

    if (!response.ok || !data.ok) {
      return {
        target: 'cloudflare_d1_r2',
        synced: false,
        checksumSha256: localChecksumSha256,
        syncedAt: now,
        error: data.error || `Cloudflare sync returned HTTP ${response.status}`,
      };
    }

    return {
      target: 'cloudflare_d1_r2',
      synced: true,
      r2Key: data.r2Key,
      checksumSha256: data.checksumSha256 || localChecksumSha256,
      syncedAt: data.syncedAt || now,
    };
  } catch (err: unknown) {
    return {
      target: 'cloudflare_d1_r2',
      synced: false,
      checksumSha256: localChecksumSha256,
      syncedAt: now,
      error: err instanceof Error ? err.message : 'Network error reaching Cloudflare Worker API.',
    };
  }
}

export async function syncBookToCloudflareIfConfigured(
  book: BookDocument,
  pdfBuffer: Buffer,
): Promise<CloudflareSyncOutcome> {
  const now = new Date().toISOString();
  const apiUrl = String(process.env.CLOUDFLARE_API_URL || '')
    .trim()
    .replace(/\/+$/, '');
  const token = String(process.env.CLOUDFLARE_ADMIN_TOKEN || '').trim();

  if (!apiUrl || !token) {
    return {
      target: 'cloud_store',
      synced: true,
      checksumSha256: book.sha256,
      syncedAt: now,
    };
  }

  try {
    const response = await fetch(`${apiUrl}/v1/admin/books/sync`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        book: {
          ...book,
          pageTexts: book.pageTexts.slice(0, 80),
        },
        pdfBase64: pdfBuffer.toString('base64'),
      }),
    });

    const data = (await response.json().catch(() => ({}))) as {
      ok?: boolean;
      r2Key?: string;
      syncedAt?: string;
      error?: string;
    };

    if (!response.ok || !data.ok) {
      return {
        target: 'cloudflare_d1_r2',
        synced: false,
        checksumSha256: book.sha256,
        syncedAt: now,
        error: data.error || `Cloudflare book sync returned HTTP ${response.status}`,
      };
    }

    return {
      target: 'cloudflare_d1_r2',
      synced: true,
      r2Key: data.r2Key,
      checksumSha256: book.sha256,
      syncedAt: data.syncedAt || now,
    };
  } catch (err: unknown) {
    return {
      target: 'cloudflare_d1_r2',
      synced: false,
      checksumSha256: book.sha256,
      syncedAt: now,
      error: err instanceof Error ? err.message : 'Network error reaching Cloudflare Worker API.',
    };
  }
}
